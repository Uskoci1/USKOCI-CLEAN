import { calendarFailure } from '../calendarErrors';
import { supabaseIzvor } from '../supabaseIzvor';
import { agreementClientService } from '../agreementClientService';
const mockRpc = jest.fn();
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: jest.fn() }));

it.each(['WORKER_CALENDAR_CONFLICT', 'WORKER_NOT_ELIGIBLE', 'WORKER_NO_LONGER_ELIGIBLE'])(
  'maps %s to clear conflict copy without private provider detail', name => {
    const result = calendarFailure({ message: name, details: '["PRIVATE_VALUE","CALENDAR_CONFLICT"]' });
    expect(result).toMatchObject({ ok: false, kod: 'WORKER_CALENDAR_CONFLICT' });
    expect(JSON.stringify(result)).not.toContain('PRIVATE_VALUE');
  });
it.each([null, {}, { message: 'constructor' }, { message: 'WORKER_NOT_ELIGIBLE', details: 'CALENDAR_CONFLICT' },
  { message: 'WORKER_NOT_ELIGIBLE', details: '{"CALENDAR_CONFLICT":true}' }])('does not invent a conflict from %p', error => {
  expect(calendarFailure(error)).toBeNull();
});
it.each(['40001', '40P01'])('keeps concurrency %s retry manual and asks for a current reread', code => {
  expect(calendarFailure({ code })).toMatchObject({ ok: false, kod: 'CALENDAR_RECHECK_REQUIRED' });
});
it('connects the actual selection adapter to the same readable calendar error', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'WORKER_CALENDAR_CONFLICT' } });
  await expect(supabaseIzvor.izaberiPrijavu({ potrebaId: 'n', potrebaRevizija: 1, prijavaId: 'r',
    prijavaVerzija: 1, prijavaHash: 'hash', mesta: 1, clientRequestId: 'key' })).resolves.toMatchObject({
    ok: false, kod: 'WORKER_CALENDAR_CONFLICT', poruka: expect.stringContaining('Osvežite kalendar'),
  });
});
it('connects the actual agreement-change adapter without reporting success after overlap rejection', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'WORKER_CALENDAR_CONFLICT' } });
  await expect(agreementClientService.odgovoriNaIzmenu('proposal', true)).resolves.toMatchObject({
    ok: false, kod: 'WORKER_CALENDAR_CONFLICT', poruka: expect.stringContaining('drugi termin'),
  });
});


it.each(['AGREEMENT_CALENDAR_INTERVAL_INVALID', 'NEED_FIXED_INTERVAL_INVALID'])(
  'invalid exact interval %s does not demand a fixed time for every task', message => {
    const result = calendarFailure({ message });
    expect(result).toMatchObject({ ok: false, kod: 'AGREEMENT_CALENDAR_INTERVAL_INVALID',
      poruka: expect.stringContaining('ostavite ga fleksibilnim') });
  });
