/**
 * M01 — PROJECTION FOUNDATION
 *
 * Ekrani ne čitaju sirove redove. Čitaju ove projekcije, vezane za ulogu.
 *
 * Pravilo iz V8: ekran nikad ne vidi sirovu transportnu vrstu, sirovu reviziju,
 * matcher skor, redove potvrda niti unutrašnjost privatnih grantova.
 * Ako projekcija to ne nosi, ekran to ne sme da prikaže.
 */

export type Uloga = 'narucilac' | 'uskocer';

/** Novčani iznos nikad ne putuje kao broj bez valute. */
export type Novac = {
  iznos: number;
  valuta: string;
  /** Već formatirano za prikaz — ekran ne formatira sam. */
  prikaz: string;
};

export type Pokrivenost = {
  ukupno: number;
  popunjeno: number;
  preostalo: number;
  /** Udeo 0..1, za traku napretka. */
  udeo: number;
};

/* ---------------------------------------------------------------- Potreba */

export type StanjePotrebe =
  | 'NACRT'
  | 'OBJAVLJENA'
  | 'CEKA_PRIJAVE'
  | 'DELIMICNO_POPUNJENA'
  | 'POPUNJENA'
  | 'ZATVORENA';

export type RezimCene = 'MY_PRICE' | 'OFFERS';

export type PotrebaProjekcija = {
  id: string;
  /** Tačna revizija. Izbor mora da se veže za nju. */
  revizija: number;
  naslov: string;
  opis: string;
  stanje: StanjePotrebe;
  pokrivenost: Pokrivenost;
  vremeTekst: string;
  /** Javno bezbedna geografija. Tačna adresa NIJE ovde. */
  podrucjeTekst: string;
  uslovi: string[];
  brojPrijava: number;
  rezimCene?: RezimCene;
  ponudjenaCena?: Novac;
};

/* --------------------------------------------------------------- Prilika */

/**
 * Prilika je Potreba kako je vidi Uskočer.
 * Očišćena od PII, bez pravog broja prijava (da ne obeshrabruje).
 */
export type PrilikaProjekcija = {
  id: string;
  naslov: string;
  statusTekst: string;
  podrucjeTekst: string;
  vremeTekst: string;
  pokrivenost: Pokrivenost;
  uslovi: string[];
  /** Bezbedan profile id za P0C-01 public-profile RPC/deep link; nije account id. */
  narucilacProfilId: string;
  narucilacIme: string;
  narucilacOcena: string | null;
  /** Približna tačka za mapu. Tačna lokacija se otkriva tek po pravilima Dogovora. */
  priblizno: { lat: number; lng: number } | null;
  rezimCene?: RezimCene;
  ponudjenaCena?: Novac;
};

/* ---------------------------------------------------------------- Prijava */

export type StanjeProfila = 'DRAFT' | 'ACTIVE' | 'SUSPENDED';

export type RadnikProfilProjekcija = {
  id: string;
  ime: string;
  grad: string;
  biografija: string;
  vestine: string[];
  alati: string[];
  vozila: string[];
  stanje: StanjeProfila;
  dostupanOdmah: boolean;
  radijusKm: number;
};

/**
 * RU-5 / P0C-01 global public profile is deliberately compact.
 * It is NOT the internal Worker matching profile and must never grow by copying
 * operational fields from app_profiles. Task-relevant capability evidence
 * belongs to the concrete Application/snapshot authority.
 */
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
  uloga: Uloga;
  ime: string | null;
  avatarPutanja: string | null;
  grad: string | null;
  naslov: string | null;
  biografija: string | null;
  poverenje: JavniProfilPoverenje;
};

export type StanjePrijave =
  | 'IZBORNA'
  | 'IZABRANA'
  | 'POPUNJENO'
  | 'STALE_REVIEW_REQUIRED'
  | 'POVUCENA'
  | 'ZATVORENA';

export type KandidatProjekcija = {
  /** Id prijave, ne id osobe. Izbor bira prijavu. */
  prijavaId: string;
  /** Bezbedan profile id za javni profil; nikada auth/account id. */
  radnikProfilId: string;
  /** Tačna verzija prijave. Izbor je veže; bez nje izbor nije atomski. */
  verzija: number;
  hash: string;
  ime: string;
  inicijali: string;
  ocenaTekst: string;
  recenzijeTekst: string;
  cena: Novac;
  pokrivaMesta: number;
  dolazakTekst: string;
  prevozTekst: string;
  stanje: StanjePrijave;
  /**
   * Zašto je predložen — ljudski razlog, nikad procenat.
   * null znači da nije preporučen.
   */
  razlogPreporuke: string | null;
};

export type StanjeMojePrijave =
  | 'SUBMITTED'
  | 'VIEWED'
  | 'SHORTLISTED'
  | 'STALE_REVIEW_REQUIRED'
  | 'WITHDRAWN'
  | 'SELECTED'
  | 'CLOSED';

/** RU-5 / P0C-03 — Worker-facing own Application lifecycle DTO. */
export type MojaPrijavaProjekcija = {
  prijavaId: string;
  potrebaId: string;
  potrebaRevizija: number;
  prijavaRevizija: number;
  prijavaVerzija: number;
  stanje: StanjeMojePrijave;
  naslov: string;
  opis: string;
  cena: Novac;
  pokrivaMesta: number;
  napomena: string;
  podrucjeTekst: string;
  vremeTekst: string;
  dogovorId: string | null;
  promenjenaPotreba: boolean;
  mozePovuci: boolean;
  traziPaznju: boolean;
};

/* --------------------------------------------------------------- Dogovor */

/** M07: merdevine Krenuo/Stigao su penzionisane. Ovo je ceo skup. */
export type StanjeDogovora =
  | 'CONFIRMED'
  | 'AWAITING_REQUESTER'
  | 'COMPLETED'
  | 'CANCELLED';

export type UcesnikProjekcija = {
  id: string;
  ime: string;
  inicijali: string;
  uloga: Uloga;
  mesta: number | null;
  viSte: boolean;
  /** Telefon je eksplicitna usmerena saglasnost. null = nije podeljen VAMA. */
  telefon: string | null;
};

/**
 * M04 — režim izvršenja određuje da li tačna lokacija uopšte postoji.
 * Daljinski Dogovor nema fizičku adresu i ne sme da je traži.
 */
export type RezimIzvrsenja = 'FIZICKI' | 'DALJINSKI' | 'PREUZIMANJE_DOSTAVA';

/**
 * Deljenje je USMERENO. To što sam ja podelio svoj broj ne znači da vidim njihov,
 * i obrnuto. Jedno polje za oba smera bi bila tiha greška u privatnosti.
 */
export type KontaktProjekcija = {
  /** Podelio sam SVOJ broj sa drugom stranom. */
  mojTelefonPodeljen: boolean;
  /** Njihov broj — postoji samo ako su ga oni podelili SA MNOM. */
  njihovTelefon: string | null;
  /** Ima li ovaj režim uopšte tačnu lokaciju. */
  lokacijaPostoji: boolean;
  /** Tačna adresa — tek kada pravila Dogovora to dozvole. */
  tacnaLokacija: string | null;
  /** Email nije standardno deljeno polje. Stoji ovde da se ne bi „slučajno" dodao. */
  readonly emailNijeDeljen: true;
};

export type DogovorProjekcija = {
  id: string;
  /** Prihvaćena verzija je autoritativna. */
  verzija: number;
  naslov: string;
  stanje: StanjeDogovora;
  cena: Novac;
  vremeTekst: string;
  putanjaTekst: string;
  pokrivenost: Pokrivenost;
  ucesnici: UcesnikProjekcija[];
  rezim: RezimIzvrsenja;
  kontakt: KontaktProjekcija;
  /** M04: chat radi nezavisno od grantova za privatne podatke. */
  chatDostupan: boolean;
  /**
   * M07: server drži prozor; klijent ga samo prikazuje.
   * Nikad ne računati rok na klijentu — sat na telefonu nije autoritet.
   */
  rokPotvrdeIso: string | null;
  /** Otvoren problem blokira automatsko zatvaranje. */
  problemOtvoren: boolean;
  /** Ocena je moguća tek posle kanonskog završetka, ne pre. */
  ocenaMoguca: boolean;
  /** Hronologija je deo Pregleda, ne treći tab. */
  hronologija: { vremeTekst: string; tekst: string }[];
};

/* ------------------------------------------------- AI nacrt Potrebe (R02) */

/**
 * Preslikano iz donorovog `ai_structured_facts` — KEEP odluka.
 * Taj model već nosi tačno ono što kanon traži, pa se ne izmišlja nov.
 *
 * Pravilo: AI_PROPOSED → HUMAN_CONFIRMED → CANONICAL_SAVED.
 * AI ne sme da izmisli činjenicu i sačuva je kao korisnikovu potvrđenu.
 */
export type StatusCinjenice = 'POTVRDJENO' | 'ZAKLJUCENO' | 'TRAZI_POTVRDU' | 'NEPOZNATO';

/** Poreklo je odvojeno od statusa — po njemu se vidi šta je AI zaključio. */
export type IzvorCinjenice = 'KORISNIK' | 'PROFIL' | 'AI_ZAKLJUCAK' | 'SISTEM';

export type KljucCinjenice =
  | 'naslov'
  | 'opis'
  | 'kategorija'
  | 'datum'
  | 'vreme'
  | 'polaziste'
  | 'odrediste'
  | 'osoba'
  | 'vozilo'
  | 'uslovi';

export type Cinjenica = {
  id: string;
  kljuc: KljucCinjenice;
  /** Već formatirano za prikaz — kartica ne formatira sama. */
  prikaz: string;
  status: StatusCinjenice;
  izvor: IzvorCinjenice;
  /** Citat iz razgovora na osnovu kog je zaključeno. Bez njega nema provere. */
  citat: string | null;
};

export type OdlukaBezbednosti = 'ALLOW' | 'CLARIFY' | 'REVIEW' | 'BLOCK';

/**
 * JEDNO autoritativno stanje nacrta.
 *
 * Chat i live kartica su DVE PROJEKCIJE ovoga — ne dva stanja.
 * Ako korisnik kaže „ipak u 18h", stara činjenica se potiskuje, a obe
 * projekcije odmah vide isto. Paralelno stanje za karticu je zabranjeno.
 */
export type NacrtPotrebeProjekcija = {
  razgovorId: string;
  /** Samo aktuelne — potisnute se ne projektuju. */
  cinjenice: Cinjenica[];
  /** Šta AI još ne zna, pa mora ciljano da pita. */
  nedostaje: KljucCinjenice[];
  /** Server je autoritet; UI prikazuje ishod bez internog obrazloženja. */
  bezbednost: OdlukaBezbednosti;
  bezbednostPoruka: string | null;
  /** Objava je moguća tek kad je sve što je obavezno potvrđeno. */
  spremnoZaObjavu: boolean;
};

export type PorukaRazgovora = {
  id: string;
  odAI: boolean;
  telo: string;
  /** Činjenice koje je ova poruka predložila — veza chata i kartice. */
  predlozene: string[];
};

export type PorukaProjekcija = {
  id: string;
  posiljalacIme: string;
  moja: boolean;
  telo: string;
  vremeTekst: string;
  procitano: boolean;
};