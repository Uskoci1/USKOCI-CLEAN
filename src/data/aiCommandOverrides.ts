import type { Izvor } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type AiCommandOverrides = Partial<Pick<Izvor, 'posaljiKorisnikovuPoruku' | 'ispraviCinjenicu'>>;

async function edgeFailure(error: any) {
  let payload: any = null;
  try {
    const context = error?.context;
    if (context && typeof context.clone === 'function') {
      payload = await context.clone().json();
    } else if (context && typeof context.json === 'function') {
      payload = await context.json();
    }
  } catch {}

  return {
    ok: false as const,
    kod: typeof payload?.code === 'string'
      ? payload.code
      : error?.name || error?.message || 'AI_EDGE_FAILED',
    poruka: typeof payload?.message === 'string'
      ? payload.message
      : 'AI obrada trenutno nije uspela.',
  };
}

export const aiCommandOverrides: AiCommandOverrides = {
  async posaljiKorisnikovuPoruku(razgovorId, telo) {
    const text = telo.trim();
    if (!text) return { ok: false, kod: 'MESSAGE_REQUIRED', poruka: 'Unesite poruku.' };
    if (text.length > 4000) {
      return { ok: false, kod: 'MESSAGE_TOO_LONG', poruka: 'Poruka može imati najviše 4000 znakova.' };
    }

    const { data, error } = await supabase.functions.invoke('uskoci-ai-interview', {
      body: { conversationId: razgovorId, text },
    });

    if (error) return edgeFailure(error);
    if (!data || typeof data.predlozeno !== 'number' || !Number.isFinite(data.predlozeno)) {
      return {
        ok: false,
        kod: 'AI_EDGE_INVALID_RESPONSE',
        poruka: 'AI server nije vratio ispravan rezultat.',
      };
    }

    return { ok: true, podatak: { predlozeno: Math.max(0, Math.trunc(data.predlozeno)) } };
  },

  async ispraviCinjenicu(cinjenicaId, novaVrednost) {
    const value = novaVrednost.trim();
    if (!value) return { ok: false, kod: 'FACT_VALUE_REQUIRED', poruka: 'Unesite vrednost.' };
    if (value.length > 2000) {
      return { ok: false, kod: 'FACT_VALUE_TOO_LONG', poruka: 'Vrednost može imati najviše 2000 znakova.' };
    }

    const { data, error } = await supabase.rpc('rpc_ai_correct_fact', {
      p_fact_id: cinjenicaId,
      p_value: value,
    });
    if (error || typeof data !== 'string' || !data) {
      return {
        ok: false,
        kod: error?.code || error?.message || 'AI_FACT_CORRECTION_FAILED',
        poruka: error?.message || 'Ispravka nije mogla bezbedno da se sačuva.',
      };
    }
    return { ok: true, podatak: { novaCinjenicaId: data } };
  },
};
