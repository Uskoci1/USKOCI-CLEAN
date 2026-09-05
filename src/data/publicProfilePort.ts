export type JavniProfilUloga = 'REQUESTER' | 'WORKER';

export type JavniProfilProjekcija = {
  id: string;
  uloga: JavniProfilUloga;
  ime: string;
  /** Null until a public-safe signed/moderated avatar projection exists. */
  avatarUrl: string | null;
  grad: string;
  naslov: string | null;
  biografija: string | null;
  /** Server-derived from canonical agreement_execution.completed_at. */
  zavrseniDogovori: number;
  /** Null/false means the reputation authority is not available yet; never fabricate zero reviews. */
  reputacija: {
    dostupna: boolean;
    prosek: number | null;
    brojRecenzija: number | null;
  };
  /** Fail-closed until C02 identity attestation authority exists. */
  identitetPotvrdjen: boolean;
  /** Null until C03 confirmed public capability authority exists. */
  javneSposobnosti: string[] | null;
};

export interface PublicProfileCitanje {
  javniProfil(profileId: string): Promise<JavniProfilProjekcija | null>;
}
