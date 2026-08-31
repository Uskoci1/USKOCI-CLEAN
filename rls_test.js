
const { createClient } = require('@supabase/supabase-js');
const URL = 'https://leqcwgzvjsxugfgzdmth.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlcWN3Z3p2anN4dWdmZ3pkbXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NTQ1MzUsImV4cCI6MjEwMzIzMDUzNX0.xXDf315iaIwtNwK2u2ZB8m3Dw5amx3eFsA4_adw6hMk';

async function run() {
  const sbA = createClient(URL, ANON);
  await sbA.auth.signInWithPassword({ email: 'adversarial_a@example.com', password: 'password123' });

  const sbW = createClient(URL, ANON);
  await sbW.auth.signInWithPassword({ email: 'adversarial_w@example.com', password: 'password123' });

  console.log('Worker getting open needs:');
  const { data: needsW } = await sbW.from('needs').select('id, status, title');
  console.log('Needs length:', needsW?.length);
  if (needsW?.length > 0) {
    console.log('First need status:', needsW[0].status);
  }

  console.log('Worker getting agreements:');
  const { data: agr } = await sbW.from('agreements').select('*, needs(id, status, title)');
  if (agr && agr.length > 0) {
    console.log('Worker agreements needs object:', agr[0].needs);
  } else {
    console.log('No agreements found for worker.');
  }
}
run();

