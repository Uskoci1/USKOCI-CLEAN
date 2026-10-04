  // R2: bounded negative cases added to the nine previously proven groups.
  await scoped('R2 shared-ledger close/reopen identities cannot masquerade as each other',async()=>{
    const o=await requester('r2-collision'),a=await worker('r2-collision-worker'),t=await task(o,'r2-collision');
    await select(o,t,await apply(a,t));
    const key='r2-collision-'+randomUUID();
    await ok(call(o.client,'rpc_close_remaining_search',closeArgs(t,'reopen:'+key)));
    const before=closedSnapshot(t.needId);
    await denied(o.client,'rpc_reopen_remaining_search',reopenArgs(t,key),'IDEMPOTENCY_KEY_REUSED');
    assert.deepEqual(closedSnapshot(t.needId),before);
    const other='r2-opposite-'+randomUUID();await reopen(o,t,other);
    const opened=closedSnapshot(t.needId);
    await denied(o.client,'rpc_close_remaining_search',closeArgs(t,'reopen:'+other),'IDEMPOTENCY_KEY_REUSED');
    assert.deepEqual(closedSnapshot(t.needId),opened);
    return {closeCannotReplayAsReopen:true,reopenCannotReplayAsClose:true,unchangedOnBothRefusals:true};
  });
  await scoped('R2 delayed FIRST reopen cannot clear a newer manual closure',async()=>{
    const o=await requester('r2-delayed'),a=await worker('r2-delayed-worker'),t=await task(o,'r2-delayed');
    await select(o,t,await apply(a,t));await close(o,t);
    const delayed=reopenArgs(t,'r2-delayed-'+randomUUID());
    await reopen(o,t,'r2-intervening-'+randomUUID());await close(o,t);
    const before=closedSnapshot(t.needId);assert.notEqual(before.remaining_search_closed_at,delayed.p_expected_closed_at);
    const code=await denied(o.client,'rpc_reopen_remaining_search',delayed,'STALE_SEARCH_STATE');assert.equal(code,'PT409');
    assert.deepEqual(closedSnapshot(t.needId),before);
    assert.equal(Number(rows(`select count(*) c from private.remaining_search_close_commands where requester_account_id=${q(o.id)}::uuid and client_request_id=${q('reopen:'+delayed.p_client_request_id)}`)[0].c),0);
    await denied(o.client,'rpc_reopen_remaining_search',{...delayed,p_expected_closed_at:null},'SEARCH_CLOSURE_WITNESS_REQUIRED');
    const fresh=await reopen(o,t);assert.equal(fresh.remainingSearchClosed,false);assert.equal(Number(fresh.reopenedRemainingSlots),1);
    return {delayedFirstCommandRefused:true,code,oldCommandNotRecorded:true,freshCommandAccepted:true};
  });
  await scoped('R2 same-key concurrent reopen commits once and payload changes are refused',async()=>{
    const o=await requester('r2-concurrent'),a=await worker('r2-concurrent-worker'),t=await task(o,'r2-concurrent');
    await select(o,t,await apply(a,t));await close(o,t);
    const key='r2-race-'+randomUUID(),args=reopenArgs(t,key);
    const responses=await Promise.all([call(o.client,'rpc_reopen_remaining_search',args),call(o.client,'rpc_reopen_remaining_search',args)]);
    for(const res of responses)assert.equal(res.error,null);
    assert.deepEqual(responses.map(x=>x.data.idempotentReplay).sort(),[false,true]);
    assert.ok(responses.every(x=>x.data.command==='REOPEN_REMAINING_SEARCH_V1'));
    assert.equal(Number(rows(`select count(*) c from private.remaining_search_close_commands where requester_account_id=${q(o.id)}::uuid and client_request_id=${q('reopen:'+key)}`)[0].c),1);
    const before=closedSnapshot(t.needId);
    await denied(o.client,'rpc_reopen_remaining_search',{...args,p_reason:'Different intent'},'IDEMPOTENCY_KEY_REUSED');
    assert.deepEqual(closedSnapshot(t.needId),before);
    assert.equal(sql("select (to_regprocedure('public.rpc_reopen_remaining_search(uuid,integer,text,text)') is null)::text"),'true');
    return {twoActualConcurrentRequests:true,oneRecordedCommand:true,changedPayloadRefused:true,unsafeFourArgumentApiAbsent:true};
  });
  await scoped('R2 explicit generic FLEXIBLE end and exact endpoint are respected',async()=>{
    const o=await requester('r2-time'),t=await task(o,'r2-time');
    const anchor='2030-01-07T12:00:00Z';
    sql(`begin;set local session_replication_role=replica;update public.needs set schedule_kind='FLEXIBLE',starts_at=null,ends_at=${q(anchor)}::timestamptz where id=${q(t.needId)}::uuid;commit;`);
    const admitted=at=>sql(`select private.need_search_time_admitted_v1(${q(t.needId)}::uuid,${q(at)}::timestamptz)::text`)==='true';
    assert.equal(admitted('2030-01-07T11:59:59.999999Z'),true);
    assert.equal(admitted(anchor),false);assert.equal(admitted('2030-01-07T12:00:00.000001Z'),false);
    sql(`begin;set local session_replication_role=replica;update public.needs set schedule_kind='FIXED_WINDOW',starts_at='2030-01-07T11:00:00Z' where id=${q(t.needId)}::uuid;commit;`);
    assert.equal(admitted(anchor),false);
    sql(`begin;set local session_replication_role=replica;update public.needs set schedule_kind='FLEXIBLE',starts_at='2020-01-01T00:00:00Z',ends_at=null where id=${q(t.needId)}::uuid;commit;`);
    assert.equal(admitted(anchor),true);assert.equal(admitted('infinity'),false);
    return {genericEndEnforced:true,oneMicrosecondBefore:true,exactEnd:false,oneMicrosecondAfter:false,startAloneIsNotInventedEnd:true};
  });
  await scoped('R2 relative windows fail closed with missing publication and close at their endpoint',async()=>{
    const o=await requester('r2-relative'),t=await task(o,'r2-relative');
    for(const kind of ['TODAY_FLEXIBLE','TOMORROW_FLEXIBLE','WEEK_FLEXIBLE']){
      sql(`begin;set local session_replication_role=replica;update public.needs set schedule_kind=${q(kind)},published_at='2030-01-07T10:00:00Z',starts_at=null,ends_at=null where id=${q(t.needId)}::uuid;commit;`);
      const result=rows(`select private.need_search_time_admitted_v1(n.id,private.relative_schedule_end_v5(n.schedule_kind,n.published_at,n.task_timezone)-interval '1 microsecond') before_end,private.need_search_time_admitted_v1(n.id,private.relative_schedule_end_v5(n.schedule_kind,n.published_at,n.task_timezone)) at_end from public.needs n where n.id=${q(t.needId)}::uuid`)[0];
      assert.equal(result.before_end,true);assert.equal(result.at_end,false);
      sql(`begin;set local session_replication_role=replica;update public.needs set published_at=null where id=${q(t.needId)}::uuid;commit;`);
      assert.equal(timeAllowed(t.needId),false);
    }
    return {relativeKinds:3,exactEndClosed:true,missingTimeOriginDenied:true};
  });
  // A real second psql backend owns the row lock; the proof observes the blocked API backend.
  async function holdNeed(id){
    const {spawn}=await import('node:child_process');
    const child=spawn('psql',[process.env.DB_URL,'-X','-qAt','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});
    let output='',err='';child.stdout.on('data',b=>{output+=b;});child.stderr.on('data',b=>{err+=b;});
    let ended=false,exitCode=null;child.on('exit',code=>{ended=true;exitCode=code;});
    child.stdin.write(`begin;select 'PID='||pg_backend_pid();select id from public.needs where id=${q(id)}::uuid for update;select 'R2_HELD';\n`);
    const until=Date.now()+8000;
    while(!output.includes('R2_HELD')&&Date.now()<until&&!ended)await new Promise(r=>setTimeout(r,25));
    if(!output.includes('R2_HELD')){child.kill('SIGTERM');throw new Error('R2_LOCAL_LOCK_NOT_ACQUIRED');}
    const pid=Number(/PID=(\d+)/.exec(output)?.[1]);assert.ok(Number.isSafeInteger(pid)&&pid>0);
    return {pid,async release(){child.stdin.end('commit;\n');const until=Date.now()+8000;while(!ended&&Date.now()<until)await new Promise(r=>setTimeout(r,25));if(!ended)child.kill('SIGTERM');assert.equal(exitCode,0,'R2_LOCAL_LOCK_RELEASE_FAILED');},abort(){if(!ended)child.kill('SIGTERM');}};
  }
  for(const action of ['reopen','cancel'])await scoped('R2 '+action+' waiting across expiry cannot revive matching',async()=>{
    const o=await requester('r2-lock-'+action),a=await worker('r2-lock-worker-'+action),t=await task(o,'r2-lock-'+action),id=await select(o,t,await apply(a,t));
    if(action==='reopen')await close(o,t);
    // Remove previous publication queue only in this labelled disposable clock/lock fixture.
    sql(`begin;set local session_replication_role=replica;update public.needs set schedule_kind='FLEXIBLE',starts_at=null,ends_at=clock_timestamp()+interval '6 seconds' where id=${q(t.needId)}::uuid;delete from private.dispatch_schedule where need_id=${q(t.needId)}::uuid;commit;`);
    const boundary=rows(`select ends_at,extract(epoch from ends_at)*1000 ms from public.needs where id=${q(t.needId)}::uuid`)[0];
    const args=action==='reopen'?reopenArgs(t):{p_agreement_id:id,p_reason:'EX06E lifecycle proof'};
    const name=action==='reopen'?'rpc_reopen_remaining_search':'rpc_cancel_agreement';
    const before=closedSnapshot(t.needId),holder=await holdNeed(t.needId);
    let promise;
    try{
      promise=call(action==='reopen'?o.client:a.client,name,args).then(x=>x);
      const until=Date.now()+4000;let observed=null;
      while(Date.now()<until){
        observed=rows(`select pid,query_start,query_start < ${q(boundary.ends_at)}::timestamptz started_before_end from pg_stat_activity where pid<>pg_backend_pid() and wait_event_type='Lock' and ${holder.pid}=any(pg_blocking_pids(pid)) and position(${q(name)} in query)>0 limit 1`)[0];
        if(observed)break;await new Promise(r=>setTimeout(r,60));
      }
      assert.ok(observed,'R2_API_LOCK_WAIT_NOT_OBSERVED');assert.equal(observed.started_before_end,true);
      await new Promise(r=>setTimeout(r,Math.max(0,Number(boundary.ms)-Date.now()+200)));
      assert.equal(sql(`select (clock_timestamp() >= ${q(boundary.ends_at)}::timestamptz)::text`),'true');
      await holder.release();const res=await promise;
      if(action==='reopen'){
        assert.ok(res.error);assert.equal(res.error.message,'REMAINING_SEARCH_REOPEN_WINDOW_CLOSED');assert.deepEqual(closedSnapshot(t.needId),before);
      }else{assert.equal(res.error,null);assert.equal(Number(state(t.needId).covered_slots),0);}
      assert.equal(schedule(t.needId),null);assert.equal(timeAllowed(t.needId),false);
      const w=wave(t.needId);assert.equal(w.status,'STOPPED');assert.equal(Number(w.inserted),0);
      return {actualLockWaitObserved:true,requestStartedBeforeEnd:true,lockReleasedAfterEnd:true,matchingRestarted:false,deniedOrStoppedAfterFreshClock:true};
    }finally{holder.abort();if(promise)await promise.catch(()=>{});}
  });
