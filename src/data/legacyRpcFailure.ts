import type { Ishod } from './ports';

// Transitional adapters still used by current screens share a strict public
// failure boundary. Only documented symbolic names may leave the adapter.
const COPY: Readonly<Record<string, string>> = Object.freeze({
  AUTH_REQUIRED: 'Prijavi se da nastaviš.',
  NOT_OWNER: 'Ova radnja nije dostupna na ovom nalogu.',
  NOT_WORKER: 'Ovu radnju može da izvrši samo onaj ko je uskočio u ovaj Dogovor.',
  NOT_PARTY: 'Ova radnja je dostupna samo učesnicima Dogovora.',
  FORBIDDEN: 'Ova radnja nije dostupna na ovom nalogu.',
  AGREEMENT_NOT_FOUND: 'Dogovor nije dostupan.',
  AGREEMENT_NOT_ACTIVE: 'Dogovor više nije aktivan. Osveži prikaz.',
  CHAT_NOT_AVAILABLE: 'Poruke trenutno nisu dostupne u ovom Dogovoru.',
  STALE_VERSION: 'Podaci su izmenjeni. Učitaj aktuelno stanje.',
  PROPOSAL_CLOSED: 'Predlog više ne čeka odgovor. Osveži Dogovor.',
  VERSION_MISMATCH: 'Podaci su izmenjeni. Učitaj aktuelno stanje.',
  NEED_VERSION_MISMATCH: 'Zadatak je izmenjen. Pregledaj važeće uslove.',
  RESPONSE_VERSION_MISMATCH: 'Prijava je izmenjena. Učitaj njenu novu verziju.',
  STALE_REVIEW_REQUIRED: 'Zadatak je izmenjen. Pregledaj važeće uslove.',
  RESPONSE_NOT_OWNED: 'Ova Prijava nije dostupna na ovom nalogu.',
  RESPONSE_NOT_WITHDRAWABLE: 'Prijavu sada nije moguće povući. Proveri aktuelno stanje.',
  RESPONSE_NOT_AWAITING_REVIEW: 'Prijava više ne čeka ovu proveru. Učitaj aktuelno stanje.',
  RESPONSE_ALREADY_CURRENT: 'Prijava je već usklađena. Učitaj aktuelno stanje.',
  RESPONSE_ALREADY_SELECTED: 'Prijava je već izabrana. Otvori Dogovor.',
  APPLICATION_NOT_FOUND: 'Prijava nije dostupna.',
  RESPONSE_NOT_FOUND: 'Prijava nije dostupna.',
  NEED_NOT_FOUND: 'Zadatak nije dostupan.',
  NEED_NOT_OPEN: 'Zadatak više ne prima prijave.',
  NEED_CLOSED: 'Zadatak je zatvoren.',
  INVALID_PRICE: 'Proveri unetu cenu.',
  INVALID_COVERED_SLOTS: 'Proveri broj ljudi u Prijavi.',
  INVALID_PROPOSED_WINDOW: 'Proveri početak i kraj ponuđenog termina.',
  SCOPE_NOTE_TOO_LONG: 'Napomena je predugačka. Skrati je pre slanja.',
  // Deep read 8.4: no screen can add a number yet, so the sentence must not send the person looking for one.
  PHONE_NOT_SET: 'Na tvom nalogu nema broja telefona, a upis broja još nije moguć u aplikaciji. Kontakt dogovori kroz poruke.',
  NO_ACTIVE_GRANT: 'Dozvola za prikaz više nije aktivna. Osveži Dogovor.',
  GRANT_NOT_OWNABLE: 'Podatak može da podeli samo njegov vlasnik.',
  GRANT_NOT_TO_COUNTERPARTY: 'Dozvola ne pripada drugom učesniku Dogovora.',
  REQUESTER_PROFILE_REQUIRED: 'Potreban je profil za objavu zadataka.',
  POLICY_BUNDLE_NOT_READY: 'Objava trenutno nije dostupna.',
  PACKAGE_4_NOT_READY: 'Objava trenutno nije dostupna.',
  AI_PUBLISH_BLOCKED: 'Objava trenutno nije dozvoljena.',
  AI_FACT_REVISION_NOT_READY: 'Učitaj aktuelni pregled pre izmene.',
  FACT_NOT_FOUND: 'Podatak više nije dostupan. Učitaj pregled ponovo.',
  FACT_SUPERSEDED: 'Podatak je izmenjen. Učitaj pregled ponovo.',
});

/** A refusal the server answered for a known reason: its sentence is the outcome, not an unknown one. */
export function knownLegacyRefusal(kod: string): boolean {
  return Object.prototype.hasOwnProperty.call(COPY, kod);
}

export function legacyRpcFailure<T>(error: unknown, fallbackCode: string, fallbackMessage: string): Ishod<T> {
  let name: unknown;
  try { name = error && typeof error === 'object' ? (error as { message?: unknown }).message : undefined; }
  catch { /* An opaque error is still an unconfirmed outcome. */ }
  if (typeof name === 'string' && Object.prototype.hasOwnProperty.call(COPY, name)) {
    return { ok: false, kod: name, poruka: COPY[name] };
  }
  // SQLSTATE, arbitrary message/details/hint, URLs and provider bodies are not
  // UI copy or public error codes. The supplied fallbacks are source constants.
  return { ok: false, kod: fallbackCode, poruka: fallbackMessage };
}
