/**
 * M07 — COMPLETION & REVIEW
 *
 * Ovo je rupa koju je HTML referenca imala: aktivan ekran završetka nije
 * pominjao prozor od 48h ni automatsko zatvaranje. Ovde se to dokazuje.
 *
 * Prozor drži SERVER. Klijent ga nikad ne računa — sat na telefonu nije autoritet.
 */

import {
  lazniIzvor as izvor,
  resetujLazniIzvor,
  pomeriServerskiSat,
} from '../lazniIzvor';

async function napraviDogovor(): Promise<string> {
  const potreba = (await izvor.potreba('ormar'))!;
  const kandidati = await izvor.prijaveZaPotrebu('ormar');
  const k = kandidati.find((c) => c.pokrivaMesta === 1)!;
  const ishod = await izvor.izaberiPrijavu({
    clientRequestId: `m07-${k.prijavaId}`,
    potrebaId: potreba.id,
    potrebaRevizija: potreba.revizija,
    prijavaId: k.prijavaId,
    prijavaVerzija: k.verzija,
    prijavaHash: k.hash,
    mesta: k.pokrivaMesta,
  });
  if (!ishod.ok) throw new Error('izbor nije prošao');
  return ishod.podatak.dogovorId;
}

beforeEach(() => resetujLazniIzvor());

describe('M07 — Uskočer otvara prozor, ne merdevine', () => {
  it('nema koraka pre završetka; označavanje odmah otvara prozor od 48h', async () => {
    const id = await napraviDogovor();
    expect((await izvor.dogovor(id))!.stanje).toBe('CONFIRMED');

    const ishod = await izvor.oznaciZavrsetak(id);
    expect(ishod.ok).toBe(true);
    if (!ishod.ok) return;

    const d = (await izvor.dogovor(id))!;
    expect(d.stanje).toBe('AWAITING_REQUESTER');
    expect(d.rokPotvrdeIso).not.toBeNull();

    const razlikaSati = (Date.parse(ishod.podatak.rokPotvrdeIso) - Date.UTC(2026, 7, 29, 12, 0, 0)) / 3600000;
    expect(razlikaSati).toBe(48);
  });

  it('ocena nije moguća dok Dogovor nije kanonski završen', async () => {
    const id = await napraviDogovor();
    expect((await izvor.dogovor(id))!.ocenaMoguca).toBe(false);

    await izvor.oznaciZavrsetak(id);
    expect((await izvor.dogovor(id))!.ocenaMoguca).toBe(false); // čekanje nije završetak

    await izvor.potvrdiZavrsetak(id);
    expect((await izvor.dogovor(id))!.ocenaMoguca).toBe(true);
  });
});

describe('M07 — serverski tick zatvara kad prozor istekne', () => {
  it('posle 48h bez problema Dogovor se sam zatvara', async () => {
    const id = await napraviDogovor();
    await izvor.oznaciZavrsetak(id);

    pomeriServerskiSat(47);
    expect((await izvor.dogovor(id))!.stanje).toBe('AWAITING_REQUESTER');

    pomeriServerskiSat(2); // ukupno 49h
    const d = (await izvor.dogovor(id))!;
    expect(d.stanje).toBe('COMPLETED');
    expect(d.rokPotvrdeIso).toBeNull();
    expect(d.ocenaMoguca).toBe(true);
  });

  it('prijavljen problem blokira automatsko zatvaranje', async () => {
    const id = await napraviDogovor();
    await izvor.oznaciZavrsetak(id);
    await izvor.prijaviProblem(id, 'Ormar je oštećen pri unosu.');

    pomeriServerskiSat(72); // daleko preko roka

    const d = (await izvor.dogovor(id))!;
    expect(d.stanje).toBe('AWAITING_REQUESTER'); // ne zatvara se samo
    expect(d.problemOtvoren).toBe(true);
    expect(d.ocenaMoguca).toBe(false);
  });

  it('prazan opis problema se odbija', async () => {
    const id = await napraviDogovor();
    await izvor.oznaciZavrsetak(id);
    const ishod = await izvor.prijaviProblem(id, '   ');
    expect(ishod.ok).toBe(false);
  });
});

describe('M07 — Naručilac može nezavisno', () => {
  it('potvrda završetka radi i pre nego što Uskočer bilo šta označi', async () => {
    const id = await napraviDogovor();
    expect((await izvor.dogovor(id))!.stanje).toBe('CONFIRMED');

    const ishod = await izvor.potvrdiZavrsetak(id);
    expect(ishod.ok).toBe(true);

    const d = (await izvor.dogovor(id))!;
    expect(d.stanje).toBe('COMPLETED');
    expect(d.ocenaMoguca).toBe(true);
  });

  it('završen Dogovor se ne može ponovo označiti', async () => {
    const id = await napraviDogovor();
    await izvor.potvrdiZavrsetak(id);

    const ishod = await izvor.oznaciZavrsetak(id);
    expect(ishod.ok).toBe(false);
    if (ishod.ok) return;
    expect(ishod.kod).toBe('ALREADY_COMPLETED');
  });
});
