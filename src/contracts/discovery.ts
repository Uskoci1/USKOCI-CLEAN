import type { PrilikaProjekcija } from './projections';

/** Exact server key, including fractional seconds. Treat as opaque and reset on refresh. */
export type PrilikeCursor = { createdAt: string; id: string };

export type PrilikeStranaUpit = {
  cursor?: PrilikeCursor;
  /** Default 30; integer 1..50. */
  limit?: number;
  signal?: AbortSignal;
};

/** One shared page for List and Map. Missing pins never remove items from the list. */
export type PrilikeStrana = {
  items: PrilikaProjekcija[];
  nextCursor: PrilikeCursor | null;
};
