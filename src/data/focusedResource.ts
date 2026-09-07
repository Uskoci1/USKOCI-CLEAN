export type ResourceState<T> = { data: T | null; loading: boolean; error: boolean };

/** A read belongs to one focused account/intent and one request generation. */
export function createFocusedResource<T>(load: () => Promise<T>, isCurrent: () => boolean) {
  let state: ResourceState<T> = { data: null, loading: true, error: false };
  let active = false;
  let generation = 0;
  const listeners = new Set<() => void>();
  const publish = (next: ResourceState<T>) => {
    state = next;
    listeners.forEach(listener => listener());
  };
  async function refresh() {
    if (!active || !isCurrent()) return;
    const request = ++generation;
    // Eligibility and private identity from a previous read are not current truth.
    publish({ data: null, loading: true, error: false });
    try {
      const data = await load();
      if (active && request === generation && isCurrent()) publish({ data, loading: false, error: false });
    } catch {
      if (active && request === generation && isCurrent()) publish({ data: null, loading: false, error: true });
    }
  }
  return {
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() { active = true; void refresh(); },
    stop() { active = false; generation++; },
    refresh,
  };
}
