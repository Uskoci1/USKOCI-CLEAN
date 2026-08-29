/**
 * Lažni izvor — ista vrata kroz koja će ići Supabase.
 *
 * Namerno nije "samo mock": poštuje idempotenciju, odbija zastarelu reviziju i
 * pri izboru stvarno pravi Dogovor sa pokrivenošću i aktiviranim Povezivanjem.
 * Ako to ne radi ovde, ekran nikad neće biti napisan da to obradi, pa će pući
 * onog dana kad se uključi pravi server.
 *
 * M02 pravilo: izbor atomski pravi CONFIRMED Dogovor. Nema treće potvrde.
 */

import type {
  DogovorProjekcija,
  KontaktProjekcija,
  RezimIzvrsenja,
  KandidatProjekcija,
  Novac,
  PorukaProjekcija,
  PotrebaProjekcija,
  PrilikaProjekcija,
} from '../contracts/projections';
import type { Ishod, IzborKomanda, IzmenaKomanda, Izvor } from './ports';
import { ulogaSada } from '../store/uloga';
import { lazniAi, resetujAi } from './lazniAi';

const rsd = (iznos: number): Novac => ({
  iznos,
  valuta: 'RSD',
  prikaz: `${iznos.toLocaleString('sr-Latn-RS')} RSD`,
});

function pokrivenost(ukupno: number, popunjeno: number) {
  const preostalo = Math.max(0, ukupno - popunjeno);
  return { ukupno, popunjeno, preostalo, udeo: ukupno ? popunjeno / ukupno : 0 };
}

const UKUPNO_MESTA = 2;

type Kandidat = Omit<KandidatProjekcija, 'stanje' | 'razlogPreporuke'>;

const KANDIDATI: Kandidat[] = [
  { prijavaId: 'p-marko', verzija: 2, hash: 'h-marko-2', ime: 'Marko Ilić', inicijali: 'MI', ocenaTekst: '5,0', recenzijeTekst: '11 recenzija', cena: rsd(5200), pokrivaMesta: 2, dolazakTekst: 'Sutra · 17:00', prevozTekst: 'Kombi' },
  { prijavaId: 'p-jelena', verzija: 1, hash: 'h-jelena-1', ime: 'Jelena Marković', inicijali: 'JM', ocenaTekst: '4,9', recenzijeTekst: '32 recenzije', cena: rsd(4800), pokrivaMesta: 2, dolazakTekst: 'Sutra · 16:30', prevozTekst: 'Kombi' },
  { prijavaId: 'p-nikola', verzija: 1, hash: 'h-nikola-1', ime: 'Nikola Petrović', inicijali: 'NP', ocenaTekst: '—', recenzijeTekst: 'Nov Uskočer', cena: rsd(4500), pokrivaMesta: 1, dolazakTekst: 'Sutra · posle 15h', prevozTekst: 'Kombi' },
  { prijavaId: 'p-ivana', verzija: 1, hash: 'h-ivana-1', ime: 'Ivana Kostić', inicijali: 'IK', ocenaTekst: '4,9', recenzijeTekst: '27 recenzija', cena: rsd(2300), pokrivaMesta: 1, dolazakTekst: 'Sutra · posle 15h', prevozTekst: 'Bez vozila' },
  { prijavaId: 'p-ana', verzija: 1, hash: 'h-ana-1', ime: 'Ana Vasić', inicijali: 'AV', ocenaTekst: '4,8', recenzijeTekst: '19 recenzija', cena: rsd(4600), pokrivaMesta: 1, dolazakTekst: 'Sutra · 16:00', prevozTekst: 'Automobil' },
];

/* -------------------------------------------------------------- stanje */

type Alokacija = {
  dogovorId: string;
  prijavaId: string;
  mesta: number;
  /** Povezivanje za V1 ima cenu 0 — ali se i dalje beleži, kao potrošnja po pokrivenoj osobi. */
  povezivanjeIznos: number;
};

type Deljenje = {
  /** Ja sam podelio SVOJ broj. */
  jaPodelio: boolean;
  /** Druga strana je podelila SVOJ broj sa mnom. */
  oniPodelili: boolean;
  lokacijaOtkrivena: boolean;
};

type Zavrsetak = {
  stanje: 'CONFIRMED' | 'AWAITING_REQUESTER' | 'COMPLETED';
  /** Server postavlja rok. Klijent ga NE računa. */
  rokPotvrdeMs: number | null;
  problemOtvoren: boolean;
};

type Stanje = {
  potrebaRevizija: number;
  deljenje: Record<string, Deljenje>;
  zavrsetak: Record<string, Zavrsetak>;
  /** Serverski sat. Testovi ga pomeraju; klijent ga nikad ne dira. */
  sadaMs: number;
  alokacije: Alokacija[];
  dogovorVerzija: Record<string, number>;
  idempotencija: Map<string, string>;
  poruke: Record<string, PorukaProjekcija[]>;
  brojac: number;
};

const POCETNO: Stanje = {
  potrebaRevizija: 3,
  deljenje: {},
  zavrsetak: {},
  sadaMs: Date.UTC(2026, 7, 29, 12, 0, 0),
  alokacije: [],
  dogovorVerzija: {},
  idempotencija: new Map(),
  poruke: {},
  brojac: 0,
};

let stanje: Stanje = struktuiraj(POCETNO);

function struktuiraj(s: Stanje): Stanje {
  return {
    potrebaRevizija: s.potrebaRevizija,
    deljenje: JSON.parse(JSON.stringify(s.deljenje)),
    zavrsetak: JSON.parse(JSON.stringify(s.zavrsetak)),
    sadaMs: s.sadaMs,
    alokacije: [...s.alokacije],
    dogovorVerzija: { ...s.dogovorVerzija },
    idempotencija: new Map(s.idempotencija),
    poruke: { ...s.poruke },
    brojac: s.brojac,
  };
}

/** Samo za testove — vraća izvor na poznato stanje. */
export function resetujLazniIzvor() {
  stanje = struktuiraj(POCETNO);
  resetujAi();
}

const PROZOR_MS = 48 * 3600 * 1000;

function zavrsetakZa(id: string): Zavrsetak {
  return stanje.zavrsetak[id] ?? { stanje: 'CONFIRMED', rokPotvrdeMs: null, problemOtvoren: false };
}

/**
 * Serverski tick. Zatvara Dogovore kojima je prozor istekao I nisu blokirani
 * problemom. Ovo radi server, ne ekran — zato je ovde, a ne u komponenti.
 */
function serverskiTick() {
  for (const [id, z] of Object.entries(stanje.zavrsetak)) {
    if (z.stanje !== 'AWAITING_REQUESTER') continue;
    if (z.problemOtvoren) continue;
    if (z.rokPotvrdeMs !== null && stanje.sadaMs >= z.rokPotvrdeMs) {
      stanje.zavrsetak[id] = { ...z, stanje: 'COMPLETED', rokPotvrdeMs: null };
    }
  }
}

/** Samo za testove — pomera serverski sat i pušta tick. */
export function pomeriServerskiSat(sati: number) {
  stanje.sadaMs += sati * 3600 * 1000;
  serverskiTick();
}

/** Samo za testove — simulira da je Naručilac materijalno izmenio Potrebu. */
export function izmeniPotrebuMaterijalno() {
  stanje.potrebaRevizija += 1;
}

function popunjeno() {
  return stanje.alokacije.reduce((n, a) => n + a.mesta, 0);
}

/** Ljudski razlog, nikad procenat. M09 zabranjuje sirov matcher skor u UI. */
function razlog(k: Kandidat, preostalo: number): string {
  if (k.pokrivaMesta >= preostalo && k.ocenaTekst !== '—') return 'pokriva sva preostala mesta, najviša ocena';
  if (k.pokrivaMesta >= preostalo) return 'pokriva sva preostala mesta';
  return 'najbolji sklop ocene i dolaska';
}

const kasnjenje = () => new Promise((r) => setTimeout(r, 60));

/**
 * Režim pripada Dogovoru, ne aplikaciji. Daljinski Dogovor nema fizičku adresu
 * i ne sme da je traži — zato se ovo pita po Dogovoru, a ne globalno.
 */
function rezimZa(_dogovorId: string): RezimIzvrsenja {
  return 'FIZICKI';
}

function deljenjeZa(dogovorId: string): Deljenje {
  return stanje.deljenje[dogovorId] ?? { jaPodelio: false, oniPodelili: false, lokacijaOtkrivena: false };
}

function kontaktZa(dogovorId: string): KontaktProjekcija {
  const d = deljenjeZa(dogovorId);
  const lokacijaPostoji = rezimZa(dogovorId) !== 'DALJINSKI';
  return {
    mojTelefonPodeljen: d.jaPodelio,
    // Njihov broj se vidi SAMO ako su ga oni podelili. Moje deljenje ovde ne učestvuje.
    njihovTelefon: d.oniPodelili ? '+381 63 555 0142' : null,
    lokacijaPostoji,
    tacnaLokacija: lokacijaPostoji && d.lokacijaOtkrivena ? 'Bulevar oslobođenja 76, 4. sprat' : null,
    emailNijeDeljen: true,
  };
}

function dogovorIz(a: Alokacija): DogovorProjekcija {
  const k = KANDIDATI.find((c) => c.prijavaId === a.prijavaId)!;
  const z = zavrsetakZa(a.dogovorId);
  const jaSamNarucilac = ulogaSada() === 'narucilac';
  return {
    id: a.dogovorId,
    verzija: stanje.dogovorVerzija[a.dogovorId] ?? 1,
    naslov: 'Prenos ormara sa Limana na Detelinaru',
    stanje: z.stanje,
    cena: k.cena,
    vremeTekst: k.dolazakTekst,
    putanjaTekst: 'Liman → Detelinara',
    pokrivenost: pokrivenost(UKUPNO_MESTA, popunjeno()),
    // M01: projekcija je vezana za ulogu. Isti Dogovor, druga strana —
    // bez ijedne grane `if (uloga)` u komponenti.
    ucesnici: [
      {
        id: 'narucilac',
        ime: jaSamNarucilac ? 'Vi' : 'Miloš',
        inicijali: jaSamNarucilac ? 'VI' : 'MŠ',
        uloga: 'narucilac',
        mesta: null,
        viSte: jaSamNarucilac,
        telefon: null,
      },
      {
        id: k.prijavaId,
        ime: jaSamNarucilac ? k.ime : 'Vi',
        inicijali: jaSamNarucilac ? k.inicijali : 'VI',
        uloga: 'uskocer',
        mesta: a.mesta,
        viSte: !jaSamNarucilac,
        telefon: null,
      },
    ],
    rezim: rezimZa(a.dogovorId),
    kontakt: kontaktZa(a.dogovorId),
    // M04: chat ne zavisi od grantova za privatne podatke.
    chatDostupan: true,
    rokPotvrdeIso: z.rokPotvrdeMs === null ? null : new Date(z.rokPotvrdeMs).toISOString(),
    problemOtvoren: z.problemOtvoren,
    // Ocena tek posle kanonskog završetka — ne pre.
    ocenaMoguca: z.stanje === 'COMPLETED',
    hronologija: [
      { vremeTekst: 'sada', tekst: 'Dogovor je potvrđen' },
      {
        vremeTekst: 'sada',
        tekst:
          a.povezivanjeIznos === 0
            ? `Povezivanje aktivirano · bez naknade · ${a.mesta} ${a.mesta === 1 ? 'osoba' : 'osobe'}`
            : `Povezivanje aktivirano · ${a.povezivanjeIznos}`,
      },
    ],
  };
}

async function potrebaProjekcija(): Promise<PotrebaProjekcija> {
  const p = pokrivenost(UKUPNO_MESTA, popunjeno());
  return {
    id: 'ormar',
    revizija: stanje.potrebaRevizija,
    naslov: 'Prenos ormara sa Limana na Detelinaru',
    opis: 'Preuzeti, preneti i uneti veliki ormar na drugoj lokaciji.',
    stanje: p.preostalo === 0 ? 'POPUNJENA' : p.popunjeno > 0 ? 'DELIMICNO_POPUNJENA' : 'CEKA_PRIJAVE',
    pokrivenost: p,
    vremeTekst: 'Sutra · posle 15h',
    podrucjeTekst: 'Liman → Detelinara',
    uslovi: ['Kombi', '4. sprat', 'Nema lifta'],
    brojPrijava: KANDIDATI.length,
  };
}

/* --------------------------------------------------------------- izvor */

export const lazniIzvor: Izvor = {
  poreklo: 'lazni',

  // R02 — AI intake. Isti port, pa zamena Supabaseom ne dira ekran.
  otvoriRazgovor: lazniAi.otvoriRazgovor,
  razgovor: lazniAi.razgovor,
  posaljiKorisnikovuPoruku: lazniAi.posaljiKorisnikovuPoruku,
  potvrdiCinjenicu: lazniAi.potvrdiCinjenicu,
  ispraviCinjenicu: lazniAi.ispraviCinjenicu,
  objaviPotrebu: lazniAi.objaviPotrebu,

  async mojePotrebe() {
    await kasnjenje();
    return [await potrebaProjekcija()];
  },

  async potreba(id) {
    await kasnjenje();
    return id === 'ormar' ? potrebaProjekcija() : null;
  },

  async otvorenePrilike() {
    await kasnjenje();
    return [
      {
        id: 'ormar',
        naslov: 'Prenos ormara sa Limana na Detelinaru',
        statusTekst: 'Tražim ponude',
        podrucjeTekst: 'Liman → Detelinara',
        vremeTekst: 'Sutra · posle 15h',
        pokrivenost: pokrivenost(UKUPNO_MESTA, popunjeno()),
        uslovi: ['Kombi', '4. sprat', 'Nema lifta'],
        narucilacIme: 'Miloš',
        narucilacOcena: '4,9',
        priblizno: { lat: 45.2396, lng: 19.8227 },
      } satisfies PrilikaProjekcija,
    ];
  },

  async prilika(id) {
    const sve = await this.otvorenePrilike();
    return sve.find((p) => p.id === id) ?? null;
  },

  async prijaveZaPotrebu() {
    await kasnjenje();
    const preostalo = Math.max(0, UKUPNO_MESTA - popunjeno());
    const izabraniIds = stanje.alokacije.map((a) => a.prijavaId);
    const slobodni = KANDIDATI.filter((k) => !izabraniIds.includes(k.prijavaId));

    return KANDIDATI.map((k) => {
      const izabran = izabraniIds.includes(k.prijavaId);
      const prviSlobodan = slobodni[0]?.prijavaId === k.prijavaId;
      return {
        ...k,
        stanje: izabran ? 'IZABRANA' : preostalo === 0 ? 'POPUNJENO' : 'IZBORNA',
        razlogPreporuke: !izabran && prviSlobodan && preostalo > 0 ? razlog(k, preostalo) : null,
      } satisfies KandidatProjekcija;
    });
  },

  async mojiDogovori() {
    await kasnjenje();
    return stanje.alokacije.map(dogovorIz);
  },

  async dogovor(id) {
    await kasnjenje();
    const a = stanje.alokacije.find((x) => x.dogovorId === id);
    return a ? dogovorIz(a) : null;
  },

  async poruke(dogovorId) {
    await kasnjenje();
    return stanje.poruke[dogovorId] ?? [];
  },

  /* ------------------------------------------------------------ komande */

  async izaberiPrijavu(k: IzborKomanda): Promise<Ishod<{ dogovorId: string }>> {
    await kasnjenje();

    // Idempotencija: ponovljen zahtev vraća ISTI Dogovor, ne pravi drugi.
    const vec = stanje.idempotencija.get(k.clientRequestId);
    if (vec) return { ok: true, podatak: { dogovorId: vec } };

    // Tačna revizija Potrebe. Ako se promenila, izbor se ne izvršava tiho.
    if (k.potrebaRevizija !== stanje.potrebaRevizija) {
      return {
        ok: false,
        kod: 'STALE_REVIEW_REQUIRED',
        naslov: 'Potreba je izmenjena',
        poruka: 'Prijave su ponovo na proveri jer je Potreba promenjena. Pogledajte ih ponovo pre izbora.',
      };
    }

    const kandidat = KANDIDATI.find((c) => c.prijavaId === k.prijavaId);
    if (!kandidat) return { ok: false, kod: 'NOT_FOUND', poruka: 'Prijava više ne postoji.' };

    // Tačna verzija i hash prijave.
    if (kandidat.verzija !== k.prijavaVerzija || kandidat.hash !== k.prijavaHash) {
      return {
        ok: false,
        kod: 'STALE_REVIEW_REQUIRED',
        naslov: 'Prijava je izmenjena',
        poruka: 'Uskočer je izmenio prijavu otkad ste je pogledali. Proverite je ponovo.',
      };
    }

    if (stanje.alokacije.some((a) => a.prijavaId === k.prijavaId)) {
      return { ok: false, kod: 'ALREADY_SELECTED', naslov: 'Već izabran', poruka: 'Ta prijava je već izabrana.' };
    }

    if (popunjeno() + kandidat.pokrivaMesta > UKUPNO_MESTA) {
      return {
        ok: false,
        kod: 'OVERFILL',
        naslov: 'Previše mesta',
        poruka: 'Ta prijava pokriva više mesta nego što je preostalo.',
      };
    }

    // Atomski: Dogovor + pokrivenost + Povezivanje sa cenom 0. Bez treće potvrde.
    stanje.brojac += 1;
    const dogovorId = `d-${stanje.brojac}`;
    stanje.alokacije.push({
      dogovorId,
      prijavaId: k.prijavaId,
      mesta: kandidat.pokrivaMesta,
      povezivanjeIznos: 0,
    });
    stanje.dogovorVerzija[dogovorId] = 1;
    stanje.poruke[dogovorId] = [];
    stanje.idempotencija.set(k.clientRequestId, dogovorId);

    return { ok: true, podatak: { dogovorId } };
  },

  async oznaciPrijavuVidjenom() {
    return { ok: true, podatak: null };
  },

  async predloziIzmenu(k: IzmenaKomanda) {
    await kasnjenje();
    const trenutna = stanje.dogovorVerzija[k.dogovorId];
    if (trenutna === undefined) return { ok: false, kod: 'NOT_FOUND', poruka: 'Dogovor ne postoji.' };
    if (k.ocekivanaVerzija !== trenutna) {
      return {
        ok: false,
        kod: 'VERSION_CONFLICT',
        naslov: 'Dogovor je u međuvremenu promenjen',
        poruka: 'Osvežite Dogovor pa pokušajte ponovo.',
      };
    }
    return { ok: true, podatak: { predlogId: `pred-${k.dogovorId}-${trenutna}` } };
  },

  async odgovoriNaIzmenu(predlogId, prihvatam) {
    await kasnjenje();
    if (!prihvatam) return { ok: true, podatak: null };
    const dogovorId = predlogId.split('-').slice(1, -1).join('-');
    if (stanje.dogovorVerzija[dogovorId] === undefined) {
      return { ok: false, kod: 'NOT_FOUND', poruka: 'Predlog ne postoji.' };
    }
    // v+1 odmah. Stara verzija ostaje nepromenljiva. Nema petlje potvrda.
    stanje.dogovorVerzija[dogovorId] += 1;
    return { ok: true, podatak: null };
  },

  async posaljiPoruku(dogovorId, telo) {
    await kasnjenje();
    const lista = stanje.poruke[dogovorId] ?? [];
    const id = `m-${dogovorId}-${lista.length + 1}`;
    stanje.poruke[dogovorId] = [
      ...lista,
      { id, posiljalacIme: 'Vi', moja: true, telo, vremeTekst: 'sada', procitano: false },
    ];
    return { ok: true, podatak: { porukaId: id } };
  },

  async otkaziDogovor(dogovorId) {
    await kasnjenje();
    const pre = stanje.alokacije.length;
    // M06: oslobađa se SAMO ta alokacija, ne cela Potreba.
    stanje.alokacije = stanje.alokacije.filter((a) => a.dogovorId !== dogovorId);
    if (stanje.alokacije.length === pre) {
      return { ok: false, kod: 'NOT_FOUND', poruka: 'Dogovor ne postoji.' };
    }
    return { ok: true, podatak: null };
  },

  async oznaciZavrsetak(dogovorId) {
    await kasnjenje();
    if (!stanje.alokacije.some((a) => a.dogovorId === dogovorId)) {
      return { ok: false, kod: 'NOT_FOUND', poruka: 'Dogovor ne postoji.' };
    }
    const z = zavrsetakZa(dogovorId);
    if (z.stanje === 'COMPLETED') {
      return { ok: false, kod: 'ALREADY_COMPLETED', naslov: 'Već je završen', poruka: 'Ovaj Dogovor je već zatvoren.' };
    }
    // Nema merdevina Krenuo/Stigao — ovo je prvi i jedini korak Uskočera.
    const rok = stanje.sadaMs + PROZOR_MS;
    stanje.zavrsetak[dogovorId] = { ...z, stanje: 'AWAITING_REQUESTER', rokPotvrdeMs: rok };
    return { ok: true, podatak: { rokPotvrdeIso: new Date(rok).toISOString() } };
  },

  async potvrdiZavrsetak(dogovorId) {
    await kasnjenje();
    if (!stanje.alokacije.some((a) => a.dogovorId === dogovorId)) {
      return { ok: false, kod: 'NOT_FOUND', poruka: 'Dogovor ne postoji.' };
    }
    // Naručilac može da potvrdi i pre nego što Uskočer bilo šta označi.
    const z = zavrsetakZa(dogovorId);
    stanje.zavrsetak[dogovorId] = { ...z, stanje: 'COMPLETED', rokPotvrdeMs: null };
    return { ok: true, podatak: null };
  },

  async prijaviProblem(dogovorId, opis) {
    await kasnjenje();
    if (!opis.trim()) {
      return { ok: false, kod: 'EMPTY', naslov: 'Opišite problem', poruka: 'Bez opisa ne možemo da pomognemo.' };
    }
    const z = zavrsetakZa(dogovorId);
    if (z.stanje === 'COMPLETED') {
      return { ok: false, kod: 'ALREADY_COMPLETED', naslov: 'Već je završen', poruka: 'Dogovor je zatvoren.' };
    }
    // Problem blokira automatsko zatvaranje po isteku prozora.
    stanje.zavrsetak[dogovorId] = { ...z, problemOtvoren: true };
    return { ok: true, podatak: null };
  },

  async podeliTelefon(dogovorId) {
    await kasnjenje();
    if (!stanje.alokacije.some((a) => a.dogovorId === dogovorId)) {
      return { ok: false, kod: 'NOT_FOUND', poruka: 'Dogovor ne postoji.' };
    }
    const d = deljenjeZa(dogovorId);
    // Deli se SAMO moj broj. Njihov ostaje netaknut.
    stanje.deljenje[dogovorId] = { ...d, jaPodelio: true };
    return { ok: true, podatak: null };
  },

  async opoziviTelefon(dogovorId) {
    await kasnjenje();
    const d = deljenjeZa(dogovorId);
    stanje.deljenje[dogovorId] = { ...d, jaPodelio: false };
    return { ok: true, podatak: null };
  },

  async otkrijTacnuLokaciju(dogovorId) {
    await kasnjenje();
    if (rezimZa(dogovorId) === 'DALJINSKI') {
      return {
        ok: false,
        kod: 'NO_PHYSICAL_LOCATION',
        naslov: 'Daljinski Dogovor',
        poruka: 'Ovaj Dogovor se izvršava daljinski i nema fizičku adresu.',
      };
    }
    const d = deljenjeZa(dogovorId);
    stanje.deljenje[dogovorId] = { ...d, lokacijaOtkrivena: true };
    return { ok: true, podatak: { adresa: 'Bulevar oslobođenja 76, 4. sprat' } };
  },
};

/** Samo za testove — simulira da je DRUGA strana podelila svoj broj. */
export function drugaStranaPodeliTelefon(dogovorId: string) {
  const d = stanje.deljenje[dogovorId] ?? { jaPodelio: false, oniPodelili: false, lokacijaOtkrivena: false };
  stanje.deljenje[dogovorId] = { ...d, oniPodelili: true };
}
