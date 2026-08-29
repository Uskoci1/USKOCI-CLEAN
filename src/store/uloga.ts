import { useSyncExternalStore } from 'react';
import type { Uloga } from '../contracts/projections';
import { izvor as defaultIzvor } from '../data';
import type { Izvor } from '../data/ports';

let trenutna: Uloga = 'narucilac';
let trenutniIzvor: Izvor = defaultIzvor;
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

export function postaviIzvor(i: Izvor) {
  if (trenutniIzvor === i) return;
  trenutniIzvor = i;
  obavesti();
}

/** Za slojeve van Reacta ?" izvor podataka je ?ita ovako. */
export function ulogaSada(): Uloga {
  return trenutna;
}

export function izvorSada(): Izvor {
  return trenutniIzvor;
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

export function useIzvor(): Izvor {
  return useSyncExternalStore(
    (f) => {
      pretplatnici.add(f);
      return () => pretplatnici.delete(f);
    },
    izvorSada,
    izvorSada,
  );
}

/** Samo za testove. */
export function resetujUlogu() {
  trenutna = 'narucilac';
}
