/**
 * M01 — portovi.
 *
 * Ekran zove ovo. Ispod može da stoji lažni izvor ili Supabase — ekran ne zna
 * razliku i ne sme da zna. Zamena izvora je zamena jednog fajla.
 *
 * Imena metoda prate stvarne RPC funkcije iz donora, da se kasnije ne pogađa:
 *   rpc_r24_list_requester_responses, rpc_r24_select_response,
 *   rpc_r24_confirm_agreement, rpc_r24_browse_open_needs, ...
 */

import type {
  DogovorProjekcija,
  KandidatProjekcija,
  PorukaProjekcija,
  PotrebaProjekcija,
  PrilikaProjekcija,
} from '../contracts/projections';

/** Svaka komanda vraća ovo. Nikad goli rezultat. */
export type Ishod<T> =
  | { ok: true; podatak: T }
  | { ok: false; kod: string; poruka: string; naslov?: string };

/**
 * Idempotencija nije opcija. Server odbija ponovljen clientRequestId,
 * pa dupli tap ne pravi drugi Dogovor.
 */
export type Idempotentno = { clientRequestId: string };

/* --------------------------------------------------------------- čitanje */

export interface PotrebeCitanje {
  /** R03 — moje Potrebe. */
  mojePotrebe(): Promise<PotrebaProjekcija[]>;
  /** R04 — radni prostor jedne Potrebe. */
  potreba(id: string): Promise<PotrebaProjekcija | null>;
  /** W03 — javno bezbedan skup za Lista | Mapa | Kombinovano. */
  otvorenePrilike(): Promise<PrilikaProjekcija[]>;
  /** W04 — dosije jedne Prilike. */
  prilika(id: string): Promise<PrilikaProjekcija | null>;
}

export interface PrijaveCitanje {
  /** R05 — vlasnik kompletne liste prijava i kandidata. */
  prijaveZaPotrebu(potrebaId: string): Promise<KandidatProjekcija[]>;
}

export interface DogovoriCitanje {
  mojiDogovori(): Promise<DogovorProjekcija[]>;
  dogovor(id: string): Promise<DogovorProjekcija | null>;
  poruke(dogovorId: string): Promise<PorukaProjekcija[]>;
}

/* --------------------------------------------------------------- komande */

export type PodnesiPrijavuKomanda = Idempotentno & {
  potrebaId: string;
  potrebaRevizija: number;
  radnikProfilId: string;
  pokrivenaMesta: number;
  cenaRsd: number;
  predlozeniPocetak: string | null;
  predlozeniKraj: string | null;
  napomena: string | null;
};


/**
 * M02 — atomski tačan izbor.
 *
 * Vezuje tačnu reviziju Potrebe i tačnu verziju/hash Prijave. Ako se bilo
 * šta od toga promenilo otkad je Naručilac gledao, server odbija —
 * to je STALE_REVIEW_REQUIRED, ne tiha izmena.
 *
 * Uspeh atomski pravi CONFIRMED Dogovor. Nema treće potvrde.
 */
export type IzborKomanda = Idempotentno & {
  potrebaId: string;
  potrebaRevizija: number;
  prijavaId: string;
  prijavaVerzija: number;
  prijavaHash: string;
  mesta: number;
};

/** M05 — predlog izmene. Prihvatanje odmah aktivira v+1, bez petlje potvrda. */
export type IzmenaKomanda = Idempotentno & {
  dogovorId: string;
  ocekivanaVerzija: number;
  izmena: {
    cenaIznos?: number;
    cenaValuta?: string;
    pocetakIso?: string;
    krajIso?: string;
    obim?: string;
  };
  razlog?: string;
};

export interface Komande {

  /** rpc_submit_response */
  podnesiPrijavu(k: PodnesiPrijavuKomanda): Promise<Ishod<{ prijavaId: string; verzija: number; hash: string }>>;

  /** rpc_r24_select_response → rpc_r24_confirm_agreement, atomski */
  izaberiPrijavu(k: IzborKomanda): Promise<Ishod<{ dogovorId: string }>>;

  /** rpc_r24_mark_response_viewed */
  oznaciPrijavuVidjenom(prijavaId: string): Promise<Ishod<null>>;

  /** rpc_r25_propose_agreement_change */
  predloziIzmenu(k: IzmenaKomanda): Promise<Ishod<{ predlogId: string }>>;

  /** rpc_r25_respond_agreement_change */
  odgovoriNaIzmenu(predlogId: string, prihvatam: boolean): Promise<Ishod<null>>;

  /** M04 — chat radi nezavisno od privatnih grantova */
  posaljiPoruku(dogovorId: string, telo: string): Promise<Ishod<{ porukaId: string }>>;

  /** M06 — jednostrano otkazivanje. Oslobađa samo tu alokaciju. */
  otkaziDogovor(dogovorId: string, razlog: string): Promise<Ishod<null>>;

  /**
   * M07 — Uskočer označava završetak; otvara serverski prozor od 48h.
   * Nema obaveznih koraka „Krenuo sam" i „Stigao sam" pre ovoga.
   */
  oznaciZavrsetak(dogovorId: string): Promise<Ishod<{ rokPotvrdeIso: string }>>;

  /**
   * M07 — Naručilac potvrđuje. Može i NEZAVISNO, pre nego što Uskočer
   * bilo šta označi — to je legitiman put, ne izuzetak.
   */
  potvrdiZavrsetak(dogovorId: string): Promise<Ishod<null>>;

  /** M07 — prijavljen problem blokira automatsko zatvaranje po isteku prozora. */
  prijaviProblem(dogovorId: string, opis: string): Promise<Ishod<null>>;

  /**
   * M04 — deljenje telefona je usmereno i opozivo.
   * Deli SVOJ broj sa drugom stranom. Ne dobija njihov zauzvrat.
   */
  podeliTelefon(dogovorId: string): Promise<Ishod<null>>;

  /** OD-12: podeljen broj ostaje dok korisnik ne opozove ili Dogovor ne postane terminalan. */
  opoziviTelefon(dogovorId: string): Promise<Ishod<null>>;

  /** M04 — tačna lokacija je vezana za režim; daljinski Dogovor je nema. */
  otkrijTacnuLokaciju(dogovorId: string): Promise<Ishod<{ adresa: string }>>;
}

/* ----------------------------------------------------- R02 — AI intake */

/**
 * Imena prate donorov dokazani lanac (KEEP):
 *   rpc_ai_open_conversation → rpc_ai_propose_fact → rpc_ai_confirm_fact
 *   → rpc_ai_complete_conversation → rpc_r24_create_need_draft → rpc_r24_publish_need
 */
export interface AiIntake {
  /** rpc_ai_open_conversation */
  otvoriRazgovor(): Promise<Ishod<{ razgovorId: string }>>;

  /** Poruke i nacrt su dve projekcije istog stanja — čitaju se zajedno. */
  razgovor(razgovorId: string): Promise<{
    poruke: import('../contracts/projections').PorukaRazgovora[];
    nacrt: import('../contracts/projections').NacrtPotrebeProjekcija;
  } | null>;

  /**
   * Korisnik kaže nešto. Server (Edge `uskoci-ai-interview`) izvlači činjenice
   * i predlaže ih — nikad ih ne čuva kao potvrđene.
   */
  posaljiKorisnikovuPoruku(
    razgovorId: string,
    telo: string,
  ): Promise<Ishod<{ predlozeno: number }>>;

  /** rpc_ai_confirm_fact — HUMAN_CONFIRMED korak. Bez njega nema objave. */
  potvrdiCinjenicu(cinjenicaId: string): Promise<Ishod<null>>;

  /** Korisnik ispravlja: stara činjenica se POTISKUJE, ne prepisuje. */
  ispraviCinjenicu(
    cinjenicaId: string,
    novaVrednost: string,
  ): Promise<Ishod<{ novaCinjenicaId: string }>>;

  /** CANONICAL_SAVED — koristi isti nacrt, ne rekonstruiše iz istorije chata. */
  objaviPotrebu(razgovorId: string): Promise<Ishod<{ potrebaId: string }>>;
}

/* ----------------------------------------------------- Profil */

export interface ProfilCitanje {
  mojRadnikProfil(): Promise<import('../contracts/projections').RadnikProfilProjekcija | null>;
}

export type AzurirajProfilKomanda = {
  ime?: string;
  grad?: string;
  biografija?: string;
  vestine?: string[];
  alati?: string[];
  vozila?: string[];
  dostupanOdmah?: boolean;
  radijusKm?: number;
  zavrsi?: boolean; // Setuje DRAFT u ACTIVE
};

export interface ProfilKomande {
  azurirajRadnikProfil(k: AzurirajProfilKomanda): Promise<Ishod<null>>;
}

/** Sve na jednom mestu — jedan objekat koji ekrani dobijaju. */
export interface Izvor extends PotrebeCitanje, PrijaveCitanje, DogovoriCitanje, Komande, AiIntake, ProfilCitanje, ProfilKomande {
  /** 'lazni' dok ne odobrimo Supabase; kasnije 'supabase'. */
  readonly poreklo: 'lazni' | 'supabase';
}
