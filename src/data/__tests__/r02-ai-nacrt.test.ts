/**
 * R02 — AI INTAKE, JEDAN AUTORITATIVAN NACRT
 *
 * Vlasnikovo pravilo: chat i live kartica su dve PROJEKCIJE istog stanja.
 * Najvažniji test je „ipak u 18h" — ako kartica ima svoj state, ostaće 17h
 * u kartici a 18h u chatu. Ovde se dokazuje da to ne može da se desi.
 *
 * I: AI_PROPOSED → HUMAN_CONFIRMED → CANONICAL_SAVED.
 * AI nikad ne upisuje POTVRDJENO.
 */

import { lazniIzvor as izvor, resetujLazniIzvor } from '../lazniIzvor';

const RECENICA =
  'Treba mi sutra oko 17h dvojica sa kombijem da prebace ormar sa Limana na Detelinaru.';

async function otvori() {
  const o = await izvor.otvoriRazgovor();
  if (!o.ok) throw new Error('razgovor nije otvoren');
  return o.podatak.razgovorId;
}

function vrednost(nacrt: { cinjenice: { kljuc: string; prikaz: string }[] }, kljuc: string) {
  return nacrt.cinjenice.find((c) => c.kljuc === kljuc)?.prikaz;
}

beforeEach(() => resetujLazniIzvor());

describe('R02 — AI predlaže, ne potvrđuje', () => {
  it('iz jedne rečenice izvlači strukturu i sve stavlja na potvrdu', async () => {
    const id = await otvori();
    await izvor.posaljiKorisnikovuPoruku(id, RECENICA);

    const stanje = (await izvor.razgovor(id))!;
    const n = stanje.nacrt;

    expect(vrednost(n, 'datum')).toBe('Sutra');
    expect(vrednost(n, 'vreme')).toBe('17:00');
    expect(vrednost(n, 'osoba')).toBe('2 osobe');
    expect(vrednost(n, 'vozilo')).toBe('Kombi');
    expect(vrednost(n, 'polaziste')).toBe('Limana');
    expect(vrednost(n, 'odrediste')).toBe('Detelinaru');
    expect(vrednost(n, 'naslov')).toContain('ormar');

    // Ključno: ništa nije potvrđeno samo zato što je AI to razumeo.
    expect(n.cinjenice.every((c) => c.status !== 'POTVRDJENO')).toBe(true);
    expect(n.spremnoZaObjavu).toBe(false);
  });

  it('razlikuje ono što je korisnik rekao od onoga što je AI zaključio', async () => {
    const id = await otvori();
    await izvor.posaljiKorisnikovuPoruku(id, RECENICA);
    const n = (await izvor.razgovor(id))!.nacrt;

    const vreme = n.cinjenice.find((c) => c.kljuc === 'vreme')!;
    const naslov = n.cinjenice.find((c) => c.kljuc === 'naslov')!;

    expect(vreme.izvor).toBe('KORISNIK');        // doslovno rečeno
    expect(naslov.izvor).toBe('AI_ZAKLJUCAK');   // izvedeno
    expect(naslov.citat).not.toBeNull();          // mora da postoji osnov
  });
});

describe('R02 — ispravka potiskuje, ne ostavlja dva stanja', () => {
  it('„ipak u 18h" menja jedinu aktuelnu vrednost vremena', async () => {
    const id = await otvori();
    await izvor.posaljiKorisnikovuPoruku(id, RECENICA);
    expect(vrednost((await izvor.razgovor(id))!.nacrt, 'vreme')).toBe('17:00');

    await izvor.posaljiKorisnikovuPoruku(id, 'Ipak u 18h.');

    const n = (await izvor.razgovor(id))!.nacrt;
    const vremena = n.cinjenice.filter((c) => c.kljuc === 'vreme');

    // Ovo je suština: JEDNA aktuelna činjenica za vreme, i to nova.
    expect(vremena).toHaveLength(1);
    expect(vremena[0].prikaz).toBe('18:00');
  });

  it('potvrda potisnute činjenice se odbija', async () => {
    const id = await otvori();
    await izvor.posaljiKorisnikovuPoruku(id, RECENICA);
    const staroVreme = (await izvor.razgovor(id))!.nacrt.cinjenice.find((c) => c.kljuc === 'vreme')!;

    await izvor.posaljiKorisnikovuPoruku(id, 'Ipak u 18h.');

    const ishod = await izvor.potvrdiCinjenicu(staroVreme.id);
    expect(ishod.ok).toBe(false);
    if (ishod.ok) return;
    expect(ishod.kod).toBe('SUPERSEDED');
  });

  it('ručna ispravka takođe potiskuje i odmah je potvrđena', async () => {
    const id = await otvori();
    await izvor.posaljiKorisnikovuPoruku(id, RECENICA);
    const naslov = (await izvor.razgovor(id))!.nacrt.cinjenice.find((c) => c.kljuc === 'naslov')!;

    await izvor.ispraviCinjenicu(naslov.id, 'Selidba ormara');

    const n = (await izvor.razgovor(id))!.nacrt;
    const naslovi = n.cinjenice.filter((c) => c.kljuc === 'naslov');
    expect(naslovi).toHaveLength(1);
    expect(naslovi[0].prikaz).toBe('Selidba ormara');
    expect(naslovi[0].status).toBe('POTVRDJENO');
    expect(naslovi[0].izvor).toBe('KORISNIK');
  });
});

describe('R02 — objava zahteva ljudsku potvrdu', () => {
  it('ne objavljuje dok obavezni podaci nisu potvrđeni', async () => {
    const id = await otvori();
    await izvor.posaljiKorisnikovuPoruku(id, RECENICA);

    const ishod = await izvor.objaviPotrebu(id);
    expect(ishod.ok).toBe(false);
    if (ishod.ok) return;
    expect(ishod.kod).toBe('UNCONFIRMED');
  });

  it('objavljuje kad je sve obavezno potvrđeno', async () => {
    const id = await otvori();
    await izvor.posaljiKorisnikovuPoruku(id, RECENICA);

    const n = (await izvor.razgovor(id))!.nacrt;
    for (const c of n.cinjenice) await izvor.potvrdiCinjenicu(c.id);

    const posle = (await izvor.razgovor(id))!.nacrt;
    expect(posle.spremnoZaObjavu).toBe(true);

    const ishod = await izvor.objaviPotrebu(id);
    expect(ishod.ok).toBe(true);
  });

  it('traži podatak koji nedostaje umesto da ga izmisli', async () => {
    const id = await otvori();
    await izvor.posaljiKorisnikovuPoruku(id, 'Treba mi pomoć sutra u 17h.');

    const stanje = (await izvor.razgovor(id))!;
    expect(stanje.nacrt.nedostaje.length).toBeGreaterThan(0);

    // Poslednja AI poruka mora da bude ciljano pitanje, ne izmišljen podatak.
    const zadnja = stanje.poruke.filter((p) => p.odAI).slice(-1)[0];
    expect(zadnja.telo).toMatch(/\?$/);
  });
});

describe('R02 — safety gate', () => {
  it('blokira nedozvoljen sadržaj i ne objavljuje ga', async () => {
    const id = await otvori();
    await izvor.posaljiKorisnikovuPoruku(id, 'Treba mi neko da prenese oružje sutra u 17h.');

    const n = (await izvor.razgovor(id))!.nacrt;
    expect(n.bezbednost).toBe('BLOCK');

    const ishod = await izvor.objaviPotrebu(id);
    expect(ishod.ok).toBe(false);
    if (ishod.ok) return;
    expect(ishod.kod).toBe('BLOCKED');
  });

  it('kratak nejasan unos traži pojašnjenje umesto pogađanja', async () => {
    const id = await otvori();
    await izvor.posaljiKorisnikovuPoruku(id, 'pomoc');
    const n = (await izvor.razgovor(id))!.nacrt;
    expect(n.bezbednost).toBe('CLARIFY');
    expect(n.cinjenice).toHaveLength(0);
  });
});
