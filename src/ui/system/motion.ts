import { useEffect, useSyncExternalStore } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

/**
 * The one "reduce motion" source (2026-09-24). Until today the app asked three ways — this file per component,
 * `useSystemReducedMotion` per component, and Reanimated's launch-time value that never changes — so a screen could
 * keep moving after the person turned motion off. Now there is one small store:
 *
 * - the root layout seeds it with the value the platform reported at launch (`useReducedMotionRoot`), so the first
 *   frame of the first screen already respects it;
 * - while the root is mounted it follows the platform: the accessibility change event, and a fresh read every time
 *   the app comes back to the foreground (the setting can be changed while the app sits in the background);
 * - every screen and component reads it with `useReducedMotion`, through `useSyncExternalStore`, so one change reaches
 *   all of them in the same render.
 *
 * No Reanimated import here: route suites mock `react-native`, and this file must load wherever a screen does. A
 * reader without a mounted root never touches a native API; it reads "not reduced" until a root follows the platform.
 * The motion values themselves are `sys.motion`, with its rule: nothing that states a fact animates.
 */

type Subscription = { remove?: () => void } | null | undefined | void;

let reduced = false;
/** A live answer (event or query) arrived, so the launch seed must not overwrite it. */
let answered = false;
let seeded = false;
/** Bumped by every event and by stopping, so an older query can never overwrite a newer answer. */
let revision = 0;
let holders = 0;
let stopFollowing: (() => void) | undefined;
const readers = new Set<() => void>();

function publish(value: boolean) {
  answered = true;
  if (value === reduced) return;
  reduced = value;
  readers.forEach(reader => reader());
}

function ask(isCurrent: () => boolean) {
  const request = ++revision;
  try {
    const answer = AccessibilityInfo?.isReduceMotionEnabled?.();
    answer?.then?.(value => {
      if (isCurrent() && request === revision && typeof value === 'boolean') publish(value);
    }, () => undefined); // A failed read keeps what is known; the next foreground asks again.
  } catch { /* No API on this platform or in this test double: keep what is known. */ }
}

function follow(): () => void {
  let live = true;
  const isCurrent = () => live;
  let preference: Subscription, foreground: Subscription;
  try {
    preference = AccessibilityInfo?.addEventListener?.('reduceMotionChanged', (value: boolean) => {
      if (!live || typeof value !== 'boolean') return;
      revision++;
      publish(value);
    });
  } catch { /* not available here */ }
  try {
    foreground = AppState?.addEventListener?.('change', state => { if (live && state === 'active') ask(isCurrent); });
  } catch { /* not available here */ }
  ask(isCurrent);
  return () => {
    live = false;
    revision++;
    preference?.remove?.();
    foreground?.remove?.();
  };
}

function hold(): () => void {
  holders++;
  if (holders === 1) stopFollowing = follow();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders--;
    if (holders > 0) return;
    stopFollowing?.();
    stopFollowing = undefined;
    // Nothing follows the platform any more, so nothing here is known: the next root starts as a fresh launch.
    reduced = false; answered = false; seeded = false;
  };
}

/**
 * The launch value, taken only before anything reads the store and before a live answer arrived. It never notifies:
 * it runs while the root renders, before any screen has drawn.
 */
export function seedReducedMotion(launch: boolean): void {
  if (seeded || answered || readers.size > 0) return;
  seeded = true;
  reduced = launch;
}

/** For the root layout only: seed with the launch value, then follow the platform for as long as the root lives. */
export function useReducedMotionRoot(launch: boolean): void {
  seedReducedMotion(launch);
  useEffect(hold, []);
}

function subscribe(reader: () => void) {
  readers.add(reader);
  return () => { readers.delete(reader); };
}
const snapshot = () => reduced;

/** Whether the person asked the system for less motion. True means: nothing moves; state changes are instant. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
