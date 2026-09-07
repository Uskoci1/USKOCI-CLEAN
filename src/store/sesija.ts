
import { useSyncExternalStore } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabaseKlijent } from '../data/supabaseClient';
import { povratniCilj } from './povratniCilj';
import { postaviUlogu } from './uloga';

type SesijaStanje = {
  isLoaded: boolean;
  session: Session | null;
  user: User | null;
  sessionEpoch: number;
  returnTargetRevision: number;
};

let trenutna: SesijaStanje = {
  isLoaded: false,
  session: null,
  user: null,
  sessionEpoch: 0,
  returnTargetRevision: 0,
};

const pretplatnici = new Set<() => void>();

function obavesti() {
  pretplatnici.forEach((f) => f());
}

let initialized = false;
let pendingTargetCleanup: (() => Promise<void>) | null = null;

export function inicijalizujSesiju() {
  if (initialized) return;
  initialized = true;

  const supabase = supabaseKlijent();
  const restoreEpoch = trenutna.sessionEpoch;

  // Auth events take precedence over the startup read. Keep the callback
  // synchronous; storage work must not hold up Supabase's event dispatch.
  supabase.auth.onAuthStateChange((event, session) => {
    acceptSession(session, event === 'SIGNED_OUT');
  });

  const finishRestore = (session: Session | null) => {
    if (trenutna.sessionEpoch === restoreEpoch) acceptSession(session);
  };
  try {
    void supabase.auth.getSession().then(
      ({ data, error }) => finishRestore(error ? null : data.session),
      () => finishRestore(null),
    );
  } catch {
    finishRestore(null);
  }
}

function acceptSession(session: Session | null, signedOut = false) {
  const previousUserId = trenutna.user?.id;
  const changedAccount = !!previousUserId && previousUserId !== session?.user.id;
  trenutna = {
    ...trenutna,
    isLoaded: true,
    session,
    user: session?.user ?? null,
    sessionEpoch: trenutna.sessionEpoch + 1,
  };
  const epoch = trenutna.sessionEpoch;
  if (signedOut || changedAccount) {
    postaviUlogu('narucilac');
    pendingTargetCleanup = povratniCilj.captureSessionCleanup();
  }
  // Enqueue cleanup before a new account can prepare its own target. Retain
  // its boundary on failure so a later Auth confirmation can safely retry.
  const reset = pendingTargetCleanup;
  const cleanup = reset ? reset() : Promise.resolve();
  if (reset) void cleanup.then(() => {
    if (pendingTargetCleanup === reset) pendingTargetCleanup = null;
  }, () => {});
  obavesti();

  if (session?.user) {
    setTimeout(() => {
      // A storage failure leaves Auth usable and the pending target retryable
      // on the next session confirmation, without claiming intent completion.
      // If previous-account cleanup failed, do not adopt its pending target.
      void cleanup.then(() => resolveReturnTarget(session.user.id, epoch)).catch(() => {});
    }, 0);
  }
}

async function resolveReturnTarget(userId: string, epoch: number) {
  const isCurrent = () => trenutna.sessionEpoch === epoch && trenutna.user?.id === userId;
  if (!isCurrent()) return;
  const pending = await povratniCilj.snapshot();
  if (!isCurrent() || !pending || pending.status !== 'PENDING') return;
  const completed = await povratniCilj.markCompleted(userId, pending.intent, {
    isCurrent,
    pendingRevision: pending.recordRevision,
  });
  if (!isCurrent() || !completed) return;
  postaviUlogu(completed.intent.intent === 'WORKER' ? 'uskocer' : 'narucilac');
  // RootLayout may have checked before the asynchronous target was completed.
  trenutna = { ...trenutna, returnTargetRevision: trenutna.returnTargetRevision + 1 };
  obavesti();
}

export function sesijaSada(): SesijaStanje {
  return trenutna;
}

export function useSesija(): SesijaStanje {
  return useSyncExternalStore(
    (f) => {
      pretplatnici.add(f);
      if (!initialized) inicijalizujSesiju();
      return () => pretplatnici.delete(f);
    },
    sesijaSada,
    sesijaSada,
  );
}

