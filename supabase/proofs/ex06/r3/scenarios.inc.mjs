  const r3Read=(owner,t)=>ok(call(owner.client,'rpc_get_need_search_state',{p_need_id:t.needId}));
  const r3Receipt=(owner,args)=>ok(call(owner.client,'rpc_get_reopen_remaining_search_receipt',args));
  const r3Fingerprint=id=>sql(`select md5(jsonb_build_object('need',to_jsonb(n),
    'ledger',(select coalesce(jsonb_agg(to_jsonb(c) order by client_request_id),'[]') from private.remaining_search_close_commands c where c.need_id=n.id),
    'queue',(select to_jsonb(s) from private.dispatch_schedule s where s.need_id=n.id),
    'events',(select coalesce(jsonb_agg(to_jsonb(e) order by id),'[]') from public.user_activity_events e where e.entity_id=n.id))::text)
    from public.needs n where id=${q(id)}::uuid`);
  await scoped('R3 calendar week endpoints match independent timezone and DST cases',async()=>{
    const cases=JSON.parse(fs.readFileSync(new URL('./r3/week-cases.json',import.meta.url),'utf8'));
    for(const c of cases){
      const zone=c.zone===null?'null':q(c.zone);
      const result=rows(`select private.relative_schedule_end_v5(${q(c.kind)},${q(c.published)}::timestamptz,${zone})=${q(c.end)}::timestamptz correct`)[0];
      assert.equal(result.correct,true,JSON.stringify(c));
    }
    const o=await requester('r3-week'),t=await task(o,'r3-week');
    // Labelled future-time fixture: the clocks used for comparison are explicit inputs.
    sql(`begin;set local session_replication_role=replica;update public.needs set schedule_kind='WEEK_FLEXIBLE',published_at='2030-01-06T12:00:00Z',task_timezone='Europe/Belgrade',starts_at=null,ends_at=null where id=${q(t.needId)}::uuid;commit;`);
    const check=rows(`select private.need_search_time_admitted_v1(${q(t.needId)}::uuid,'2030-01-06T22:59:59.999999Z') before_end,private.need_search_time_admitted_v1(${q(t.needId)}::uuid,'2030-01-06T23:00:00Z') at_end`)[0];
    assert.equal(check.before_end,true);assert.equal(check.at_end,false);
    return {independentCases:cases.length,calendarEndNotRollingSevenDays:true,strictMicrosecondBoundary:true};
  });
  await scoped('R3 expired calendar week uses existing lifecycle expiry without changing Agreements',async()=>{
    const o=await requester('r3-expiry'),t=await task(o,'r3-expiry');
    sql(`begin;set local session_replication_role=replica;update public.needs set schedule_kind='WEEK_FLEXIBLE',published_at='2030-01-06T12:00:00Z',task_timezone='Europe/Belgrade',starts_at=null,ends_at=null where id=${q(t.needId)}::uuid;commit;`);
    const point='2030-01-06T23:00:00Z';
    assert.equal(sql(`select (private.relative_schedule_end_v5('WEEK_FLEXIBLE','2030-01-06T12:00:00Z','Europe/Belgrade')=${q(point)}::timestamptz)::text`),'true');
    fx.runExpiry(point);assert.equal(state(t.needId).status,'EXPIRED');assert.equal(schedule(t.needId),null);
    return {existingExpiryUsed:true,expiredAtCalendarBoundary:true,queueGone:true};
  });
  await scoped('R3 owner-only current-state read is side-effect free and matches reopen authority',async()=>{
    const o=await requester('r3-state'),a=await worker('r3-state-worker'),b=await requester('r3-outsider'),t=await task(o,'r3-state');
    let view=await r3Read(o,t);assert.equal(view.missingSlots,2);assert.equal(view.searchAuthority,'OPEN');assert.equal(view.canReopen,false);
    await select(o,t,await apply(a,t));await close(o,t);
    const before=r3Fingerprint(t.needId);view=await r3Read(o,t);
    assert.equal(view.needId,t.needId);assert.equal(view.coveredSlots,1);assert.equal(view.missingSlots,1);assert.equal(view.searchAuthority,'CLOSED');
    assert.equal(view.canReopen,true);assert.equal(view.reason,'CAN_REOPEN');assert.equal(view.nextAction,'REOPEN_SEARCH');
    await denied(b.client,'rpc_get_need_search_state',{p_need_id:t.needId},'NEED_NOT_FOUND');
    await denied(a.client,'rpc_get_need_search_state',{p_need_id:t.needId},'NEED_NOT_FOUND');
    await denied(b.client,'rpc_get_need_search_state',{p_need_id:randomUUID()},'NEED_NOT_FOUND');
    // PostgreSQL itself enforces read-only mode, with the authenticated owner's JWT subject.
    sql(`begin read only;set local role authenticated;select set_config('request.jwt.claim.sub',${q(o.id)},true);select public.rpc_get_need_search_state(${q(t.needId)}::uuid);rollback;`);
    assert.equal(r3Fingerprint(t.needId),before);
    const receipt=await reopen(o,t);assert.equal(receipt.reopenedRemainingSlots,view.missingSlots);
    view=await r3Read(o,t);assert.equal(view.searchAuthority,'OPEN');assert.equal(view.canReopen,false);assert.equal(view.reason,'SEARCH_ALREADY_OPEN');
    return {ownerOnly:true,outsiderAndMissingIndistinguishable:true,readOnlyTransactionPassed:true,unchangedByReads:true,writerReadbackParity:true};
  });
  await scoped('R3 unknown command reconciliation only reads and never reopens a search',async()=>{
    const o=await requester('r3-receipt'),a=await worker('r3-receipt-worker'),outsider=await requester('r3-receipt-other'),t=await task(o,'r3-receipt');
    await select(o,t,await apply(a,t));await close(o,t);
    const key='r3-receipt-'+randomUUID(),args=reopenArgs(t,key),before=r3Fingerprint(t.needId);
    const missing=await r3Receipt(o,args);assert.equal(missing.state,'NOT_CONFIRMED');assert.equal(missing.receipt,null);
    sql(`begin read only;set local role authenticated;select set_config('request.jwt.claim.sub',${q(o.id)},true);select public.rpc_get_reopen_remaining_search_receipt(${q(t.needId)}::uuid,${t.revision},${q(args.p_expected_closed_at)}::timestamptz,${q(key)},${q(args.p_reason)});rollback;`);
    assert.equal(r3Fingerprint(t.needId),before);assert.equal(schedule(t.needId),null);
    const original=await reopen(o,t,key);await close(o,t);const closedAgain=r3Fingerprint(t.needId);
    const historical=await r3Receipt(o,args);assert.equal(historical.state,'CONFIRMED');assert.equal(historical.receipt.reopenedAt,original.reopenedAt);assert.equal(historical.receipt.idempotentReplay,true);
    const current=await r3Read(o,t);assert.equal(current.searchAuthority,'CLOSED');assert.notEqual(current.closedAt,args.p_expected_closed_at);
    await denied(o.client,'rpc_get_reopen_remaining_search_receipt',{...args,p_reason:'changed'},'IDEMPOTENCY_KEY_REUSED');
    await denied(outsider.client,'rpc_get_reopen_remaining_search_receipt',args,'NEED_NOT_FOUND');
    assert.equal(r3Fingerprint(t.needId),closedAgain);
    return {unknownReadNeverExecutedCommand:true,readOnlyTransactionPassed:true,immutableHistorySeparateFromCurrentState:true,otherActorAndChangedPayloadDenied:true};
  });
  await scoped('R3 passed Need window keeps accepted future Agreement intact and routes to it',async()=>{
    const o=await requester('r3-independent'),a=await worker('r3-independent-worker'),t=await task(o,'r3-independent'),id=await select(o,t,await apply(a,t));
    await close(o,t);
    // Labelled clock/accepted-terms fixture. No new change writer or material-term mutation is offered to users.
    sql(`begin;set local session_replication_role=replica;
      update public.needs set schedule_kind='FIXED_WINDOW',starts_at=statement_timestamp()-interval '3 hours',ends_at=statement_timestamp()-interval '2 hours' where id=${q(t.needId)}::uuid;
      update public.agreement_versions set terms=jsonb_set(jsonb_set(terms,'{proposed_start_at}',to_jsonb((statement_timestamp()+interval '1 day')::text),true),'{proposed_end_at}',to_jsonb((statement_timestamp()+interval '1 day 2 hours')::text),true) where agreement_id=${q(id)}::uuid;commit;`);
    const hash=()=>sql(`select md5(jsonb_build_object('agreement',to_jsonb(a),'versions',(select jsonb_agg(to_jsonb(v) order by version) from public.agreement_versions v where v.agreement_id=a.id),'execution',(select to_jsonb(x) from public.agreement_execution x where x.agreement_id=a.id))::text) from public.agreements a where id=${q(id)}::uuid`);
    const before=hash();fx.runExpiry();const view=await r3Read(o,t);
    assert.equal(view.canReopen,false);assert.equal(view.reason,'SEARCH_WINDOW_CLOSED');assert.equal(view.nextAction,'OPEN_AGREEMENTS');assert.equal(view.activeAgreementCount,1);
    assert.equal(hash(),before);assert.equal(sql(`select status from public.agreements where id=${q(id)}::uuid`),'CONFIRMED');
    const w=wave(t.needId);assert.equal(Number(w.inserted),0);assert.equal(hash(),before);
    return {acceptedTermsAndAgreementUnchanged:true,noAutomaticCompletion:true,noNeedTimeExtension:true,nextAction:'OPEN_AGREEMENTS',scope:'No new per-allocation replacement entitlement'};
  });
  await scoped('R3 next-action uses existing completion confirmation and terminal history',async()=>{
    const o=await requester('r3-completion'),a=await worker('r3-completion-worker'),t=await task(o,'r3-completion'),id=await select(o,t,await apply(a,t));await close(o,t);
    await ok(call(a.client,'rpc_mark_work_done',{p_agreement_id:id}));let view=await r3Read(o,t);
    assert.equal(view.awaitingConfirmationCount,1);assert.equal(view.nextAction,'OPEN_AGREEMENTS');
    await ok(call(o.client,'rpc_confirm_completion',{p_agreement_id:id}));view=await r3Read(o,t);
    assert.equal(view.status,'COMPLETED');assert.equal(view.canReopen,false);assert.equal(view.nextAction,'VIEW_TASK_HISTORY');
    assert.equal(view.coveredSlots,1);assert.equal(view.requiredSlots,2);assert.equal(view.missingSlots,1);
    return {existingCompletionFlow:true,noParallelExecutionStates:true,completedCoverageNeverReopened:true,missingArithmeticPreserved:true};
  });
