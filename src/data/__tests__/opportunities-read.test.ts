jest.mock('../supabaseClient', () => {
  const mockOrder = jest.fn();
  const mockIn = jest.fn(() => ({ order: mockOrder }));
  const mockSelect = jest.fn(() => ({ in: mockIn }));
  const mockFrom = jest.fn(() => ({ select: mockSelect }));
  return {
    supabaseKlijent: () => ({ from: mockFrom }),
    __testMocks: { mockOrder, mockFrom, mockIn },
  };
});
jest.mock('../publicProfileClientService', () => ({
  publicProfileClientService: { javniProfil: jest.fn() },
}));

import { supabaseIzvor } from '../supabaseIzvor';
import { publicProfileClientService } from '../publicProfileClientService';

const { mockOrder, mockFrom, mockIn } = jest.requireMock('../supabaseClient').__testMocks as {
  mockOrder: jest.Mock; mockFrom: jest.Mock; mockIn: jest.Mock;
};
const publicProfile = publicProfileClientService.javniProfil as jest.Mock;

describe('W03 authoritative discovery read', () => {
  beforeEach(() => { jest.clearAllMocks(); mockOrder.mockReset(); publicProfile.mockReset(); });

  it('propagates a failed read so the screen cannot report no tasks', async () => {
    const failure = { code: '08006', message: 'Connection unavailable' };
    mockOrder.mockResolvedValue({ data: [], error: failure });
    await expect(supabaseIzvor.otvorenePrilike()).rejects.toBe(failure);
    expect(publicProfile).not.toHaveBeenCalled();
  });

  it('distinguishes successful empty results from a missing response', async () => {
    mockOrder.mockResolvedValueOnce({ data: [], error: null });
    await expect(supabaseIzvor.otvorenePrilike()).resolves.toEqual([]);
    mockOrder.mockResolvedValueOnce({ data: null, error: null });
    await expect(supabaseIzvor.otvorenePrilike()).rejects.toThrow('OPPORTUNITIES_RESPONSE_INVALID');
    expect(publicProfile).not.toHaveBeenCalled();
  });

  it('recovers on a later read and preserves the public-safe task projection', async () => {
    mockOrder.mockRejectedValueOnce(new Error('offline'));
    await expect(supabaseIzvor.otvorenePrilike()).rejects.toThrow('offline');
    mockOrder.mockResolvedValueOnce({ data: [{
      id: 'need-1', title: 'Pomoć pri selidbi', status: 'PUBLISHED', starts_at: null,
      approximate_area: 'Centar', approximate_city: 'Beograd', approximate_lat: 44.8, approximate_lng: 20.4,
      required_slots: 3, covered_slots: 1, required_skills: ['Selidbe'], required_tools: [], required_vehicles: [],
      requester_profile_id: 'requester-1', mode: 'OFFERS', requester_price_rsd: null,
      ends_at: null, schedule_kind: 'FLEXIBLE', execution_location_mode: 'STATIONARY', response_deadline: null,
    }], error: null });
    publicProfile.mockResolvedValueOnce(null);

    const result = await supabaseIzvor.otvorenePrilike();
    expect(mockFrom).toHaveBeenLastCalledWith('needs');
    expect(mockIn).toHaveBeenLastCalledWith('status', ['PUBLISHED', 'SELECTION']);
    expect(publicProfile).toHaveBeenCalledWith('requester-1');
    expect(result).toEqual([{
      id: 'need-1', naslov: 'Pomoć pri selidbi', statusTekst: 'Traži ponude',
      primaNovePrijave: true, rokZaPrijaveIso: null,
      executionLocationMode: 'STATIONARY', scheduleKind: 'FLEXIBLE', startsAt: null, endsAt: null, grad: 'Beograd',
      podrucjeTekst: 'Centar, Beograd', vremeTekst: 'Fleksibilno',
      pokrivenost: { ukupno: 3, popunjeno: 1, preostalo: 2, udeo: 1 / 3 },
      uslovi: ['Selidbe'], narucilacProfilId: 'requester-1', narucilacIme: '', narucilacOcena: null,
      priblizno: { lat: 44.8, lng: 20.4 }, rezimCene: 'OFFERS', ponudjenaCena: undefined,
    }]);
  });
});
