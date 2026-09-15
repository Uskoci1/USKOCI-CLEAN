import { readReceipt, record, sameId, timestamp, positiveInteger, uuid, type ReceiptAccount } from './serverReceipt';
import type { CurrentLocationPoint } from './nativeCurrentLocation';
export type LocationJournal = { version: 1; agreementId: string; agreementVersion: number; clientRequestId: string;
  kind: 'REQUEST' | 'SHARE'; inputSha256: string };
export type LocationReceipt = Omit<LocationJournal, 'version'> & { state: 'COMMITTED' | 'CANCELLED'; recordedAt: string; authoritative: true };
export type AgreementLocationContext = { agreementId: string; agreementVersion: number; role: 'WORKER' | 'REQUESTER';
  canShare: boolean; canRequest: boolean; requestedAt: string | null; point: (CurrentLocationPoint & { sharedAt: string }) | null; authoritative: true };
const keys = (v: Record<string, unknown>, k: string[]) => Object.keys(v).length === k.length && k.every(x => Object.hasOwn(v,x));
export const pointValid = (v: unknown): v is CurrentLocationPoint => {
  const p=record(v); return !!p && keys(p,['latitude','longitude','accuracyMeters','capturedAt']) && typeof p.latitude==='number'
    && Number.isFinite(p.latitude) && Math.abs(p.latitude)<=90 && typeof p.longitude==='number' && Number.isFinite(p.longitude) && Math.abs(p.longitude)<=180
    && typeof p.accuracyMeters==='number' && Number.isFinite(p.accuracyMeters) && p.accuracyMeters>=0 && timestamp(p.capturedAt);
};
export function parseLocationJournal(raw: string, agreementId: string): LocationJournal {
  if(raw.length>1024) throw new Error('LOCATION_JOURNAL_INVALID');
  const j=record(JSON.parse(raw));
  if(!j || !keys(j,['version','agreementId','agreementVersion','clientRequestId','kind','inputSha256']) || j.version!==1
    || !sameId(j.agreementId,agreementId) || !positiveInteger(j.agreementVersion) || !uuid(j.clientRequestId)
    || !['REQUEST','SHARE'].includes(j.kind as string) || typeof j.inputSha256!=='string' || !/^[a-f0-9]{64}$/.test(j.inputSha256)) throw new Error('LOCATION_JOURNAL_INVALID');
  return j as LocationJournal;
}
function receipt(raw: unknown,j: LocationJournal): LocationReceipt | null {
  const r=record(raw); if(!r || !keys(r,['agreementId','agreementVersion','clientRequestId','kind','inputSha256','state','recordedAt','authoritative'])
    || !sameId(r.agreementId,j.agreementId) || r.agreementVersion!==j.agreementVersion || !sameId(r.clientRequestId,j.clientRequestId)
    || r.kind!==j.kind || r.inputSha256!==j.inputSha256 || !['COMMITTED','CANCELLED'].includes(r.state as string)
    || !timestamp(r.recordedAt) || r.authoritative!==true) return null;
  return r as LocationReceipt;
}
const options={ errors:{ AUTH_REQUIRED:'Prijavite se da biste nastavili.',AUTH_CONTEXT_CHANGED:'Nalog je promenjen.',
  AGREEMENT_NOT_AVAILABLE:'Dogovor nije dostupan.', LOCATION_NOT_AVAILABLE:'Deljenje lokacije trenutno nije dostupno u ovom Dogovoru.',
  INTERACTION_BLOCKED:'Deljenje lokacije trenutno nije dostupno.', ACCOUNT_CLOSING:'Nalog je u postupku zatvaranja.',
  VERSION_CONFLICT:'Uslovi Dogovora su promenjeni. Osvežite prikaz.', LOCATION_KEY_REUSED:'Potvrda ne odgovara prvobitnom zahtevu.',
  LOCATION_INPUT_INVALID:'Lokacija nije ispravna. Ponovo otvorite prikaz.' }, fallback:'LOCATION_UNCONFIRMED',invalid:'LOCATION_RECEIPT_INVALID' };
export const agreementCurrentLocationService={
  read(agreementId:string,account:ReceiptAccount){return readReceipt<AgreementLocationContext>({...options,account,
    rpc:'rpc_read_agreement_current_location',args:{p_expected_user_id:account.accountId,p_agreement_id:agreementId},decode:raw=>{
      const r=record(raw); if(!r || !keys(r,['agreementId','agreementVersion','role','canShare','canRequest','requestedAt','point','authoritative'])
        || !sameId(r.agreementId,agreementId) || !positiveInteger(r.agreementVersion) || !['WORKER','REQUESTER'].includes(r.role as string)
        || typeof r.canShare!=='boolean' || typeof r.canRequest!=='boolean' || (r.role==='WORKER'?r.canRequest:r.canShare)
        || (r.requestedAt!==null&&!timestamp(r.requestedAt)) || r.authoritative!==true) return null;
      if(r.point!==null){const p=record(r.point);if(!p || !keys(p,['latitude','longitude','accuracyMeters','capturedAt','sharedAt'])
        || !timestamp(p.sharedAt) || !pointValid({latitude:p.latitude,longitude:p.longitude,accuracyMeters:p.accuracyMeters,capturedAt:p.capturedAt}))return null;}
      if(!r.canShare&&!r.canRequest&&(r.point!==null||r.requestedAt!==null))return null;
      return r as AgreementLocationContext;
    }});},
  recover(j:LocationJournal,account:ReceiptAccount){return readReceipt<{found:boolean;command:LocationReceipt|null}>({...options,account,
    rpc:'rpc_read_agreement_location_command',args:{p_expected_user_id:account.accountId,p_agreement_id:j.agreementId,p_client_request_id:j.clientRequestId},decode:raw=>{
      const r=record(raw);if(!r || !keys(r,['found','command']) || typeof r.found!=='boolean')return null;
      if(!r.found)return r.command===null?{found:false,command:null}:null;
      const command=receipt(r.command,j);return command?{found:true,command}:null;
    }});},
  write(j:LocationJournal,point:CurrentLocationPoint|null,account:ReceiptAccount,cancel=false){return readReceipt<LocationReceipt>({...options,account,write:true,
    rpc:'rpc_write_agreement_current_location',args:{p_expected_user_id:account.accountId,p_agreement_id:j.agreementId,p_agreement_version:j.agreementVersion,
      p_client_request_id:j.clientRequestId,p_kind:j.kind,p_input_sha256:j.inputSha256,p_point:point,p_cancel:cancel},decode:raw=>receipt(raw,j)});},
};
