// EX-05 S02: emits every function definition the proof rewrites (the scratch copies of the controls and the B24 conversions of the task media
// functions), built from the repository sources exactly as the proof builds them from the chain, as JSON {name: "CREATE OR REPLACE FUNCTION ..."}.
// The checker (check_ex05_s02.py --syntax) parses each of them with pglast, so a rewrite that no longer parses is red before CI builds the chain.
// ASCII only, LF only. Reads the repository; touches nothing else.
import {readFileSync} from 'node:fs';
import * as S from './ex05_s02_sql.mjs';
import {b24Targets, loadPins} from './ex05_s02_pins.mjs';

const source = path => readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
export const SOURCES = Object.freeze({
  owned: 'supabase/migrations/20260912224647_clean_v5_owned_media.sql',
  pkg046: 'supabase/candidates/pkg046a_media_upload_cancellation.sql',
  closurePrep: 'supabase/migrations/20260912130000_clean_pre_v3_account_closure_preparation.sql',
  photos: 'supabase/migrations/20260913065130_clean_v5_agreement_private_photos.sql',
  voice: 'supabase/candidates/chat_voice_b1_dev_application.sql',
});
const ARGS = Object.freeze({
  'public.rpc_cancel_media_upload': 'p_conversation_id uuid, p_client_request_id uuid',
  'public.rpc_complete_media_upload_service': 'p_account_id uuid, p_asset_id uuid, p_storage_sha256 text',
  'public.rpc_stage_media_upload_service': 'p_account_id uuid, p_asset_id uuid, p_attempt_id uuid, p_sha256 text, p_width integer, p_height integer, p_byte_size integer',
  'public.rpc_dispatch_media_upload_service': 'p_account_id uuid, p_asset_id uuid, p_attempt_id uuid',
  'public.rpc_fail_media_upload_service': 'p_account_id uuid, p_asset_id uuid, p_attempt_id uuid',
  'public.rpc_settle_media_upload_service': 'p_account_id uuid, p_asset_id uuid, p_storage_sha256 text, p_outcome text',
  'public.rpc_prepare_account_closure': 'p_expected_user_id uuid, p_expected_revision integer, p_client_request_id uuid',
  'public.rpc_agreement_photo_upload_service_v5': 'p_account_id uuid, p_session_id uuid, p_operation text, p_agreement_id uuid, p_version integer, p_key uuid, p_input jsonb',
  'public.rpc_agreement_voice_upload_service_v1': 'p_account_id uuid, p_session_id uuid, p_operation text, p_agreement_id uuid, p_version integer, p_key uuid, p_input jsonb',
});
const SOURCE_OF = Object.freeze({
  'public.rpc_cancel_media_upload': 'pkg046',
  'public.rpc_complete_media_upload_service': 'owned',
  'public.rpc_stage_media_upload_service': 'owned',
  'public.rpc_dispatch_media_upload_service': 'owned',
  'public.rpc_fail_media_upload_service': 'owned',
  'public.rpc_settle_media_upload_service': 'owned',
  'public.rpc_prepare_account_closure': 'closurePrep',
  'public.rpc_agreement_photo_upload_service_v5': 'photos',
  'public.rpc_agreement_voice_upload_service_v1': 'voice',
});

/** The definition of a function as the chain holds it after the chain stages and the proof's own B24 conversion (what pg_get_functiondef would print, up to white space). */
export function chainDefinition(qualifiedName) {
  const body = S.sourceBody(source(SOURCES[SOURCE_OF[qualifiedName]]), qualifiedName);
  const raw = S.defFromSource({qualifiedName, args: ARGS[qualifiedName], body});
  return raw.includes("'40001'") ? S.convertB24(raw).sql : raw;
}

export function emitDefinitions() {
  const out = {};
  const pins = loadPins();
  for (const target of b24Targets(pins)) {
    const qualified = target.sig.slice(0, target.sig.indexOf('('));
    const raw = S.defFromSource({qualifiedName: qualified, args: ARGS[qualified], body: S.sourceBody(source(SOURCES[SOURCE_OF[qualified]]), qualified)});
    out['b24:' + qualified] = S.convertB24(raw).sql;
  }
  out['control:task_cancel_conv_first'] = S.mutateCancelConvFirst(chainDefinition('public.rpc_cancel_media_upload')).sql;
  out['control:upload_inverted_photo'] = S.mutateUploadServiceInverted(chainDefinition('public.rpc_agreement_photo_upload_service_v5'), 'photo').sql;
  out['control:upload_inverted_voice'] = S.mutateUploadServiceInverted(chainDefinition('public.rpc_agreement_voice_upload_service_v1'), 'voice').sql;
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('ex05_s02_emit.mjs')) process.stdout.write(JSON.stringify(emitDefinitions()) + '\n');
