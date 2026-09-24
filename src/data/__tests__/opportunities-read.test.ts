jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();
  return { supabaseKlijent: () => ({ rpc: mockRpc }), __testMocks: { mockRpc } };
});
jest.mock('../publicProfileClientService', () => ({
  publicProfileClientService: { javniProfil: jest.fn() },
}));

import { supabaseIzvor } from '../supabaseIzvor';
import { publicProfileClientService } from '../publicProfileClientService';

const { mockRpc } = jest.requireMock('../supabaseClient').__testMocks as { mockRpc: jest.Mock };
const publicProfile = publicProfileClientService.javniProfil as jest.Mock;

/** One item as public.rpc_list_open_tasks_v3 builds it (pkg023d + pkg023i). */
const item = (change: Record<string, unknown> = {}) => ({
  id: 'need-1', sortAt: '2026-09-18T10:00:00Z', publishedAt: '2026-09-18T10:00:00Z',
  title: 'Pomoć pri selidbi', category: 'Selidbe', status: 'PUBLISHED', urgent: false,
  scheduleKind: 'FLEXIBLE', startsAt: null, endsAt: null, executionLocationMode: null,
  approximateCity: 'Beograd', approximateArea: 'Centar',
  pin: { lat: 44.8, lng: 20.4, precision: 'COARSE_1KM' },
  requiredSlots: 3, coveredSlots: 1,
  requiredSkills: ['Selidbe'], requiredTools: [], requiredVehicles: [], requiredLicenses: [],
  minimumExperienceYears: null, verifiedIdentityRequired: false,
  taskCountryCode: 'RS', taskTimezone: 'Europe/Belgrade',
  priceMode: 'OFFERS', requesterPriceRsd: null, requesterProfileId: 'requester-1',
  responseDeadline: null, acceptsApplications: true, publicTopology: null, criticalConditions: null,
  ...change,
});
const page = (items: unknown[], hasMore = false) => ({ data: { items, hasMore, asOf: '2026-09-19T00:00:00Z' }, error: null });

describe('W03 authoritative discovery read, through the bounded server reader', () => {
  beforeEach(() => { jest.clearAllMocks(); mockRpc.mockReset(); publicProfile.mockReset(); });

  it('propagates a failed read so the screen cannot report no tasks', async () => {
    const failure = { code: '08006', message: 'Connection unavailable' };
    mockRpc.mockResolvedValue({ data: null, error: failure });
    await expect(supabaseIzvor.otvorenePrilike()).rejects.toBe(failure);
    expect(publicProfile).not.toHaveBeenCalled();
  });

  it('distinguishes a successful empty page from a missing response', async () => {
    mockRpc.mockResolvedValueOnce(page([]));
    await expect(supabaseIzvor.otvorenePrilike()).resolves.toEqual([]);
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(supabaseIzvor.otvorenePrilike()).rejects.toThrow('OPPORTUNITIES_RESPONSE_INVALID');
    expect(publicProfile).not.toHaveBeenCalled();
  });

  it('walks the pages by keyset and never repeats a row', async () => {
    mockRpc
      .mockResolvedValueOnce(page([item(), item({ id: 'need-2', sortAt: '2026-09-18T09:00:00Z' })], true))
      .mockResolvedValueOnce(page([item({ id: 'need-3', sortAt: '2026-09-18T08:00:00Z' })]));
    publicProfile.mockResolvedValue(null);
    const result = await supabaseIzvor.otvorenePrilike();
    expect(result.map(row => row.id)).toEqual(['need-1', 'need-2', 'need-3']);
    expect(mockRpc).toHaveBeenNthCalledWith(1, 'rpc_list_open_tasks_v3', { p_limit: 200, p_before_at: null, p_before_id: null });
    // The cursor is the last row of the page it just read, so the next page starts strictly after it.
    expect(mockRpc).toHaveBeenNthCalledWith(2, 'rpc_list_open_tasks_v3',
      { p_limit: 200, p_before_at: '2026-09-18T09:00:00Z', p_before_id: 'need-2' });
  });

  it('refuses rather than silently truncating a list that never ends', async () => {
    mockRpc.mockResolvedValue(page([item()], true));
    await expect(supabaseIzvor.otvorenePrilike()).rejects.toThrow('OPPORTUNITIES_TOO_MANY_PAGES');
  });

  it('preserves the public-safe task projection, and the list carries no description', async () => {
    mockRpc.mockRejectedValueOnce(new Error('offline'));
    await expect(supabaseIzvor.otvorenePrilike()).rejects.toThrow('offline');
    mockRpc.mockResolvedValueOnce(page([item()]));
    publicProfile.mockResolvedValueOnce(null);

    const result = await supabaseIzvor.otvorenePrilike();
    expect(publicProfile).toHaveBeenCalledWith('requester-1');
    expect(result).toEqual([{
      id: 'need-1', naslov: 'Pomoć pri selidbi', statusTekst: 'Traži ponude',
      podrucjeTekst: 'Centar, Beograd', vremeTekst: 'Fleksibilan termin',
      // The description is not in the public list at all; the detail screen reads the one a person opens.
      opis: '',
      taskCountryCode: 'RS', taskTimezone: 'Europe/Belgrade', schedule: { kind: 'FLEXIBLE', startsAt: null, endsAt: null },
      detalji: { kategorija: 'Selidbe', geografija: null, rezimLokacije: null,
        zahtevi: { vestine: ['Selidbe'], alati: [], vozila: [], dozvole: [], bitniUslovi: null, iskustvoGodina: null, potvrdjenIdentitet: false } },
      pokrivenost: { ukupno: 3, popunjeno: 1, preostalo: 2, udeo: 1 / 3 },
      // A failed profile read leaves the review count unknown (null), never zero (step 5a, 2026-09-24).
      uslovi: ['Selidbe'], narucilacProfilId: 'requester-1', narucilacIme: '', narucilacOcena: null, narucilacBrojOcena: null,
      priblizno: { lat: 44.8, lng: 20.4 }, rezimCene: 'OFFERS', osnovaCene: null, ponudjenaCena: undefined,
    }]);
  });

  // One task card (step 5a, 2026-09-24): the rating travels with how many reviews it stands on, taken from the same
  // profile read the list already makes; nothing is counted or guessed when that read does not disclose reviews.
  it('carries the review count the public profile discloses, 0 when there are none and null when it is not disclosed', async () => {
    const trust = (patch: Record<string, unknown>) => ({ profilId: 'requester-1', uloga: 'narucilac', ime: 'Nikola', avatarPutanja: null, grad: null,
      naslov: null, biografija: null, poverenje: { ocenaProsek: null, brojRecenzija: null, zavrseniBroj: 0, identitetVerifikovan: false,
        ocenaDostupna: false, recenzijeDostupne: false, verifikacijaIdentitetaDostupna: false, ...patch } });
    const read = async (profile: unknown) => {
      mockRpc.mockResolvedValueOnce(page([item()])); publicProfile.mockResolvedValueOnce(profile);
      const [row] = await supabaseIzvor.otvorenePrilike();
      return { narucilacOcena: row.narucilacOcena, narucilacBrojOcena: row.narucilacBrojOcena };
    };
    await expect(read(trust({ ocenaProsek: 4.8, brojRecenzija: 12, ocenaDostupna: true, recenzijeDostupne: true })))
      .resolves.toEqual({ narucilacOcena: '4,8', narucilacBrojOcena: 12 });
    await expect(read(trust({ brojRecenzija: 0, recenzijeDostupne: true }))).resolves.toEqual({ narucilacOcena: null, narucilacBrojOcena: 0 });
    await expect(read(trust({}))).resolves.toEqual({ narucilacOcena: null, narucilacBrojOcena: null });
    await expect(read(null)).resolves.toEqual({ narucilacOcena: null, narucilacBrojOcena: null });
  });
});
