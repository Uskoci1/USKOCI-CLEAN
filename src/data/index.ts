import { agreementClientService } from './agreementClientService';
import { applicationClientService } from './applicationClientService';
import { aiCommandOverrides } from './aiCommandOverrides';
import { aiNeedV2Production } from './aiNeedV2Production';
import { aiProductionOverrides } from './aiProductionOverrides';
import { contactClientService } from './contactClientService';
import { lazniIzvor } from './lazniIzvor';
import { needClientService } from './needClientService';
import { productionAuthorityOverrides } from './productionAuthorityOverrides';
import { publicProfileClientService } from './publicProfileClientService';
import { responseClientService } from './responseClientService';
import { supabaseIzvor } from './supabaseIzvor';
import { supabaseKonfigurisan } from './supabaseClient';
import { workerProfileClientService } from './workerProfileClientService';
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
// known unsafe/incorrect paths. CDL-A03 physically removed legacy Need reads;
// needClientService is their only production owner. CDL-A04 physically removed
// both lower response-viewed owners; responseClientService is its only owner.
// CDL-A05 consolidated PHONE grants and CDL-A08 exact-location reveal;
// contactClientService is the canonical contact/privacy owner for those paths.
// CDL-A09 makes workerProfileClientService the sole Worker-profile mutation owner,
// preserving DRAFT creation and server-authoritative activation by profile id.
// CDL-A06/A07 moved problem reporting and completion marking into Agreement service.
// AI read overrides align NEED_INTAKE with persisted facts; AI command overrides
// call the JWT-protected Edge boundary and preserve fail-closed HTTP errors.
// RU-5 P0C-01 owns cross-account profile reads through a narrow public RPC;
// raw app_profiles remains owner-only and is never opened for marketplace cards.
const produkcijskiIzvor: Izvor = {
  ...supabaseIzvor,
  ...applicationClientService,
  ...productionAuthorityOverrides,
  ...workerProfileClientService,
  ...publicProfileClientService,
  ...contactClientService,
  ...responseClientService,
  ...needClientService,
  ...aiProductionOverrides,
  ...aiCommandOverrides,
  ...agreementClientService,
  poreklo: 'supabase',
};

export const izvor: Izvor = koristiLazniIzvor ? lazniIzvor : produkcijskiIzvor;

// RU-2 R02→R07 is deliberately a separate typed boundary while legacy AI
// remains available for older clients. New mobile surfaces use only this V2
// source and therefore cannot accidentally call rpc_ai_publish_need.
export const aiNeedV2Izvor = aiNeedV2Production;