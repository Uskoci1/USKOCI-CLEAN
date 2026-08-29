/**
 * M04 — PRIVACY, CONTACT & CHAT
 *
 * Deljenje telefona je USMERENO. Najlakša greška u privatnosti je jedno polje
 * za oba smera — pa se ispadne da je korisnik "podelio" tuđi broj sebi.
 * Ovi testovi postoje da se to nikad ne desi neprimećeno.
 */

import {
  lazniIzvor as izvor,
  resetujLazniIzvor,
  drugaStranaPodeliTelefon,
} from '../lazniIzvor';

async function napraviDogovor(): Promise<string> {
  const potreba = (await izvor.potreba('ormar'))!;
  const kandidati = await izvor.prijaveZaPotrebu('ormar');
  const k = kandidati.find((c) => c.pokrivaMesta === 1)!;
  const ishod = await izvor.izaberiPrijavu({
    clientRequestId: 'm04-1',
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

describe('M04 — telefon je usmerena saglasnost', () => {
  it('nov Dogovor nema nijedan podeljen broj', async () => {
    const id = await napraviDogovor();
    const d = (await izvor.dogovor(id))!;
    expect(d.kontakt.mojTelefonPodeljen).toBe(false);
    expect(d.kontakt.njihovTelefon).toBeNull();
  });

  it('kad JA podelim broj, NE dobijam njihov', async () => {
    const id = await napraviDogovor();
    await izvor.podeliTelefon(id);

    const d = (await izvor.dogovor(id))!;
    expect(d.kontakt.mojTelefonPodeljen).toBe(true);
    expect(d.kontakt.njihovTelefon).toBeNull(); // ključno: deljenje nije razmena
  });

  it('njihov broj se pojavljuje tek kad ga ONI podele', async () => {
    const id = await napraviDogovor();
    drugaStranaPodeliTelefon(id);

    const d = (await izvor.dogovor(id))!;
    expect(d.kontakt.njihovTelefon).not.toBeNull();
    expect(d.kontakt.mojTelefonPodeljen).toBe(false); // moje deljenje se nije desilo
  });

  it('opoziv sklanja samo moj broj, njihov ostaje', async () => {
    const id = await napraviDogovor();
    await izvor.podeliTelefon(id);
    drugaStranaPodeliTelefon(id);

    await izvor.opoziviTelefon(id);

    const d = (await izvor.dogovor(id))!;
    expect(d.kontakt.mojTelefonPodeljen).toBe(false);
    expect(d.kontakt.njihovTelefon).not.toBeNull();
  });
});

describe('M04 — lokacija je vezana za režim', () => {
  it('tačna adresa se ne vidi dok se ne otkrije', async () => {
    const id = await napraviDogovor();
    const d = (await izvor.dogovor(id))!;
    expect(d.kontakt.lokacijaPostoji).toBe(true); // fizički režim
    expect(d.kontakt.tacnaLokacija).toBeNull();
  });

  it('otkrivanje daje adresu za fizički Dogovor', async () => {
    const id = await napraviDogovor();
    const ishod = await izvor.otkrijTacnuLokaciju(id);
    expect(ishod.ok).toBe(true);

    const d = (await izvor.dogovor(id))!;
    expect(d.kontakt.tacnaLokacija).not.toBeNull();
  });
});

describe('M04 — chat ne zavisi od privatnih grantova', () => {
  it('poruke rade i kad nijedan broj nije podeljen', async () => {
    const id = await napraviDogovor();
    const d = (await izvor.dogovor(id))!;
    expect(d.kontakt.mojTelefonPodeljen).toBe(false);
    expect(d.kontakt.njihovTelefon).toBeNull();
    expect(d.chatDostupan).toBe(true);

    const poslato = await izvor.posaljiPoruku(id, 'Stižem u 17h.');
    expect(poslato.ok).toBe(true);
    expect(await izvor.poruke(id)).toHaveLength(1);
  });
});

describe('M04 — email nije standardno deljeno polje', () => {
  it('projekcija kontakta nema email ni kao opciju', async () => {
    const id = await napraviDogovor();
    const d = (await izvor.dogovor(id))!;
    expect(Object.keys(d.kontakt)).not.toContain('email');
    expect(d.kontakt.emailNijeDeljen).toBe(true);
  });
});
