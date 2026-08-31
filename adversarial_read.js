
const { createClient } = require('@supabase/supabase-js');
const URL = 'https://leqcwgzvjsxugfgzdmth.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlcWN3Z3p2anN4dWdmZ3pkbXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NTQ1MzUsImV4cCI6MjEwMzIzMDUzNX0.xXDf315iaIwtNwK2u2ZB8m3Dw5amx3eFsA4_adw6hMk';

async function run() {
  const sbA = createClient(URL, ANON);
  await sbA.auth.signInWithPassword({ email: 'adversarial_a@example.com', password: 'password123' });
  const { data: userA } = await sbA.auth.getUser();

  const sbW = createClient(URL, ANON);
  await sbW.auth.signInWithPassword({ email: 'adversarial_w@example.com', password: 'password123' });

  // 1. Worker (who is not a participant yet) fetches open opportunities
  const { data: needsW, error } = await sbW.from('needs').select('id, status, title').in('status', ['PUBLISHED', 'SELECTION']);
  console.log('Worker open needs length:', needsW?.length, 'error:', error?.message);

  // 2. Fetch specific agreement and check nested needs
  const { data: agr } = await sbW.from('agreements').select('*, needs(id, status, title)').limit(1);
  if (agr && agr.length > 0) {
    console.log('Worker agreement nested needs status:', agr[0].needs?.status || 'null (RLS BLOCKED)');
  }

  // 3. Exact location check
  const { data: needSensitive, error: nsErr } = await sbW.from('need_sensitive').select('*').limit(1);
  console.log('Worker need_sensitive (unauthorized) count:', needSensitive?.length || 0, 'error:', nsErr?.message);
}
run();

