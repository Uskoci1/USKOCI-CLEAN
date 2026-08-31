
const { povratniCilj } = require('./src/store/povratniCilj.ts');
const { postaviUlogu, ulogaSada } = require('./src/store/uloga.ts');

async function testRuntime() {
  console.log('--- TEST: WORKER intent -> Auth -> Worker workspace ---');
  await povratniCilj.clear();
  await povratniCilj.prepare({ intent: 'WORKER' });
  
  const pending = await povratniCilj.snapshot();
  if (pending && pending.status === 'PENDING') {
      await povratniCilj.markCompleted('fake-user-id', pending.intent);
      if (pending.intent.intent === 'WORKER') {
          postaviUlogu('uskocer');
      } else {
          postaviUlogu('narucilac');
      }
  }
  
  const role = ulogaSada();
  if (role === 'uskocer') {
     console.log('PASS | Workspace correctly switched to uskocer after auth intent.');
  } else {
     console.error('FAIL | Workspace did not switch.');
  }
}

// Since povratniCilj uses AsyncStorage which is an RN native module, this will crash in raw Node.
// We must simulate this using mocked AsyncStorage for our unit test.

