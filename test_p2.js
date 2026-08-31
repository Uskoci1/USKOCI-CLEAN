
const fs = require('fs');
let code = fs.readFileSync('test_package1.js', 'utf8');

const p2_code = \
  console.log('\\n[TEST 3] Package 2 RLS Verification');
  
  // Need is currently ACTIVE (test_package1 fills 1/1 slots). 
  // Wait, test_package1 uses '1 osoba', so it becomes ACTIVE.
  // We need to check if the Worker can STILL read the Need now that it is ACTIVE, because they are a participant!
  
  const { data: workerAgr, error: wErr } = await sbB.from('agreements').select('*, needs(id, status, title)').eq('id', agreementId);
  if (wErr) throw wErr;
  
  if (!workerAgr[0].needs) {
     console.error('FAIL | Worker received null for needs (RLS BLOCKED)');
     process.exit(1);
  } else {
     console.log('PASS | Worker can read ACTIVE parent Need via agreements join (needs_participant_read works!)');
  }

  // Check public discovery: An unrelated worker should NOT see it.
  const sbC = createClient(URL, ANON, { auth: { flowType: 'implicit', autoRefreshToken: false, persistSession: false } });
  await sbC.auth.signInWithPassword({ email: 'adversarial_c@example.com', password: 'password123' });
  const { data: pubNeeds } = await sbC.from('needs').select('id, status').eq('id', needId);
  if (pubNeeds && pubNeeds.length > 0) {
     console.error('FAIL | Unrelated worker can see ACTIVE Need');
     process.exit(1);
  } else {
     console.log('PASS | Unrelated worker CANNOT see ACTIVE Need');
  }

  // Exact location privacy check
  const { data: sensData } = await sbC.from('need_sensitive').select('*').eq('need_id', needId);
  if (sensData && sensData.length > 0) {
     console.error('FAIL | Unrelated worker can see need_sensitive');
     process.exit(1);
  } else {
     console.log('PASS | Unrelated worker CANNOT see need_sensitive');
  }
\;

code = code.replace(console.log('\\n=============================================');, p2_code + \n  console.log('\\n============================================='););
fs.writeFileSync('test_package2_full.js', code);

