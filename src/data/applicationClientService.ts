import { legacyRpcFailure } from './legacyRpcFailure';
import type { MojaPrijavaProjekcija, StanjeMojePrijave } from '../contracts/projections';
import type { Ishod, Izvor, PovuciPrijavuKomanda } from './ports';
import { supabaseKlijent } from './supabaseClient';
import { novac } from '../lib/novac';
import { dogovorenoVreme } from '../lib/dogovorenoVreme';
import { podrucjeTekst } from '../lib/location';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type ApplicationLifecycleService = Pick<Izvor, 'mojePrijave' | 'povuciPrijavu'>;

function fail<T>(error: unknown, code: string, message: string): Ishod<T> {
  return legacyRpcFailure(error, code, message);
}



function mapApplication(raw: any): MojaPrijavaProjekcija {
  const state = String(raw?.state ?? '') as StanjeMojePrijave;
  const allowed: StanjeMojePrijave[] = [
    'SUBMITTED',
    'VIEWED',
    'SHORTLISTED',
    'STALE_REVIEW_REQUIRED',
    'WITHDRAWN',
    'SELECTED',
    'CLOSED',
  ];
  if (!allowed.includes(state)) {
    throw new Error(`MY_APPLICATIONS_INVALID_STATE:${state}`);
  }

  const amount = Number(raw?.priceRsd ?? 0);
  const currentNeedRevision = Number(raw?.needRevision ?? 0);
  const submittedNeedRevision = Number(raw?.submittedNeedRevision ?? 0);
  const version = Number(raw?.version ?? 0);
  const coveredSlots = Number(raw?.coveredSlots ?? 0);

  if (!raw?.applicationId || !raw?.needId || currentNeedRevision < 1 || submittedNeedRevision < 1 || version < 1 || coveredSlots < 1 || amount <= 0) {
    throw new Error('MY_APPLICATIONS_INVALID_PROJECTION');
  }

  return {
    prijavaId: String(raw.applicationId),
    potrebaId: String(raw.needId),
    potrebaRevizija: currentNeedRevision,
    prijavaRevizija: submittedNeedRevision,
    prijavaVerzija: version,
    stanje: state,
    naslov: String(raw?.title ?? 'Zadatak'),
    opis: String(raw?.description ?? ''),
    cena: {
      iznos: amount,
      valuta: 'RSD',
      prikaz: novac(amount),
    },
    pokrivaMesta: coveredSlots,
    napomena: String(raw?.scopeNote ?? ''),
    podrucjeTekst: podrucjeTekst(raw?.approximateArea, raw?.approximateCity),
    vremeTekst: dogovorenoVreme(raw?.startsAt, 'Fleksibilno'),
    dogovorId: raw?.agreementId ? String(raw.agreementId) : null,
    promenjenaPotreba: raw?.requiresStaleReview === true,
    mozePovuci: raw?.canWithdraw === true,
    traziPaznju: raw?.attentionRequired === true,
  };
}

export const applicationClientService: ApplicationLifecycleService = {
  async mojePrijave() {
    const { data, error } = await supabase.rpc('rpc_list_my_applications');
    if (error) throw new Error('MY_APPLICATIONS_READ_FAILED');
    if (!Array.isArray(data)) throw new Error('MY_APPLICATIONS_INVALID_PROJECTION');
    return data.map(mapApplication);
  },

  async povuciPrijavu(k: PovuciPrijavuKomanda): Promise<Ishod<{ stanje: 'WITHDRAWN'; verzija: number }>> {
    const { data, error } = await supabase.rpc('rpc_withdraw_response', {
      p_response_id: k.prijavaId,
      p_need_revision: k.potrebaRevizija,
      p_response_version: k.prijavaVerzija,
      p_client_request_id: k.clientRequestId,
      p_reason: k.razlog ?? null,
    });
    if (error) return fail(error, 'WITHDRAW_RESPONSE_FAILED', 'Prijava nije mogla da se povuče.');
    // The version is the server's to state. It used to fall back to the one this command was sent
    // with, so a receipt that named no version still read as a confirmed withdrawal at a version
    // nobody had confirmed, and the next command against this Prijava would have carried it.
    const version: unknown = data?.version;
    if (String(data?.status ?? '') !== 'WITHDRAWN'
      || typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) {
      return { ok: false, kod: 'WITHDRAW_RESPONSE_INVALID_RESULT', poruka: 'Povlačenje Prijave nije potvrđeno.' };
    }
    return { ok: true, podatak: { stanje: 'WITHDRAWN', verzija: version } };
  },
};
