import type { Ishod } from './ports';

// Transitional adapters still used by current screens share a strict public
// failure boundary. Only documented symbolic names may leave the adapter.
const COPY: Readonly<Record<string, string>> = Object.freeze({
  AUTH_REQUIRED: 'Prijavite se da biste nastavili.',
  NOT_OWNER: 'Ova radnja nije dostupna na ovom nalogu.',
  NOT_WORKER: 'Ovu radnju može da izvrši samo Uskočer iz Dogovora.',
  NOT_PARTY: 'Ova radnja je dostupna samo učesnicima Dogovora.',
  FORBIDDEN: 'Ova radnja nije dostupna na ovom nalogu.',
  AGREEMENT_NOT_FOUND: 'Dogovor nije dostupan.',
  AGREEMENT_NOT_ACTIVE: 'Dogovor više nije aktivan. Osvežite prikaz.',
  CHAT_NOT_AVAILABLE: 'Poruke trenutno nisu dostupne u ovom Dogovoru.',
  STALE_VERSION: 'Podaci su izmenjeni. Učitajte aktuelno stanje.',
  PROPOSAL_CLOSED: 'Predlog više ne čeka odgovor. Osvežite Dogovor.',
  VERSION_MISMATCH: 'Podaci su izmenjeni. Učitajte aktuelno stanje.',
  NEED_VERSION_MISMATCH: 'Zadatak je izmenjen. Pregledajte važeće uslove.',
  RESPONSE_VERSION_MISMATCH: 'Prijava je izmenjena. Učitajte njenu novu verziju.',
  STALE_REVIEW_REQUIRED: 'Zadatak je izmenjen. Pregledajte važeće uslove.',
  RESPONSE_NOT_OWNED: 'Ova Prijava nije dostupna na ovom nalogu.',
  RESPONSE_NOT_WITHDRAWABLE: 'Prijavu sada nije moguće povući. Proverite aktuelno stanje.',
  RESPONSE_NOT_AWAITING_REVIEW: 'Prijava više ne čeka ovu proveru. Učitajte aktuelno stanje.',
  RESPONSE_ALREADY_CURRENT: 'Prijava je već usklađena. Učitajte aktuelno stanje.',
  RESPONSE_ALREADY_SELECTED: 'Prijava je već izabrana. Otvorite Dogovor.',
  APPLICATION_NOT_FOUND: 'Prijava nije dostupna.',
  RESPONSE_NOT_FOUND: 'Prijava nije dostupna.',
  NEED_NOT_FOUND: 'Zadatak nije dostupan.',
  NEED_NOT_OPEN: 'Zadatak više ne prima prijave.',
  NEED_CLOSED: 'Zadatak je zatvoren.',
  INVALID_PRICE: 'Proverite unetu cenu.',
  INVALID_COVERED_SLOTS: 'Proverite broj ljudi u Prijavi.',
  INVALID_PROPOSED_WINDOW: 'Proverite početak i kraj ponuđenog termina.',
  SCOPE_NOTE_TOO_LONG: 'Napomena je predugačka. Skratite je pre slanja.',
  PHONE_NOT_SET: 'Najpre dodajte broj telefona na nalog.',
  NO_ACTIVE_GRANT: 'Dozvola za prikaz više nije aktivna. Osvežite Dogovor.',
  GRANT_NOT_OWNABLE: 'Podatak može da podeli samo njegov vlasnik.',
  GRANT_NOT_TO_COUNTERPARTY: 'Dozvola ne pripada drugom učesniku Dogovora.',
  REQUESTER_PROFILE_REQUIRED: 'Potreban je profil Naručioca pre objave.',
  POLICY_BUNDLE_NOT_READY: 'Objava trenutno nije dostupna.',
  PACKAGE_4_NOT_READY: 'Objava trenutno nije dostupna.',
  AI_PUBLISH_BLOCKED: 'Objava trenutno nije dozvoljena.',
  AI_FACT_REVISION_NOT_READY: 'Učitajte aktuelni pregled pre izmene.',
  FACT_NOT_FOUND: 'Podatak više nije dostupan. Učitajte pregled ponovo.',
  FACT_SUPERSEDED: 'Podatak je izmenjen. Učitajte pregled ponovo.',
});

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
