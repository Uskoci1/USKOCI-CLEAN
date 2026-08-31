const { createClient } = require('@supabase/supabase-js');

const URL = 'https://leqcwgzvjsxugfgzdmth.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlcWN3Z3p2anN4dWdmZ3pkbXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NTQ1MzUsImV4cCI6MjEwMzIzMDUzNX0.xXDf315iaIwtNwK2u2ZB8m3Dw5amx3eFsA4_adw6hMk';

const EMAIL_A = 'adversarial_a@example.com';
const EMAIL_B = 'adversarial_b@example.com';
const PASSWORD = 'TestPass123!';

async function run() {
  console.log('--- STARTING PACKAGE 1 VERIFICATION TESTS ---');
  
  // 1. Authenticate
  const sb = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: authA, error: errA } = await sb.auth.signInWithPassword({ email: EMAIL_A, password: PASSWORD });
  if (errA) throw new Error('Auth A failed: ' + errA.message);
  
  const sbA = createClient(URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: 'Bearer ' + authA.session.access_token } }
  });

  const { data: authB, error: errB } = await sb.auth.signInWithPassword({ email: EMAIL_B, password: PASSWORD });
  if (errB) throw new Error('Auth B failed: ' + errB.message);
  
  const sbB = createClient(URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: 'Bearer ' + authB.session.access_token } }
  });

  const uidA = authA.user.id;
  const uidB = authB.user.id;

  // Ensure profiles
  let { data: profilesA } = await sbA.from('app_profiles').select('id, kind');
  let reqProfileA = profilesA?.find(p => p.kind === 'REQUESTER');
  let wrkProfileA = profilesA?.find(p => p.kind === 'WORKER');
  if (!reqProfileA) {
    const { data } = await sbA.from('app_profiles').insert({ account_id: uidA, kind: 'REQUESTER', display_name: 'Test Requester A' }).select().single();
    reqProfileA = data;
  }
  if (!wrkProfileA) {
    const { data } = await sbA.from('app_profiles').insert({ account_id: uidA, kind: 'WORKER', display_name: 'Test Worker A' }).select().single();
    wrkProfileA = data;
  }

  let { data: profilesB } = await sbB.from('app_profiles').select('id, kind');
  let wrkProfileB = profilesB?.find(p => p.kind === 'WORKER');
  if (!wrkProfileB) {
    const { data } = await sbB.from('app_profiles').insert({ account_id: uidB, kind: 'WORKER', display_name: 'Test Worker B' }).select().single();
    wrkProfileB = data;
  }

  // TEST 1: AI PUBLISH NEED FIX
  console.log('\n[TEST 1] AI Intake & Publish Need');
  const { data: convId, error: convErr } = await sbA.rpc('rpc_ai_open_conversation', { p_purpose: 'NEED_INTAKE' });
  if (convErr) throw new Error('Open conversation failed: ' + convErr.message);
  console.log('PASS | rpc_ai_open_conversation | ID: ' + convId);

  const facts = [
    { key: 'naslov', val: 'Hitno prenošenje troseda' },
    { key: 'opis', val: 'Potrebna pomoć za nošenje troseda na 3. sprat' },
    { key: 'kategorija', val: 'Fizički poslovi' },
    { key: 'datum', val: 'Danas' },
    { key: 'vreme', val: '18:00' },
    { key: 'polaziste', val: 'Vračar, Beograd' },
    { key: 'odrediste', val: 'Novi Beograd' },
    { key: 'osoba', val: '2' },
    { key: 'mode', val: 'OFFERS' },
    { key: 'execution_location_mode', val: 'POINT_TO_POINT' }
  ];

  for (const f of facts) {
    const { data: factId, error: fErr } = await sbA.rpc('rpc_ai_propose_fact', {
      p_conversation_id: convId,
      p_fact_key: f.key,
      p_fact_value: JSON.stringify(f.val),
      p_source: 'EXPLICIT_USER_ANSWER',
      p_scope: 'NEED_DRAFT'
    });
    if (fErr) throw new Error('Propose fact ' + f.key + ' failed: ' + fErr.message);
    
    const { error: confErr } = await sbA.rpc('rpc_ai_confirm_fact', { p_fact_id: factId });
    if (confErr) throw new Error('Confirm fact ' + f.key + ' failed: ' + confErr.message);
  }
  console.log('PASS | Proposed and confirmed all required facts');

  // Now publish
  const { data: needId, error: pubErr } = await sbA.rpc('rpc_ai_publish_need', {
    p_conversation_id: convId,
    p_profile_id: reqProfileA.id
  });
  if (pubErr) {
    console.error('FAIL | rpc_ai_publish_need failed:', pubErr);
    process.exit(1);
  }
  console.log('PASS | rpc_ai_publish_need succeeded | Published Need ID: ' + needId);

  // Read back published need from DB
  const { data: needRow, error: readNeedErr } = await sbA.from('needs').select('*').eq('id', needId).single();
  if (readNeedErr) throw new Error('Read published need failed: ' + readNeedErr.message);
  
  if (needRow.mode !== 'OFFERS') throw new Error('Expected mode OFFERS, got: ' + needRow.mode);
  if (needRow.execution_location_mode !== 'POINT_TO_POINT') throw new Error('Expected execution_location_mode POINT_TO_POINT, got: ' + needRow.execution_location_mode);
  if (needRow.status !== 'PUBLISHED') throw new Error('Expected status PUBLISHED, got: ' + needRow.status);
  if (needRow.required_slots !== 2) throw new Error('Expected required_slots 2, got: ' + needRow.required_slots);
  console.log('PASS | Need mode, execution_location_mode, slots and status verified in DB');

  // TEST 2: CREATE AGREEMENT & TEST REPORT PROBLEM NARRATIVE
  console.log('\n[TEST 2] Report Problem Narrative Persistence');
  
  // Worker B submits response
  const { data: submitData, error: respErr } = await sbB.rpc('rpc_submit_response', {
    p_need_id: needId,
    p_need_revision: 1,
    p_worker_profile_id: wrkProfileB.id,
    p_covered_slots: 2,
    p_price_rsd: 4500,
    p_proposed_start_at: null,
    p_proposed_end_at: null,
    p_scope_note: 'Mogu odmah u 18h',
    p_client_request_id: 'test-req-' + Date.now()
  });
  if (respErr) throw new Error('Submit response failed: ' + respErr.message);
  
  console.log('submitData:', submitData); const { data: myResp } = await sbB.from('marketplace_responses').select('*').eq('need_id', needId).single(); const respId = myResp.id;
  console.log('PASS | rpc_submit_response | Response ID: ' + respId);

  // Fetch response version & hash
  const { data: respRow } = await sbA.from('marketplace_responses').select('*').eq('id', respId).single();
  const { data: verRows } = await sbA.from('marketplace_response_versions').select('*').eq('response_id', respId).order('version', { ascending: false });
  const respVersion = respRow.current_version;
  const contentHash = verRows?.[0]?.content_hash || null;

  // Requester A selects response -> creates agreement
  const { data: selData, error: selErr } = await sbA.rpc('rpc_select_response', {
    p_need_id: needId,
    p_need_revision: 1,
    p_response_id: respId,
    p_response_version: respVersion,
    p_content_hash: contentHash,
    p_client_request_id: 'test-sel-' + Date.now()
  });
  if (selErr) throw new Error('Select response failed: ' + selErr.message);
  
  const agrId = typeof selData === 'object' ? (selData.agreement_id || selData.id) : selData;
  console.log('PASS | rpc_select_response | Agreement ID: ' + agrId);

  // Requester reports problem with narrative
  const NARRATIVE = 'Radnik je javio da mu se pokvario kombi i ne moze da dodje';
  const { error: probErr } = await sbA.rpc('rpc_report_problem', {
    p_agreement_id: agrId,
    p_narrative: NARRATIVE
  });
  if (probErr) throw new Error('Report problem failed: ' + probErr.message);
  console.log('PASS | rpc_report_problem executed successfully');

  // Verify execution row
  const { data: execRow, error: execErr } = await sbA.from('agreement_execution').select('*').eq('agreement_id', agrId).single();
  if (execErr) throw new Error('Read agreement_execution failed: ' + execErr.message);
  
  if (execRow.problem_narrative !== NARRATIVE) throw new Error('Expected problem_narrative "' + NARRATIVE + '", got: "' + execRow.problem_narrative + '"');
  if (execRow.problem_opened_by !== uidA) throw new Error('Expected problem_opened_by ' + uidA + ', got: ' + execRow.problem_opened_by);
  if (!execRow.problem_opened_at) throw new Error('Expected problem_opened_at timestamp to be set');
  console.log('PASS | agreement_execution.problem_narrative and problem_opened_by verified in DB');

  // Verify chat message entry
  const { data: msgRows, error: msgErr } = await sbA.from('agreement_messages').select('*').eq('agreement_id', agrId);
  if (msgErr) throw new Error('Read agreement_messages failed: ' + msgErr.message);
  const disputeMsg = msgRows.find(m => m.body.includes(NARRATIVE));
  if (!disputeMsg) throw new Error('Dispute message not found in agreement_messages');
  console.log('PASS | Dispute message persisted in agreement_messages');

  console.log('\n=============================================');
  console.log('ALL PACKAGE 1 VERIFICATION TESTS PASSED (100%)');
  console.log('=============================================');
}

run().catch(e => {
  console.error('VERIFICATION ERROR:', e);
  process.exit(1);
});

