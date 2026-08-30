
import { useSyncExternalStore } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabaseKlijent } from '../data/supabaseClient';
import { povratniCilj } from './povratniCilj';
import { postaviUlogu } from './uloga';

type SesijaStanje = {
  isLoaded: boolean;
  session: Session | null;
  user: User | null;
};

let trenutna: SesijaStanje = {
  isLoaded: false,
  session: null,
  user: null,
};

const pretplatnici = new Set<() => void>();

function obavesti() {
  pretplatnici.forEach((f) => f());
}

let initialized = false;

export function inicijalizujSesiju() {
  if (initialized) return;
  initialized = true;

  const supabase = supabaseKlijent();

  // Prvo dohvatamo trenutnu sesiju iz AsyncStorage preko Supabase-a
  supabase.auth.getSession().then(({ data: { session } }) => {
    trenutna = {
      isLoaded: true,
      session,
      user: session?.user ?? null,
    };
    obavesti();
    resolveReturnTarget(session?.user?.id);
  });

  // Zatim slušamo promene
  supabase.auth.onAuthStateChange(async (event, session) => {
    trenutna = {
      isLoaded: true,
      session,
      user: session?.user ?? null,
    };
    obavesti();

    if (event === 'SIGNED_IN' && session?.user) {
      await resolveReturnTarget(session.user.id);
    } else if (event === 'SIGNED_OUT') {
      postaviUlogu('narucilac');
      await povratniCilj.clear();
    }
  });
}

async function resolveReturnTarget(userId?: string) {
  if (!userId) return;
  
  // Proverimo da li ima pending intent
  const pending = await povratniCilj.snapshot();
  if (pending && pending.status === 'PENDING') {
     // Označimo ga kao COMPLETED da ga _layout može pokupiti
     await povratniCilj.markCompleted(userId, pending.intent);
     
     // Continuity: ako je namera bila radnička, prebacujemo ulogu
     if (pending.intent.intent === 'WORKER') {
        postaviUlogu('uskocer');
     } else {
        postaviUlogu('narucilac');
     }
  }
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

