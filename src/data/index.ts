import { lazniIzvor } from './lazniIzvor';
import { supabaseIzvor } from './supabaseIzvor';
import { Izvor } from './ports';

// For now, switch to supabase source if we want, or keep lazniIzvor.
// Normally we could use a DEV flag or environment variable.
const USE_SUPABASE = true;

export const izvor: Izvor = USE_SUPABASE ? supabaseIzvor : lazniIzvor;
