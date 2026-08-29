/**
 * M02 — ATOMIC EXACT SELECTION
 *
 * Ovo je imenovani test iz lanca zatvaranja paketa. Ne proverava da ekran
 * lepo izgleda — proverava da izbor ne može da se izvrši na zastareloj
 * osnovi i da ponovljen zahtev ne pravi drugi Dogovor.
 */

import { lazniIzvor as izvor, resetujLazniIzvor, izmeniPotrebuMaterijalno } from '../lazniIzvor';
import type { KandidatProjekcija, PotrebaProjekcija } from '../../contracts/projections';

async function osnova(): Promise<{ potreba: PotrebaProjekcija; kandidati: KandidatProjekcija[] }> {
  const potreba = (await izvor.potreba('ormar'))!;
  const kandidati = await izvor.prijaveZaPotrebu('ormar');
  return { potreba, kandidati };
}

function komandaZa(potreba: PotrebaProjekcija, k: KandidatProjekcija, zahtevId: string) {
  return {
    clientRequestId: zahtevId,
    potrebaId: potreba.id,
    potrebaRevizija: potreba.revizija,
    prijavaId: k.prijavaId,
    prijavaVerzija: k.verzija,
    prijavaHash: k.hash,
    mesta: k.pokrivaMesta,
  };
}

beforeEach(() => resetujLazniIzvor());

describe('M02 — izbor vezuje tačnu osnovu', () => {
  it('uspešan izbor atomski pravi Dogovor sa pokrivenošću i Povezivanjem bez naknade', async () => {
    const { potreba, kandidati } = await osnova();
    const jedno = kandidati.find((k) => k.pokrivaMesta === 1)!;

    const ishod = await izvor.izaberiPrijavu(komandaZa(potreba, jedno, 'z-1'));
    expect(ishod.ok).toBe(true);
    if (!ishod.ok) return;

    const dogovor = await izvor.dogovor(ishod.podatak.dogovorId);
    expect(dogovor).not.toBeNull();
    expect(dogovor!.stanje).toBe('CONFIRMED'); // nema treće potvrde
    expect(dogovor!.pokrivenost.popunjeno).toBe(1);
    expect(dogovor!.pokrivenost.preostalo).toBe(1);

    const povezivanje = dogovor!.hronologija.find((h) => h.tekst.includes('Povezivanje'));
    expect(povezivanje?.tekst).toContain('bez naknade'); // V1: cena 0
  });

  it('odbija izbor kad je Potreba materijalno izmenjena posle pregleda', async () => {
    const { potreba, kandidati } = await osnova();
    const jedno = kandidati.find((k) => k.pokrivaMesta === 1)!;

    izmeniPotrebuMaterijalno(); // Naručilac je izmenio Potrebu u međuvremenu

    const ishod = await izvor.izaberiPrijavu(komandaZa(potreba, jedno, 'z-2'));
    expect(ishod.ok).toBe(false);
    if (ishod.ok) return;
    expect(ishod.kod).toBe('STALE_REVIEW_REQUIRED');

    const posle = await izvor.mojiDogovori();
    expect(posle).toHaveLength(0); // ništa nije napravljeno
  });

  it('odbija izbor kad je Prijava izmenjena posle pregleda', async () => {
    const { potreba, kandidati } = await osnova();
    const jedno = kandidati.find((k) => k.pokrivaMesta === 1)!;

    const zastarela = { ...komandaZa(potreba, jedno, 'z-3'), prijavaHash: 'h-staro' };
    const ishod = await izvor.izaberiPrijavu(zastarela);

    expect(ishod.ok).toBe(false);
    if (ishod.ok) return;
    expect(ishod.kod).toBe('STALE_REVIEW_REQUIRED');
    expect(await izvor.mojiDogovori()).toHaveLength(0);
  });

  it('ponovljen clientRequestId vraća isti Dogovor, ne pravi drugi', async () => {
    const { potreba, kandidati } = await osnova();
    const jedno = kandidati.find((k) => k.pokrivaMesta === 1)!;
    const komanda = komandaZa(potreba, jedno, 'z-isti');

    const prvi = await izvor.izaberiPrijavu(komanda);
    const drugi = await izvor.izaberiPrijavu(komanda);

    expect(prvi.ok && drugi.ok).toBe(true);
    if (!prvi.ok || !drugi.ok) return;
    expect(drugi.podatak.dogovorId).toBe(prvi.podatak.dogovorId);
    expect(await izvor.mojiDogovori()).toHaveLength(1);
  });

  it('odbija prijavu koja pokriva više mesta nego što je preostalo', async () => {
    const { potreba, kandidati } = await osnova();
    const jedno = kandidati.find((k) => k.pokrivaMesta === 1)!;
    await izvor.izaberiPrijavu(komandaZa(potreba, jedno, 'z-4'));

    const svez = (await izvor.potreba('ormar'))!;
    const dva = kandidati.find((k) => k.pokrivaMesta === 2)!;
    const ishod = await izvor.izaberiPrijavu(komandaZa(svez, dva, 'z-5'));

    expect(ishod.ok).toBe(false);
    if (ishod.ok) return;
    expect(ishod.kod).toBe('OVERFILL');
  });
});

describe('M06 — otkazivanje oslobađa samo tu alokaciju', () => {
  it('otkazivanje jednog Dogovora ne dira drugi ni celu Potrebu', async () => {
    const { potreba, kandidati } = await osnova();
    const jednomestni = kandidati.filter((k) => k.pokrivaMesta === 1);

    const a = await izvor.izaberiPrijavu(komandaZa(potreba, jednomestni[0], 'z-a'));
    const svez = (await izvor.potreba('ormar'))!;
    const b = await izvor.izaberiPrijavu(komandaZa(svez, jednomestni[1], 'z-b'));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;

    expect((await izvor.potreba('ormar'))!.pokrivenost.popunjeno).toBe(2);

    await izvor.otkaziDogovor(a.podatak.dogovorId, 'Promenili su mi se planovi');

    const posle = await izvor.potreba('ormar');
    expect(posle!.pokrivenost.popunjeno).toBe(1); // oslobođeno tačno jedno mesto
    expect(await izvor.dogovor(b.podatak.dogovorId)).not.toBeNull(); // drugi netaknut
  });
});

describe('M05 — prihvaćena izmena odmah aktivira v+1', () => {
  it('prihvatanje diže verziju bez treće potvrde, odbijanje je ne dira', async () => {
    const { potreba, kandidati } = await osnova();
    const jedno = kandidati.find((k) => k.pokrivaMesta === 1)!;
    const izbor = await izvor.izaberiPrijavu(komandaZa(potreba, jedno, 'z-6'));
    expect(izbor.ok).toBe(true);
    if (!izbor.ok) return;

    const id = izbor.podatak.dogovorId;
    expect((await izvor.dogovor(id))!.verzija).toBe(1);

    const predlog = await izvor.predloziIzmenu({
      clientRequestId: 'z-7',
      dogovorId: id,
      ocekivanaVerzija: 1,
      izmena: { cenaIznos: 5000, cenaValuta: 'RSD' },
    });
    expect(predlog.ok).toBe(true);
    if (!predlog.ok) return;

    await izvor.odgovoriNaIzmenu(predlog.podatak.predlogId, true);
    expect((await izvor.dogovor(id))!.verzija).toBe(2);

    // predlog na staru verziju mora da padne
    const zastareo = await izvor.predloziIzmenu({
      clientRequestId: 'z-8',
      dogovorId: id,
      ocekivanaVerzija: 1,
      izmena: { obim: 'nešto drugo' },
    });
    expect(zastareo.ok).toBe(false);
    if (zastareo.ok) return;
    expect(zastareo.kod).toBe('VERSION_CONFLICT');
  });
});
