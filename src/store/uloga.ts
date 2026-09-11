import { useSyncExternalStore } from 'react';
import type { Uloga } from '../contracts/projections';
import { izvor as defaultIzvor } from '../data';
import type { Izvor } from '../data/ports';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAccountIntentPreference } from './accountIntentPreference';

const preference = createAccountIntentPreference(AsyncStorage);
let trenutniIzvor: Izvor = defaultIzvor;
const pretplatnici = new Set<() => void>();

function obavesti() {
  pretplatnici.forEach((f) => f());
}

preference.subscribe(obavesti);

export function postaviUlogu(u: Uloga) { preference.select(u); }

/** Session runtime binds identity; UI reset must not overwrite the saved choice. */
export function vezujUloguZaNalog(accountId: string | null): Promise<void> {
  return preference.bind(accountId);
}

export function promeniProstor() {
  postaviUlogu(preference.current() === 'narucilac' ? 'uskocer' : 'narucilac');
}

export function postaviIzvor(i: Izvor) {
  if (trenutniIzvor === i) return;
  trenutniIzvor = i;
  obavesti();
}

/** Trenutna namera za slojeve van Reacta. */
export function ulogaSada(): Uloga {
  return preference.current();
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
  void preference.bind(null);
}
