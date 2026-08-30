import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Klijent se pravi LENJO, pri prvoj upotrebi.
//
// Ranije se pravio pri importu, pa je svaki modul koji ga makar posredno uvuce
// pucao ako env nije postavljen. To je rusilo ceo test suite: lazniIzvor ->
// uloga -> data/index -> supabaseIzvor -> supabaseClient -> createClient throw.
//
// Fail-closed: ako konfiguracija nedostaje, bacamo jasnu gresku. NIKAD se ne
// pada tiho na lazni izvor — to bi znacilo da produkcija radi na izmisljenim
// podacima a da niko ne primeti.

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

  // NAPOMENA: persistSession je false jer u projektu nema storage adaptera
  // (@react-native-async-storage/async-storage nije instaliran). Posledica je da
  // se prijava ne pamti izmedju pokretanja. To je zaseban zadatak, ne menja se
  // ovde naslepo.
  klijent = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return klijent;
}
