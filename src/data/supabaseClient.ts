
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

let klijent: SupabaseClient | null = null;

export function supabaseKonfigurisan(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
}

export function supabaseKlijent(): SupabaseClient {
  if (klijent) return klijent;

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      'SUPABASE_NIJE_KONFIGURISAN: nedostaje EXPO_PUBLIC_SUPABASE_URL ili EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  klijent = createClient(url, anon, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  
  return klijent;
}

// React Native requires telling Supabase Auth when the app comes to foreground or goes to background
// to properly manage the token refresh timers.
AppState.addEventListener('change', (state) => {
  if (!klijent) return;
  if (state === 'active') {
    klijent.auth.startAutoRefresh();
  } else {
    klijent.auth.stopAutoRefresh();
  }
});

