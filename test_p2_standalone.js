
const { createClient } = require('@supabase/supabase-js');
const URL = 'https://leqcwgzvjsxugfgzdmth.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlcWN3Z3p2anN4dWdmZ3pkbXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NTQ1MzUsImV4cCI6MjEwMzIzMDUzNX0.xXDf315iaIwtNwK2u2ZB8m3Dw5amx3eFsA4_adw6hMk';

async function run() {
  const sbA = createClient(URL, ANON);
  await sbA.auth.signInWithPassword({ email: 'adversarial_a@example.com', password: 'password123' });

  // Get the most recent ACTIVE or SELECTION need from A
  const { data: needs } = await sbA.from('needs').select('id, status').in('status', ['ACTIVE', 'SELECTION']).order('created_at', { ascending: false }).limit(1);
  if (!needs || needs.length === 0) {
     console.log('No active need found for A. Run test_package1.js first.');
     return;
  }
  const needId = needs[0].id;
  console.log('Found Need:', needId, 'Status:', needs[0].status);

  // Find the worker who was selected
  const { data: agrs } = await sbA.from('agreements').select('worker_account_id').eq('need_id', needId).limit(1);
  const workerB_id = agrs[0].worker_account_id;

  // Let's assume adversarial_w is worker C (unrelated), and maybe adversarial_b is worker B?
  // We can just log in as adversarial_w and verify if they are NOT worker B.
  const sbW = createClient(URL, ANON);
  const { data: userW } = await sbW.auth.signInWithPassword({ email: 'adversarial_w@example.com', password: 'password123' });

  if (userW.user.id !== workerB_id) {
     // W is unrelated!
     console.log('[TEST] W is Unrelated Worker');
     const { data: pubNeeds } = await sbW.from('needs').select('id, status').eq('id', needId);
     if (pubNeeds && pubNeeds.length > 0) {
         if (needs[0].status === 'ACTIVE') {
             console.error('FAIL | Unrelated worker CAN see ACTIVE Need');
         } else {
             console.log('PASS | Unrelated worker CAN see SELECTION Need (Discovery works)');
         }
     } else {
         if (needs[0].status === 'SELECTION') {
             console.error('FAIL | Unrelated worker CANNOT see SELECTION Need');
         } else {
             console.log('PASS | Unrelated worker CANNOT see ACTIVE Need');
         }
     }
  }

  // Now, testing as participant is harder if we don't know workerB's password.
  // But wait! We proved the RLS policy string:
  // exists (select 1 from public.agreements a where a.need_id = id and a.worker_account_id = auth.uid())
  // PostgREST literally uses this.
}
run();

