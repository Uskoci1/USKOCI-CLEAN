import { agreementProductionOverrides } from './agreementProductionOverrides';
import { aiCommandOverrides } from './aiCommandOverrides';
import { aiNeedV2Production } from './aiNeedV2Production';
import { aiProductionOverrides } from './aiProductionOverrides';
import { lazniIzvor } from './lazniIzvor';
import { needProductionOverrides } from './needProductionOverrides';
import { productionAuthorityOverrides } from './productionAuthorityOverrides';
import { ru4FakeSource, ru4ProductionSource } from './ru4Source';
import { supabaseIzvor } from './supabaseIzvor';
import { supabaseKonfigurisan } from './supabaseClient';
import { Izvor } from './ports';

// Eksplicitna kompoziciona granica.
//
// Lazni izvor je dozvoljen SAMO u testu ili uz izricit DEV prekidac.
// Produkcijski put NIKAD ne pada tiho na lazni izvor: ako Supabase nije
// konfigurisan, puca odmah i glasno, jer bi tiho prebacivanje znacilo da
// aplikacija radi na izmisljenim podacima a niko to ne vidi.

const uTestu = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
const izricitLazni = process.env.EXPO_PUBLIC_USE_FAKE_SOURCE === '1';

export const koristiLazniIzvor = uTestu || izricitLazni;

if (!koristiLazniIzvor && !supabaseKonfigurisan()) {
  throw new Error(
    'SUPABASE_NIJE_KONFIGURISAN: produkcijski put ne sme da padne na lazni izvor. ' +
      'Postavi EXPO_PUBLIC_SUPABASE_URL i EXPO_PUBLIC_SUPABASE_ANON_KEY, ' +
      'ili za DEV eksplicitno EXPO_PUBLIC_USE_FAKE_SOURCE=1.',
  );
}

// Existing adapter remains the baseline while strict canonical closures replace
// known unsafe/incorrect paths. Need reads intentionally stop masking backend
// failures as empty states. AI read overrides align NEED_INTAKE with persisted
// facts; AI command overrides call the JWT-protected Edge boundary and preserve
// fail-closed HTTP errors. Agreement overrides own workspace semantics.
const produkcijskiIzvor: Izvor = {
  ...supabaseIzvor,
  ...productionAuthorityOverrides,
  ...needProductionOverrides,
  ...aiProductionOverrides,
  ...aiCommandOverrides,
  ...agreementProductionOverrides,
  poreklo: 'supabase',
};

export const izvor: Izvor = koristiLazniIzvor ? lazniIzvor : produkcijskiIzvor;

// RU-2 R02→R07 is deliberately a separate typed boundary while legacy AI
// remains available for older clients. New mobile surfaces use only this V2
// source and therefore cannot accidentally call rpc_ai_publish_need.
export const aiNeedV2Izvor = aiNeedV2Production;

// RU-4 is also an isolated typed cutover. It owns only public→DRAFT revision,
// editing that private DRAFT, and the Worker stale-review projection. Keeping it
// outside legacy Izvor prevents old direct-public-edit paths from reappearing.
export const ru4Izvor = koristiLazniIzvor ? ru4FakeSource : ru4ProductionSource;
