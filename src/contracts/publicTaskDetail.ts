import type { NeedTaskGeography } from './needFactsV2';
import type { PrilikaProjekcija } from './projections';

/** Missing/RLS-filtered child rows are unavailable, never an assertion of no requirements. */
export type JavniMaterijal<T> = { state: 'available'; value: T } | { state: 'unavailable' };

/** Public material from one Need/LEFT-embedded read. Not an application eligibility decision. */
export type PrilikaDetaljiProjekcija = PrilikaProjekcija & {
  revision: number;
  opis: string;
  kategorija: string;
  zahtevi: {
    vestine: string[];
    alati: string[];
    vozila: string[];
    licence: string[];
    minimalnoIskustvoGodina: number | null;
    /** A task requirement, not proof that any account has verified identity. */
    zahtevaProverenIdentitet: boolean;
  };
  javnaGeografija: JavniMaterijal<NeedTaskGeography>;
  kriticniUslovi: JavniMaterijal<string[]>;
};

export type PrilikaDetaljiUpit = { signal?: AbortSignal };
