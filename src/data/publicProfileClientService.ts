import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

export type JavniProfilPoverenje = {
  ocenaProsek: number | null;
  brojRecenzija: number | null;
  zavrseniBroj: number;
  identitetVerifikovan: boolean;
  ocenaDostupna: boolean;
  recenzijeDostupne: boolean;
  verifikacijaIdentitetaDostupna: boolean;
};

export type JavniProfilProjekcija = {
  profilId: string;
  uloga: 'narucilac' | 'uskocer';
  ime: string | null;
  avatarPutanja: string | null;
  grad: string | null;
  naslov: string | null;
  biografija: string | null;
  poverenje: JavniProfilPoverenje;
};

function mapPublicProfile(raw: any): JavniProfilProjekcija {
  if (!raw || typeof raw !== 'object') throw new Error('PUBLIC_PROFILE_INVALID_PROJECTION');
  if (typeof raw.profileId !== 'string' || !raw.profileId) throw new Error('PUBLIC_PROFILE_ID_MISSING');
  if (raw.role !== 'REQUESTER' && raw.role !== 'WORKER') throw new Error('PUBLIC_PROFILE_ROLE_UNSUPPORTED');

  const trust = raw.trust;
  if (!trust || typeof trust !== 'object') throw new Error('PUBLIC_PROFILE_TRUST_INVALID');

  const completedCount = Number(trust.completedCount);
  if (!Number.isInteger(completedCount) || completedCount < 0) {
    throw new Error('PUBLIC_PROFILE_COMPLETED_COUNT_INVALID');
  }

  return {
    profilId: raw.profileId,
    uloga: raw.role === 'REQUESTER' ? 'narucilac' : 'uskocer',
    ime: typeof raw.displayName === 'string' ? raw.displayName : null,
    avatarPutanja: typeof raw.avatarPath === 'string' ? raw.avatarPath : null,
    grad: typeof raw.city === 'string' ? raw.city : null,
    naslov: typeof raw.publicSummary?.headline === 'string' ? raw.publicSummary.headline : null,
    biografija: typeof raw.publicSummary?.bio === 'string' ? raw.publicSummary.bio : null,
    poverenje: {
      ocenaProsek: typeof trust.ratingAverage === 'number' ? trust.ratingAverage : null,
      brojRecenzija: Number.isInteger(trust.reviewCount) && trust.reviewCount >= 0 ? trust.reviewCount : null,
      zavrseniBroj: completedCount,
      identitetVerifikovan: trust.identityVerified === true,
      ocenaDostupna: trust.ratingAvailable === true,
      recenzijeDostupne: trust.reviewsAvailable === true,
      verifikacijaIdentitetaDostupna: trust.identityVerificationAvailable === true,
    },
  };
}

/**
 * RU-5 / P0C-01 typed read boundary.
 *
 * The server owns the public/private cut. This client never reads another
 * account's raw app_profiles row and never reconstructs rating, review,
 * verification, completed-work, availability, radius, tool or vehicle truth.
 */
export const publicProfileClientService = {
  async javniProfil(profileId: string): Promise<JavniProfilProjekcija | null> {
    const id = profileId.trim();
    if (!id) return null;

    const { data, error } = await supabase.rpc('rpc_get_public_profile', {
      p_profile_id: id,
    });

    if (error) throw new Error(error.message || error.code || 'PUBLIC_PROFILE_READ_FAILED');
    return data ? mapPublicProfile(data) : null;
  },
};
