import { readFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();
  return {
    supabaseKlijent: () => ({ rpc: mockRpc }),
    __testMocks: { mockRpc },
  };
});

import { publicProfileClientService } from '../publicProfileClientService';

const { mockRpc } = (jest.requireMock('../supabaseClient') as {
  __testMocks: { mockRpc: jest.Mock };
}).__testMocks;

describe('RU-5 P0C-01 public-safe profile projection', () => {
  beforeEach(() => mockRpc.mockReset());

  it('maps only the server projection and preserves unavailable trust as unavailable', async () => {
    mockRpc.mockResolvedValue({
      data: {
        profileId: 'profile-1',
        role: 'WORKER',
        displayName: 'Milan',
        avatarPath: 'profile-media/profile-1/avatar.jpg',
        city: 'Novi Sad',
        publicSummary: { headline: 'Selidbe i montaža', bio: 'Radim pažljivo.' },
        trust: {
          ratingAverage: null,
          reviewCount: null,
          completedCount: 0,
          identityVerified: false,
          ratingAvailable: false,
          reviewsAvailable: false,
          identityVerificationAvailable: false,
        },
      },
      error: null,
    });

    const result = await publicProfileClientService.javniProfil(' profile-1 ');

    expect(mockRpc).toHaveBeenCalledWith('rpc_get_public_profile', { p_profile_id: 'profile-1' });
    expect(result).toEqual({
      profilId: 'profile-1',
      uloga: 'uskocer',
      ime: 'Milan',
      avatarPutanja: 'profile-media/profile-1/avatar.jpg',
      grad: 'Novi Sad',
      naslov: 'Selidbe i montaža',
      biografija: 'Radim pažljivo.',
      poverenje: {
        ocenaProsek: null,
        brojRecenzija: null,
        zavrseniBroj: 0,
        identitetVerifikovan: false,
        ocenaDostupna: false,
        recenzijeDostupne: false,
        verifikacijaIdentitetaDostupna: false,
      },
    });
  });

  it('does not call the server for an empty id and fails loudly on malformed trust', async () => {
    await expect(publicProfileClientService.javniProfil('   ')).resolves.toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();

    mockRpc.mockResolvedValue({
      data: { profileId: 'p', role: 'REQUESTER', publicSummary: {}, trust: { completedCount: -1 } },
      error: null,
    });
    await expect(publicProfileClientService.javniProfil('p')).rejects.toThrow('PUBLIC_PROFILE_COMPLETED_COUNT_INVALID');
  });

  it('locks marketplace consumers to profile ids plus the public-profile RPC, never raw cross-account joins', () => {
    const root = join(__dirname, '../../..');
    const source = readFileSync(join(root, 'src/data/supabaseIzvor.ts'), 'utf8');
    const ports = readFileSync(join(root, 'src/data/ports.ts'), 'utf8');
    const index = readFileSync(join(root, 'src/data/index.ts'), 'utf8');
    const projections = readFileSync(join(root, 'src/contracts/projections.ts'), 'utf8');

    expect(source).not.toContain('app_profiles!requester_profile_id');
    expect(source).not.toContain('app_profiles!worker_profile_id');
    expect(source).toContain('requester_profile_id');
    expect(source).toContain('worker_profile_id');
    expect(source).toContain('publicProfileClientService.javniProfil');
    expect(source).toContain("| 'javniProfil'");

    expect(ports).toContain('javniProfil(profileId: string)');
    expect(index).toContain('...publicProfileClientService');
    expect(projections).toContain('narucilacProfilId: string');
    expect(projections).toContain('radnikProfilId: string');
  });

  it('locks the SQL projection against private and operational profile leakage', () => {
    const sql = readFileSync(
      join(__dirname, '../../..', 'supabase/migrations/20260905133000_clean_ru5_public_profile_projection.sql'),
      'utf8',
    );

    expect(sql).toContain('create or replace function public.rpc_get_public_profile(p_profile_id uuid)');
    expect(sql).toContain("p.profile_status = 'ACTIVE'");
    expect(sql).toContain("p.kind in ('REQUESTER', 'WORKER')");
    expect(sql).toContain("a.status = 'COMPLETED'");
    expect(sql).toContain('revoke all on function public.rpc_get_public_profile(uuid) from public, anon, authenticated');
    expect(sql).toContain('grant execute on function public.rpc_get_public_profile(uuid) to authenticated');

    for (const forbidden of [
      "'accountId'",
      "'email'",
      "'phone'",
      "'exactAddress'",
      "'availableNow'",
      "'radiusKm'",
      "'teamCapacity'",
      "'tools'",
      "'licenses'",
      "'vehicles'",
      "'exclusions'",
      "'minimumFeeRsd'",
      'rating_requester',
      'rating_worker',
      "'matcherScore'",
    ]) {
      expect(sql).not.toContain(forbidden);
    }
  });
});