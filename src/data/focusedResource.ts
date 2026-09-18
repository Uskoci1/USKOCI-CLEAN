export type ResourceState<T> = { data: T | null; loading: boolean; error: boolean;
  /** A user-asked re-read while what is on screen stays on screen. Never true on a first load. */
  refreshing: boolean };

/** A read belongs to one focused account/intent and one request generation. */
export function createFocusedResource<T>(load: () => Promise<T>, isCurrent: () => boolean) {
  let state: ResourceState<T> = { data: null, loading: true, error: false, refreshing: false };
  let active = false;
  let generation = 0;
  const listeners = new Set<() => void>();
  const publish = (next: ResourceState<T>) => {
    state = next;
    listeners.forEach(listener => listener());
  };
  /**
   * `keepVisible` is for a re-read the person asked for inside the same scope: pulling a list down
   * used to delete every card, the count and the create button and replace them with skeletons, and
   * the chat transcript with them. The authority rule behind the wipe is unchanged — a read from
   * another account or intent is retired by `stop()`, which still clears everything — and what is
   * kept on screen is marked `refreshing`, so a screen can keep showing it without letting anyone
   * act on it until the new read lands.
   */
  async function refresh(keepVisible = false) {
    if (!active || !isCurrent()) return;
    const request = ++generation;
    const keep = keepVisible && state.data !== null && !state.error;
    // Eligibility and private identity from a previous read are not current truth.
    publish(keep ? { ...state, refreshing: true } : { data: null, loading: true, error: false, refreshing: false });
    try {
      const data = await load();
      if (active && request === generation && isCurrent()) publish({ data, loading: false, error: false, refreshing: false });
    } catch {
      if (active && request === generation && isCurrent()) publish({ data: null, loading: false, error: true, refreshing: false });
    }
  }
  return {
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() { active = true; void refresh(); },
    stop() {
      active = false; generation++;
      // A background/blurred view must not retain an apparently current private
      // projection. The next start obtains a new generation before displaying it.
      if (state.data !== null || !state.loading || state.error || state.refreshing) {
        publish({ data: null, loading: true, error: false, refreshing: false });
      }
    },
    refresh,
  };
}
