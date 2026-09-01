import type {
  Cinjenica,
  IzvorCinjenice,
  KljucCinjenice,
  NacrtPotrebeProjekcija,
  StatusCinjenice,
} from '../contracts/projections';
import type { Izvor } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type AiOverrides = Partial<Pick<Izvor, 'otvoriRazgovor' | 'razgovor'>>;

const PODRZANI_KLJUCEVI = new Set<KljucCinjenice>([
  'naslov',
  'opis',
  'kategorija',
  'datum',
  'vreme',
  'polaziste',
  'odrediste',
  'osoba',
  'vozilo',
  'uslovi',
]);

const MINIMALNO_OBAVEZNO: KljucCinjenice[] = ['naslov', 'opis', 'kategorija'];

function prikaziVrednost(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(prikaziVrednost).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['text', 'value', 'label', 'name']) {
      if (typeof record[key] === 'string') return record[key] as string;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return String(value);
}

function mapStatus(status: string, source: string): StatusCinjenice {
  if (status === 'CONFIRMED') return 'POTVRDJENO';
  if (status === 'NEEDS_CONFIRMATION' || status === 'PROPOSED') return 'TRAZI_POTVRDU';
  if (source === 'AI_INFERENCE') return 'ZAKLJUCENO';
  return 'NEPOZNATO';
}

function mapSource(source: string): IzvorCinjenice {
  if (source === 'EXPLICIT_USER_ANSWER' || source === 'USER') return 'KORISNIK';
  if (source === 'PROFILE') return 'PROFIL';
  if (source === 'AI_INFERENCE' || source === 'AI') return 'AI_ZAKLJUCAK';
  return 'SISTEM';
}

function mapFact(raw: any): Cinjenica | null {
  if (!PODRZANI_KLJUCEVI.has(raw.fact_key as KljucCinjenice)) return null;
  const prikaz = prikaziVrednost(raw.fact_value).trim();
  if (!prikaz) return null;
  return {
    id: raw.id,
    kljuc: raw.fact_key as KljucCinjenice,
    prikaz,
    status: mapStatus(String(raw.status ?? ''), String(raw.source ?? '')),
    izvor: mapSource(String(raw.source ?? '')),
    citat: typeof raw.evidence_excerpt === 'string' && raw.evidence_excerpt.trim()
      ? raw.evidence_excerpt.trim()
      : null,
  };
}

export const aiProductionOverrides: AiOverrides = {
  async otvoriRazgovor() {
    const { data, error } = await supabase.rpc('rpc_ai_open_conversation', {
      p_purpose: 'NEED_INTAKE',
    });
    if (error || !data) {
      return {
        ok: false,
        kod: error?.message || error?.code || 'AI_CONVERSATION_OPEN_FAILED',
        poruka: error?.message || 'Nacrt Potrebe nije mogao da se otvori.',
      };
    }
    return { ok: true, podatak: { razgovorId: data as string } };
  },

  async razgovor(razgovorId) {
    const { data: conversation, error: conversationError } = await supabase
      .from('ai_conversations')
      .select('id, purpose, status, bound_need_id')
      .eq('id', razgovorId)
      .eq('purpose', 'NEED_INTAKE')
      .maybeSingle();

    if (conversationError) {
      throw new Error(conversationError.message || 'AI_CONVERSATION_READ_FAILED');
    }
    if (!conversation) return null;

    const { data: rows, error: factsError } = await supabase
      .from('ai_structured_facts')
      .select('id, fact_key, fact_value, status, source, evidence_excerpt, created_at')
      .eq('conversation_id', razgovorId)
      .is('superseded_at', null)
      .order('created_at', { ascending: true });

    if (factsError) throw new Error(factsError.message || 'AI_FACTS_READ_FAILED');

    const latest = new Map<KljucCinjenice, Cinjenica>();
    for (const row of rows ?? []) {
      const fact = mapFact(row);
      if (fact) latest.set(fact.kljuc, fact);
    }
    const cinjenice = [...latest.values()];
    const prisutni = new Set(cinjenice.map((fact) => fact.kljuc));
    const nedostaje = MINIMALNO_OBAVEZNO.filter((key) => !prisutni.has(key));

    const nacrt: NacrtPotrebeProjekcija = {
      razgovorId,
      cinjenice,
      nedostaje,
      bezbednost: 'REVIEW',
      bezbednostPoruka:
        'Nacrt je sačuvan na serveru. AI obrada i završna provera objave još nisu povezane sa produkcionim providerom.',
      // rpc_ai_publish_need je i dalje namerno fail-closed. Klijent nikada ne
      // proglašava nacrt spremnim pre server-side safety/publish odluke.
      spremnoZaObjavu: false,
    };

    return {
      // Kanonska baza trenutno nema ai_messages tabelu. Ne rekonstruišemo niti
      // izmišljamo chat istoriju iz facts-a; kartica prikazuje jedino dokazano stanje.
      poruke: [],
      nacrt,
    };
  },
};
