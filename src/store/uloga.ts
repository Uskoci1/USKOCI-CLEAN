/**
 * Uloga aktivnog prostora.
 *
 * Kanon: jedan nalog može koristiti oba prostora. Ovo NIJE dva naloga —
 * to je jedan korisnik koji gleda isti Dogovor sa druge strane.
 *
 * Zato je uloga stanje aplikacije, a projekcije su vezane za nju:
 * isti Dogovor daje različit `viSte`, različite dozvoljene akcije i
 * različit ekran, bez ijedne grane `if (uloga)` u komponenti.
 */

import { useSyncExternalStore } from 'react';
import type { Uloga } from '../contracts/projections';

let trenutna: Uloga = 'narucilac';
const pretplatnici = new Set<() => void>();

function obavesti() {
  pretplatnici.forEach((f) => f());
}

export function postaviUlogu(u: Uloga) {
  if (trenutna === u) return;
  trenutna = u;
  obavesti();
}

export function promeniProstor() {
  postaviUlogu(trenutna === 'narucilac' ? 'uskocer' : 'narucilac');
}

/** Za slojeve van Reacta — izvor podataka je čita ovako. */
export function ulogaSada(): Uloga {
  return trenutna;
}

export function useUloga(): Uloga {
  return useSyncExternalStore(
    (f) => {
      pretplatnici.add(f);
      return () => pretplatnici.delete(f);
    },
    ulogaSada,
    ulogaSada,
  );
}

/** Samo za testove. */
export function resetujUlogu() {
  trenutna = 'narucilac';
}
