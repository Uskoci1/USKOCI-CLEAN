import type { StanjePotrebe, StanjePrijave } from '../contracts/projections';
import type { Ishod } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

export type NacrtIzmeneZadatka = {
  id: string;
  revizija: number;
  naslov: string;
  opis: string;
  grad: string;
  podrucje: string;
  brojMesta: number;
  rezimCene: 'FASTEST' | 'MY_PRICE' | 'OFFERS';
  cenaRsd: number | null;
};

export type PripremiIzmenuZadatka = {
  zadatakId: string;
  ocekivanaRevizija: number;
  clientRequestId: string;
  razlog?: string;
};

export type SacuvajNacrtIzmeneZadatka = {
  zadatakId: string;
  ocekivanaRevizija: number;
  naslov: string;
  opis: string;
  grad: string;
  podrucje: string;
  brojMesta: number;
  rezimCene: 'FASTEST' | 'MY_PRICE' | 'OFFERS';
  cenaRsd: number | null;
};

export type MojaPrijavaRu4 = {
  prijavaId: string;
  zadatakId: string;
  naslov: string;
  poslataNaReviziju: number;
  trenutnaRevizija: number | null;
  stanje: StanjePrijave;
  cenaRsd: number;
  pokrivaMesta: number;
  podnetaTekst: string;
  zadatakJavan: boolean;
};

export interface Ru4Source {
  pripremiIzmenu(k: PripremiIzmenuZadatka): Promise<Ishod<{ zadatakId: string; revizija: number }>>;
  nacrtIzmene(zadatakId: string): Promise<Ishod<NacrtIzmeneZadatka>>;
  sacuvajNacrt(k: SacuvajNacrtIzmeneZadatka): Promise<Ishod<{ zadatakId: string; revizija: number }>>;
  mojePrijave(): Promise<Ishod<MojaPrijavaRu4[]>>;
}

export function mozeIzmenaJavnogZadatka(stanje: StanjePotrebe): boolean {
  return stanje === 'OBJAVLJENA' || stanje === 'CEKA_PRIJAVE' || stanje === 'DELIMICNO_POPUNJENA';
}

export function mapirajStanjeMojePrijave(raw: string): StanjePrijave {
  switch (raw) {
    case 'SELECTED':
      return 'IZABRANA';
    case 'WITHDRAWN':
      return 'POVUCENA';
    case 'STALE':
    case 'STALE_REVIEW_REQUIRED':
      return 'STALE_REVIEW_REQUIRED';
    case 'NOT_SELECTED':
    case 'EXPIRED':
      return 'ZATVORENA';
    case 'DRAFT':
    case 'SUBMITTED':
    case 'DELIVERED':
    case 'VIEWED':
    case 'SHORTLISTED':
      return 'IZBORNA';
    default:
      return 'ZATVORENA';
  }
}

function greska<T>(error: any, fallbackKod: string, fallbackPoruka: string): Ishod<T> {
  const message = String(error?.message ?? '').trim();
  return {
    ok: false,
    kod: /^[A-Z0-9_]+$/.test(message) ? message : String(error?.code || fallbackKod),
    poruka: message || fallbackPoruka,
  };
}

function trimText(v: string): string {
  return v.trim();
}

function jednaRelacija<T>(vrednost: T | T[] | null | undefined): T | null {
  if (Array.isArray(vrednost)) return vrednost[0] ?? null;
  return vrednost ?? null;
}

function validirajNacrt(k: SacuvajNacrtIzmeneZadatka): Ishod<null> {
  const naslov = trimText(k.naslov);
  const opis = trimText(k.opis);
  if (naslov.length < 1 || naslov.length > 140) {
    return { ok: false, kod: 'INVALID_TITLE', poruka: 'Naslov mora imati od 1 do 140 znakova.' };
  }
  if (opis.length < 1 || opis.length > 6000) {
    return { ok: false, kod: 'INVALID_DESCRIPTION', poruka: 'Opis mora imati od 1 do 6000 znakova.' };
  }
  if (!Number.isInteger(k.brojMesta) || k.brojMesta < 1 || k.brojMesta > 50) {
    return { ok: false, kod: 'INVALID_REQUIRED_SLOTS', poruka: 'Broj potrebnih osoba mora biti između 1 i 50.' };
  }
  if (k.rezimCene === 'MY_PRICE' && (!Number.isInteger(k.cenaRsd) || Number(k.cenaRsd) <= 0)) {
    return { ok: false, kod: 'INVALID_PRICE', poruka: 'Unesite ispravnu cenu u RSD.' };
  }
  if (k.cenaRsd !== null && (!Number.isInteger(k.cenaRsd) || k.cenaRsd <= 0)) {
    return { ok: false, kod: 'INVALID_PRICE', poruka: 'Cena mora biti pozitivan ceo broj.' };
  }
  return { ok: true, podatak: null };
}

export const ru4ProductionSource: Ru4Source = {
  async pripremiIzmenu(k) {
    const { data, error } = await supabase.rpc('rpc_revise_need_to_draft', {
      p_need_id: k.zadatakId,
      p_expected_revision: k.ocekivanaRevizija,
      p_client_request_id: k.clientRequestId,
      p_reason: k.razlog ?? '',
    });
    if (error) return greska(error, 'REVISE_FAILED', 'Zadatak nije mogao da se pripremi za izmenu.');
    if (!data || data.status !== 'DRAFT' || !Number.isInteger(Number(data.revision))) {
      return { ok: false, kod: 'INVALID_REVISE_RESULT', poruka: 'Server nije vratio očekivani nacrt.' };
    }
    return { ok: true, podatak: { zadatakId: String(data.needId), revizija: Number(data.revision) } };
  },

  async nacrtIzmene(zadatakId) {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) return greska(authError, 'AUTH_READ_FAILED', 'Nalog nije mogao da se proveri.');
    if (!authData.user) return { ok: false, kod: 'AUTH_REQUIRED', poruka: 'Prijavite se ponovo.' };

    const { data, error } = await supabase
      .from('needs')
      .select('id,revision,status,title,description,approximate_city,approximate_area,required_slots,mode,requester_price_rsd,requester_account_id')
      .eq('id', zadatakId)
      .eq('requester_account_id', authData.user.id)
      .eq('status', 'DRAFT')
      .maybeSingle();
    if (error) return greska(error, 'DRAFT_READ_FAILED', 'Nacrt nije mogao da se učita.');
    if (!data) return { ok: false, kod: 'DRAFT_NOT_AVAILABLE', poruka: 'Ovaj Zadatak nije dostupan za izmenu.' };

    return {
      ok: true,
      podatak: {
        id: data.id,
        revizija: Number(data.revision),
        naslov: data.title ?? '',
        opis: data.description ?? '',
        grad: data.approximate_city ?? '',
        podrucje: data.approximate_area ?? '',
        brojMesta: Number(data.required_slots ?? 1),
        rezimCene: data.mode as NacrtIzmeneZadatka['rezimCene'],
        cenaRsd: data.requester_price_rsd === null ? null : Number(data.requester_price_rsd),
      },
    };
  },

  async sacuvajNacrt(k) {
    const valid = validirajNacrt(k);
    if (!valid.ok) return valid;

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) return greska(authError, 'AUTH_READ_FAILED', 'Nalog nije mogao da se proveri.');
    if (!authData.user) return { ok: false, kod: 'AUTH_REQUIRED', poruka: 'Prijavite se ponovo.' };

    const patch = {
      title: trimText(k.naslov),
      description: trimText(k.opis),
      approximate_city: trimText(k.grad),
      approximate_area: trimText(k.podrucje),
      required_slots: k.brojMesta,
      requester_price_rsd: k.cenaRsd,
    };

    const { data, error } = await supabase
      .from('needs')
      .update(patch)
      .eq('id', k.zadatakId)
      .eq('requester_account_id', authData.user.id)
      .eq('status', 'DRAFT')
      .eq('revision', k.ocekivanaRevizija)
      .select('id,revision,status')
      .maybeSingle();
    if (error) return greska(error, 'DRAFT_SAVE_FAILED', 'Izmena nije mogla da se sačuva.');
    if (!data) {
      return { ok: false, kod: 'STALE_REVIEW_REQUIRED', poruka: 'Zadatak se u međuvremenu promenio. Učitajte ga ponovo.' };
    }
    if (data.status !== 'DRAFT' || Number(data.revision) !== k.ocekivanaRevizija) {
      return { ok: false, kod: 'DRAFT_STATE_CHANGED', poruka: 'Zadatak više nije u očekivanom nacrtu.' };
    }
    return { ok: true, podatak: { zadatakId: data.id, revizija: Number(data.revision) } };
  },

  async mojePrijave() {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) return greska(authError, 'AUTH_READ_FAILED', 'Nalog nije mogao da se proveri.');
    if (!authData.user) return { ok: false, kod: 'AUTH_REQUIRED', poruka: 'Prijavite se ponovo.' };

    const { data, error } = await supabase
      .from('marketplace_responses')
      .select(`
        id, need_id, submitted_against_need_revision, current_version, status,
        price_rsd, covered_slots, submitted_at, created_at,
        needs(id,title,revision,status)
      `)
      .eq('worker_account_id', authData.user.id)
      .order('created_at', { ascending: false });
    if (error) return greska(error, 'APPLICATION_LIST_FAILED', 'Prijave nisu mogle da se učitaju.');
    if (!Array.isArray(data)) return { ok: false, kod: 'APPLICATION_LIST_INVALID', poruka: 'Server nije vratio ispravnu listu Prijava.' };

    return {
      ok: true,
      podatak: data.map((row: any) => {
        const need = jednaRelacija<any>(row.needs);
        const stanje = mapirajStanjeMojePrijave(String(row.status));
        const stale = stanje === 'STALE_REVIEW_REQUIRED';
        const needStatus = String(need?.status ?? '');
        return {
          prijavaId: String(row.id),
          zadatakId: String(row.need_id),
          naslov: need?.title ? String(need.title) : stale ? 'Zadatak je trenutno u izmeni' : 'Zadatak',
          poslataNaReviziju: Number(row.submitted_against_need_revision),
          trenutnaRevizija: need?.revision === undefined || need?.revision === null ? null : Number(need.revision),
          stanje,
          cenaRsd: Number(row.price_rsd ?? 0),
          pokrivaMesta: Number(row.covered_slots ?? 1),
          podnetaTekst: new Date(row.submitted_at ?? row.created_at).toLocaleString('sr-Latn-RS'),
          zadatakJavan: needStatus === 'PUBLISHED' || needStatus === 'SELECTION',
        } satisfies MojaPrijavaRu4;
      }),
    };
  },
};

const fakeDrafts = new Map<string, NacrtIzmeneZadatka>();

export function resetujRu4Fake() {
  fakeDrafts.clear();
}

export const ru4FakeSource: Ru4Source = {
  async pripremiIzmenu(k) {
    const draft: NacrtIzmeneZadatka = {
      id: k.zadatakId,
      revizija: k.ocekivanaRevizija + 1,
      naslov: 'Prenos ormara sa Limana na Detelinaru',
      opis: 'Preuzeti, preneti i uneti veliki ormar na drugoj lokaciji.',
      grad: 'Novi Sad',
      podrucje: 'Liman → Detelinara',
      brojMesta: 2,
      rezimCene: 'OFFERS',
      cenaRsd: null,
    };
    fakeDrafts.set(k.zadatakId, draft);
    return { ok: true, podatak: { zadatakId: draft.id, revizija: draft.revizija } };
  },
  async nacrtIzmene(zadatakId) {
    const draft = fakeDrafts.get(zadatakId);
    return draft
      ? { ok: true, podatak: draft }
      : { ok: false, kod: 'DRAFT_NOT_AVAILABLE', poruka: 'Prvo izaberite Izmeni Zadatak.' };
  },
  async sacuvajNacrt(k) {
    const valid = validirajNacrt(k);
    if (!valid.ok) return valid;
    const current = fakeDrafts.get(k.zadatakId);
    if (!current || current.revizija !== k.ocekivanaRevizija) {
      return { ok: false, kod: 'STALE_REVIEW_REQUIRED', poruka: 'Nacrt se promenio.' };
    }
    fakeDrafts.set(k.zadatakId, {
      ...current,
      naslov: trimText(k.naslov),
      opis: trimText(k.opis),
      grad: trimText(k.grad),
      podrucje: trimText(k.podrucje),
      brojMesta: k.brojMesta,
      cenaRsd: k.cenaRsd,
    });
    return { ok: true, podatak: { zadatakId: k.zadatakId, revizija: k.ocekivanaRevizija } };
  },
  async mojePrijave() {
    return { ok: true, podatak: [] };
  },
};
