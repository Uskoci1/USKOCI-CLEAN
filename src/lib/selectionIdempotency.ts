import { noviZahtevId } from './idempotencija';

export type SelectionIntent = {
  potrebaId: string;
  potrebaRevizija: number;
  prijavaId: string;
  prijavaVerzija: number;
  prijavaHash: string;
  mesta: number;
};

/**
 * Client-side identity of one logical Selection command.
 *
 * The key intentionally mirrors the material semantic fields bound by the
 * P0D-02 server request hash. A network retry of the same intent reuses the
 * same clientRequestId; a different candidate/version/hash/allocation gets a
 * different key and therefore a different request identity.
 */
export function selectionIntentKey(intent: SelectionIntent): string {
  return JSON.stringify([
    intent.potrebaId,
    intent.potrebaRevizija,
    intent.prijavaId,
    intent.prijavaVerzija,
    intent.prijavaHash,
    intent.mesta,
  ]);
}

export class SelectionRequestRegistry {
  private readonly requestIds = new Map<string, string>();

  getOrCreate(intent: SelectionIntent): string {
    const key = selectionIntentKey(intent);
    const existing = this.requestIds.get(key);
    if (existing) return existing;

    const created = noviZahtevId('izbor');
    this.requestIds.set(key, created);
    return created;
  }

  clear(intent: SelectionIntent): void {
    this.requestIds.delete(selectionIntentKey(intent));
  }
}
