
const { createClient } = require('@supabase/supabase-js');
const URL = 'https://leqcwgzvjsxugfgzdmth.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlcWN3Z3p2anN4dWdmZ3pkbXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NTQ1MzUsImV4cCI6MjEwMzIzMDUzNX0.xXDf315iaIwtNwK2u2ZB8m3Dw5amx3eFsA4_adw6hMk';

async function run() {
  const sbA = createClient(URL, ANON);
  await sbA.auth.signInWithPassword({ email: 'adversarial_a@example.com', password: 'password123' });
  const { data: userA } = await sbA.auth.getUser();

  const sbW = createClient(URL, ANON);
  await sbW.auth.signInWithPassword({ email: 'adversarial_w@example.com', password: 'password123' });

  // Requester (A) creates a Need (5 slots) via RPC to ensure proper execution
  const { data: rpcResp } = await sbA.rpc('rpc_ai_open_conversation', { p_purpose: 'NEW_NEED' });
  const convId = rpcResp;
  // Confirm facts
  await sbA.rpc('rpc_ai_confirm_fact', { p_fact_id: (await sbA.from('ai_structured_facts').insert({conversation_id: convId, fact_key: 'naslov', fact_value: 'Test Need', account_id: userA.user.id}).select())[0].data[0].id });
  await sbA.rpc('rpc_ai_confirm_fact', { p_fact_id: (await sbA.from('ai_structured_facts').insert({conversation_id: convId, fact_key: 'osoba', fact_value: '5', account_id: userA.user.id}).select())[0].data[0].id });
  // (This is getting complex to script completely without missing required facts)
}
run();

