
const fs = require('fs');
let code = fs.readFileSync('test_package1.js', 'utf8');
const append = \
  console.log('[TEST 3] Package 2 RLS Verification');
  const workerAgr = await sbB.from('agreements').select('*, needs(id, status, title)').eq('id', agreementId);
  if (!workerAgr.data[0].needs) {
     console.error('FAIL | Worker received null for needs (RLS BLOCKED)');
     process.exit(1);
  } else {
     console.log('PASS | Worker can read ACTIVE parent Need via agreements join (needs_participant_read works!)');
  }

  const sbC = createClient(URL, ANON, { auth: { flowType: 'implicit', autoRefreshToken: false, persistSession: false } });
  await sbC.auth.signInWithPassword({ email: 'adversarial_c@example.com', password: 'password123' });
  
  const pubNeeds = await sbC.from('needs').select('id, status').eq('id', needId);
  if (pubNeeds.data && pubNeeds.data.length > 0) {
     console.error('FAIL | Unrelated worker can see ACTIVE Need');
     process.exit(1);
  } else {
     console.log('PASS | Unrelated worker CANNOT see ACTIVE Need');
  }

  const sensData = await sbC.from('need_sensitive').select('*').eq('need_id', needId);
  if (sensData.data && sensData.data.length > 0) {
     console.error('FAIL | Unrelated worker can see need_sensitive');
     process.exit(1);
  } else {
     console.log('PASS | Unrelated worker CANNOT see need_sensitive');
  }
\;

code = code.replace(console.log('\n=============================================');, append + \n  console.log('\n============================================='););
fs.writeFileSync('test_package2_full.js', code);

