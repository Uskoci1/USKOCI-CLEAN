// Exact A1 transport title/body pairs, including its urgent opportunity variant
// and both previously shipped generic copies for queued pushes. The runtime
// tests execute the shared Edge formatter to detect any contract drift.
const publicInboxCopies = Object.freeze([
 ['Novi zadatak za tebe', 'Pojavila se nova prilika koja može da ti odgovara.'],
 ['HITNO — nova prilika', 'Pojavila se nova prilika koja može da ti odgovara.'],
 ['Nova prijava', 'Stigla je nova prijava na tvoj zadatak.'],
 ['Prijava je izmenjena', 'Jedna prijava na tvoj zadatak je ažurirana.'],
 ['Prijava je pregledana', 'Tvoja prijava je pregledana.'],
 ['U užem si izboru', 'Tvoja prijava je izdvojena za dalji izbor.'],
 ['Izabran si', 'Tvoja prijava je prihvaćena. Otvori Dogovor.'],
 ['Prijava je završena', 'Za ovaj zadatak je izabrana druga osoba.'],
 ['Proveri prijavu', 'Zadatak je promenjen nakon tvoje prijave.'],
 ['Prijava je povučena', 'Jedna prijava više nije aktivna.'],
 ['Prijava je istekla', 'Ova prijava više nije aktivna.'],
 ['Zadatak je izmenjen', 'Promenjeni su podaci zadatka koji pratiš.'],
 ['Zadatak je otkazan', 'Zadatak više nije aktivan.'],
 ['Dogovor je ažuriran', 'Promenjeni su uslovi Dogovora.'],
 ['Predložena je izmena Dogovora', 'Proveri predložene uslove.'],
 ['Izmena nije prihvaćena', 'Predlog izmene Dogovora nije prihvaćen.'],
 ['Dogovor je otkazan', 'Otvori Dogovor da vidiš trenutno stanje.'],
 ['Status Dogovora je promenjen', 'Otvori Dogovor da vidiš sledeći korak.'],
 ['Potvrdi završetak', 'Druga strana je označila posao kao završen.'],
 ['Nova poruka u Dogovoru', 'Imaš novu poruku.'],
 ['Podaci Dogovora su dostupni', 'Otvori Dogovor da vidiš podatke kojima sada imaš pristup.'],
 ['Oporavak naloga', 'Otvoren je postupak oporavka naloga.'],
 ['Stigla ti je nova ocena', 'Pogledaj novu ocenu saradnje.'],
 ['Novo pitanje za zadatak', 'Stiglo je novo pitanje.'],
 ['Stigao je odgovor', 'Na pitanje za zadatak je odgovoreno.'],
 ['USKOČI', 'Imate novo obaveštenje. Otvorite aplikaciju.'],
 ['USKOČI', 'Imaš novo obaveštenje. Otvori aplikaciju.'],
].map(([title, body]) => Object.freeze({ title, body })));

export function isPublicInboxCopy(title: unknown, body: unknown): boolean {
 return typeof title === 'string' && typeof body === 'string'
  && publicInboxCopies.some(copy => copy.title === title && copy.body === body);
}
