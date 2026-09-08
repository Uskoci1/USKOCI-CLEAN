/** Presentation lifetime only. No account, location or business authority. */
export type DiscoveryMapScope = {
  capture: () => number | null;
  owns: (epoch: number | null) => boolean;
};

/** A refocus starts a new lifetime; an older callback cannot revive on Back. */
export function createDiscoveryMapScope() {
  let active = false, epoch = 0;
  return {
    enter() { epoch++; active = true; },
    leave() { epoch++; active = false; },
    // Used before navigation dispatch, closing the render/blur transition window.
    suspend() { epoch++; active = false; },
    capture: () => active ? epoch : null,
    owns: (captured: number | null) => active && captured !== null && captured === epoch,
  };
}
