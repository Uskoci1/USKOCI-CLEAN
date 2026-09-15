import type { Uloga } from '../contracts/projections';

export const ACCOUNT_INTENT_KEY = 'uskoci:account-intent:v1:';
const RESTORE_DEADLINE_MS = 1500;
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
type Owner = { accountId: string; revision: number; release: () => void; ready: Promise<void> };

/** Local UI preference only: never a role grant, profile activation or server authority. */
export function createAccountIntentPreference(storage: Storage) {
  let owner: Owner | null = null;
  let role: Uloga = 'narucilac';
  const listeners = new Set<() => void>();
  // Serialize the real operations, not timeout wrappers: a late old write must
  // never overwrite a newer choice. Other accounts have independent queues.
  const writes = new Map<string, Promise<void>>();
  const key = (accountId: string) => ACCOUNT_INTENT_KEY + encodeURIComponent(accountId);
  const notify = () => listeners.forEach(listener => listener());
  const replace = (next: Uloga) => { if (next !== role) { role = next; notify(); } };

  function select(next: Uloga) {
    if (next !== 'narucilac' && next !== 'uskocer') return;
    const captured = owner;
    if (captured) {
      // Even selecting the current default must defeat an older restore.
      captured.revision++;
      captured.release();
      const value = JSON.stringify({ version: 1, accountId: captured.accountId, role: next });
      const previous = writes.get(captured.accountId) ?? Promise.resolve();
      const write = previous.catch(() => {}).then(() => storage.setItem(key(captured.accountId), value));
      const settled = write.catch(() => {});
      writes.set(captured.accountId, settled);
      void settled.then(() => { if (writes.get(captured.accountId) === settled) writes.delete(captured.accountId); });
    }
    replace(next);
  }

  function bind(accountId: string | null): Promise<void> {
    if (accountId && owner?.accountId === accountId) return owner.ready;
    owner?.release();
    owner = null;
    replace('narucilac'); // Logout/account switch never persists this reset.
    if (!accountId) return Promise.resolve();
    let release!: () => void;
    const ready = new Promise<void>(resolve => { release = resolve; });
    const captured: Owner = { accountId, revision: 0, release, ready };
    owner = captured;
    const previousWrite = writes.get(accountId) ?? Promise.resolve();
    const read = previousWrite.catch(() => {}).then(() => storage.getItem(key(accountId)));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), RESTORE_DEADLINE_MS); });
    void Promise.race([read, timeout]).then(raw => {
      if (owner !== captured || captured.revision !== 0 || !raw || raw.length > 512) return;
      let record: unknown;
      try { record = JSON.parse(raw); } catch { return; }
      if (!record || typeof record !== 'object' || Array.isArray(record)) return;
      const value = record as Record<string, unknown>;
      if (value.version !== 1 || value.accountId !== accountId || Object.keys(value).length !== 3) return;
      if (value.role === 'narucilac' || value.role === 'uskocer') replace(value.role);
    }).catch(() => { /* Local storage failure cannot block Auth or grant authority. */ })
      .finally(() => { if (timer !== undefined) clearTimeout(timer); release(); });
    return ready;
  }

  return { bind, select, current: () => role,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; } };
}
