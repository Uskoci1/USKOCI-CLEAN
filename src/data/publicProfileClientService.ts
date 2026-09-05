import type { JavniProfilProjekcija } from '../contracts/projections';
import type { Izvor } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type PublicProfileService = Pick<Izvor, 'javniProfil'>;

function mapPublicProfile(raw: any): JavniProfilProjekcija {
  if (!raw || typeof raw !== 'object') throw new Error('PUBLIC_PROFILE_INVALID_PROJECTION');
  if (raw.role !== 'REQUESTER' && raw.role !== 'WORKER') {
    throw new Error('PUBLIC_PROFILE_INVALID_ROLE');
  }
  if (!raw.profileId || typeof raw.displayName !== 'string' || typeof raw.city !== 'string') {
    throw new Error('PUBLIC_PROFILE_INVALID_PROJECTION');
  }

  const reputation = raw.reputation && typeof raw.reputation === 'object' ? raw.reputation : null;

  return {
    id: String(raw.profileId),
    uloga: raw.role,
    ime: raw.displayName,
    avatarUrl: typeof raw.avatarUrl === 'string' && raw.avatarUrl ? raw.avatarUrl : null,
    grad: raw.city,
    naslov: typeof raw.headline === 'string' && raw.headline ? raw.headline : null,
    biografija: typeof raw.bio === 'string' && raw.bio ? raw.bio : null,
    zavrseniDogovori: Math.max(0, Number(raw.completedWorkCount ?? 0)),
    reputacija: {
      dostupna: reputation?.available === true,
      prosek:
        typeof reputation?.ratingAverage === 'number'
          ? reputation.ratingAverage
          : null,
      brojRecenzija:
        typeof reputation?.reviewCount === 'number'
          ? reputation.reviewCount
          : null,
    },
    identitetPotvrdjen: raw.identityVerified === true,
    javneSposobnosti: Array.isArray(raw.publicCapabilities)
      ? raw.publicCapabilities.filter((v: unknown): v is string => typeof v === 'string')
      : null,
  };
}

/** RU-5/P0C-01 canonical client boundary for public-safe profile reads. */
export const publicProfileClientService: PublicProfileService = {
  async javniProfil(profileId) {
    const id = profileId.trim();
    if (!id) return null;

    const { data, error } = await supabase.rpc('rpc_public_profile', {
      p_profile_id: id,
    });

    if (error) throw new Error(error.message || 'PUBLIC_PROFILE_READ_FAILED');
    return data ? mapPublicProfile(data) : null;
  },
};
