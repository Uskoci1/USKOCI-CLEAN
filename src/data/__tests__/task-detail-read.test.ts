jest.mock('../supabaseClient', () => {
  const maybeSingle = jest.fn();
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ select }));
  return { supabaseKlijent: () => ({ from }), __testMocks: { maybeSingle, eq, select, from } };
});
jest.mock('../publicProfileClientService', () => ({ publicProfileClientService: { javniProfil: jest.fn() } }));

import { supabaseIzvor } from '../supabaseIzvor';
import { publicProfileClientService } from '../publicProfileClientService';
const { maybeSingle, eq, select, from } = jest.requireMock('../supabaseClient').__testMocks as Record<string, jest.Mock>;
const publicProfile = publicProfileClientService.javniProfil as jest.Mock;
const row = () => ({
  id: 'task-a', title: 'Pomoć pri selidbi', status: 'PUBLISHED', starts_at: null, ends_at: null,
  schedule_kind: 'FLEXIBLE', execution_location_mode: 'STATIONARY',
  approximate_area: 'Centar', approximate_city: 'Novi Sad', approximate_lat: 45.2, approximate_lng: 19.8,
  required_slots: 2, covered_slots: 0, required_skills: ['Alat'], required_tools: [], required_vehicles: [],
  requester_profile_id: 'requester-a', mode: 'MY_PRICE', requester_price_rsd: 5000, response_deadline: null,
});
beforeEach(() => { jest.clearAllMocks(); maybeSingle.mockReset(); publicProfile.mockResolvedValue(null); });

describe('W04 public-safe detail read', () => {
  it('separates failed transport/permission reads from a successful missing row', async () => {
    const failure = { code: '42501', message: 'private policy internals' };
    maybeSingle.mockResolvedValueOnce({ data: null, error: failure });
    await expect(supabaseIzvor.prilika('task-a')).rejects.toBe(failure);
    maybeSingle.mockRejectedValueOnce(new Error('offline'));
    await expect(supabaseIzvor.prilika('task-a')).rejects.toThrow('offline');
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(supabaseIzvor.prilika('task-a')).resolves.toBeNull();
    expect(publicProfile).not.toHaveBeenCalled();
  });

  it('recovers with the existing narrow projection and no private task columns', async () => {
    maybeSingle.mockResolvedValue({ data: { ...row(), exact_address: 'PRIVATE', requester_account_id: 'PRIVATE', private_terms: 'PRIVATE' }, error: null });
    const result = await supabaseIzvor.prilika('task-a');
    expect(from).toHaveBeenCalledWith('needs'); expect(eq).toHaveBeenCalledWith('id', 'task-a');
    expect(select.mock.calls[0][0].split(',').map((field: string) => field.trim())).toEqual([
      'id', 'title', 'status', 'created_at', 'starts_at', 'ends_at', 'schedule_kind', 'execution_location_mode',
      'approximate_area', 'approximate_city', 'approximate_lat', 'approximate_lng',
      'required_slots', 'required_skills', 'required_tools', 'required_vehicles', 'covered_slots', 'mode', 'requester_price_rsd', 'requester_profile_id', 'response_deadline',
    ]);
    expect(result).toMatchObject({ id: 'task-a', naslov: 'Pomoć pri selidbi', primaNovePrijave: true,
      podrucjeTekst: 'Centar, Novi Sad', narucilacIme: '', narucilacOcena: null, ponudjenaCena: { iznos: 5000, valuta: 'RSD' } });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    expect(publicProfile).toHaveBeenCalledWith('requester-a');
    expect(result?.rokZaPrijaveIso).toBeNull();
  });

  it.each(['ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'ARCHIVED', 'DRAFT', 'UNKNOWN'])('keeps readable %s tasks read-only', async status => {
    maybeSingle.mockResolvedValue({ data: { ...row(), status }, error: null });
    await expect(supabaseIzvor.prilika('task-a')).resolves.toMatchObject({ primaNovePrijave: false, statusTekst: 'Prijave zatvorene' });
  });

  it('does not offer a composer for a full task, while selection with remaining seats stays open', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { ...row(), status: 'SELECTION', covered_slots: 2 }, error: null });
    await expect(supabaseIzvor.prilika('task-a')).resolves.toMatchObject({ primaNovePrijave: false });
    maybeSingle.mockResolvedValueOnce({ data: { ...row(), status: 'SELECTION', covered_slots: 1 }, error: null });
    await expect(supabaseIzvor.prilika('task-a')).resolves.toMatchObject({ primaNovePrijave: true });
  });

  it.each([
    { required_slots: null }, { required_slots: undefined }, { required_slots: 0 }, { required_slots: -1 },
    { required_slots: 1.5 }, { required_slots: '2' }, { required_slots: Number.NaN },
    { covered_slots: null }, { covered_slots: undefined }, { covered_slots: -1 }, { covered_slots: 0.5 },
    { covered_slots: '0' }, { covered_slots: Number.NaN }, { covered_slots: Number.POSITIVE_INFINITY },
  ])('fails the read closed for malformed capacity %j', async malformed => {
    maybeSingle.mockResolvedValue({ data: { ...row(), ...malformed }, error: null });
    await expect(supabaseIzvor.prilika('task-a')).rejects.toThrow('TASK_CAPACITY_INVALID');
    expect(publicProfile).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'invalid', '9999', 1])('fails closed for unknown or malformed deadline %s', async response_deadline => {
    maybeSingle.mockResolvedValue({ data: { ...row(), response_deadline }, error: null });
    await expect(supabaseIzvor.prilika('task-a')).rejects.toThrow('TASK_DEADLINE_INVALID');
  });

  it('suppresses expired published tasks before the status-expiry cron runs', async () => {
    const expired = new Date(Date.now() - 1_000).toISOString();
    maybeSingle.mockResolvedValueOnce({ data: { ...row(), response_deadline: expired }, error: null });
    await expect(supabaseIzvor.prilika('task-a')).resolves.toMatchObject({ primaNovePrijave: false, rokZaPrijaveIso: expired });
    const future = new Date(Date.now() + 60_000).toISOString();
    maybeSingle.mockResolvedValueOnce({ data: { ...row(), response_deadline: future }, error: null });
    await expect(supabaseIzvor.prilika('task-a')).resolves.toMatchObject({ primaNovePrijave: true, rokZaPrijaveIso: future });
  });
});
