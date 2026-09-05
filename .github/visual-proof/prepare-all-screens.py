from pathlib import Path


def patch_session() -> None:
    path = Path('src/store/sesija.ts')
    text = path.read_text(encoding='utf-8-sig')
    old = """let trenutna: SesijaStanje = {
  isLoaded: false,
  session: null,
  user: null,
};"""
    new = """const visualProof = process.env.EXPO_PUBLIC_VISUAL_PROOF === '1';
const visualUser = ({
  id: 'visual-proof-user',
  email: 'visual-proof@uskoci.local',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: { full_name: 'Miloš Visual Proof' },
  created_at: '2026-09-05T00:00:00.000Z',
} as unknown) as User;
const visualSession = ({
  access_token: 'visual-proof-access-token',
  refresh_token: 'visual-proof-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 4102444800,
  user: visualUser,
} as unknown) as Session;

let trenutna: SesijaStanje = visualProof
  ? { isLoaded: true, session: visualSession, user: visualUser }
  : { isLoaded: false, session: null, user: null };"""
    if old not in text:
        raise SystemExit('session initial state marker not found')
    text = text.replace(old, new, 1)

    old_init = """export function inicijalizujSesiju() {
  if (initialized) return;"""
    new_init = """export function inicijalizujSesiju() {
  if (visualProof) {
    initialized = true;
    return;
  }
  if (initialized) return;"""
    if old_init not in text:
        raise SystemExit('session init marker not found')
    text = text.replace(old_init, new_init, 1)
    path.write_text(text, encoding='utf-8')


def seed_fake_agreement() -> None:
    path = Path('src/data/lazniIzvor.ts')
    text = path.read_text(encoding='utf-8-sig')
    old = """  alokacije: [],
  dogovorVerzija: {},"""
    new = """  alokacije: [
    { dogovorId: 'd-1', prijavaId: 'p-marko', mesta: 1, povezivanjeIznos: 0 },
  ],
  dogovorVerzija: { 'd-1': 1 },"""
    if old not in text:
        raise SystemExit('fake agreement marker not found')
    text = text.replace(old, new, 1)
    if '  brojac: 0,' not in text:
        raise SystemExit('fake counter marker not found')
    text = text.replace('  brojac: 0,', '  brojac: 1,', 1)
    path.write_text(text, encoding='utf-8')


def write_fake_ai() -> None:
    ai = """import type { AiNeedV2Conversation, AiNeedV2Fact } from '../contracts/aiNeedV2';
import type { NeedFactV2Key, NeedFactValueType, NeedFactPrivacyClass } from '../contracts/needFactsV2';

const fact = (
  id: string,
  key: NeedFactV2Key,
  value: unknown,
  displayValue: string,
  valueType: NeedFactValueType,
  privacyClass: NeedFactPrivacyClass = 'PUBLIC',
  requiredForDraft = true,
): AiNeedV2Fact => ({
  id,
  key,
  value,
  displayValue,
  valueType,
  privacyClass,
  requiredForDraft,
  status: 'CONFIRMED',
  source: 'EXPLICIT_USER_ANSWER',
  evidence: displayValue,
});

let facts: AiNeedV2Fact[] = [
  fact('vf-1', 'need.title', 'Prenos ormara sa Limana na Detelinaru', 'Prenos ormara sa Limana na Detelinaru', 'TEXT'),
  fact('vf-2', 'need.description', 'Preuzeti, preneti i uneti veliki ormar na drugoj lokaciji.', 'Preuzeti, preneti i uneti veliki ormar na drugoj lokaciji.', 'TEXT'),
  fact('vf-3', 'need.category', 'Selidbe i prevoz', 'Selidbe i prevoz', 'TEXT'),
  fact('vf-4', 'need.price_mode', 'MY_PRICE', 'Moja cena', 'ENUM'),
  fact('vf-5', 'need.price_rsd', 5200, '5.200 RSD', 'INTEGER', 'PUBLIC', false),
  fact('vf-6', 'need.schedule_kind', 'TOMORROW_FLEXIBLE', 'Sutra · posle 15h', 'ENUM'),
  fact('vf-7', 'need.people_needed', 2, '2 osobe', 'INTEGER'),
  fact('vf-8', 'need.task_geography', {
    mode: 'POINT_TO_POINT',
    start: { city: 'Novi Sad', area: 'Liman' },
    end: { city: 'Novi Sad', area: 'Detelinara' },
  }, 'Liman → Detelinara', 'OBJECT'),
  fact('vf-9', 'need.required_vehicles', ['Kombi'], 'Kombi', 'TEXT_ARRAY', 'PUBLIC', false),
];

function snapshot(): AiNeedV2Conversation {
  const clonedFacts = facts.map((item) => ({ ...item }));
  return {
    conversationId: 'visual-proof-conversation',
    schemaVersion: 'NEED_FACT_V2',
    messages: [
      {
        id: 'vm-1',
        fromAi: false,
        body: 'Treba mi prevoz velikog ormara sa Limana na Detelinaru sutra posle 15h. Trebaju dve osobe i kombi.',
        safety: null,
        proposedFactIds: [],
      },
      {
        id: 'vm-2',
        fromAi: true,
        body: 'Razumem. Izdvojio sam lokaciju, termin, broj ljudi, vozilo i cenu. Pregledajte podatke pre čuvanja.',
        safety: 'ALLOW',
        proposedFactIds: clonedFacts.map((item) => item.id),
      },
    ],
    facts: clonedFacts,
    review: {
      conversationId: 'visual-proof-conversation',
      schemaVersion: 'NEED_FACT_V2',
      boundNeedId: null,
      canSaveDraft: true,
      missingRequired: [],
      facts: clonedFacts,
    },
    safety: 'ALLOW',
  };
}

export const aiNeedV2VisualProof = {
  async openConversation() {
    return { ok: true as const, podatak: { conversationId: 'visual-proof-conversation' } };
  },
  async loadConversation(_conversationId: string) {
    return snapshot();
  },
  async sendMessage(_conversationId: string, _body: string) {
    return { ok: true as const, podatak: { proposed: facts.length } };
  },
  async confirmFact(factId: string) {
    facts = facts.map((item) => item.id === factId ? { ...item, status: 'CONFIRMED' as const } : item);
    return { ok: true as const, podatak: null };
  },
  async correctFact(factId: string, value: unknown, displayValue: string) {
    const old = facts.find((item) => item.id === factId);
    if (!old) return { ok: false as const, kod: 'NOT_FOUND', poruka: 'Podatak ne postoji.' };
    const newFactId = `${factId}-corrected`;
    facts = facts.map((item) => item.id === factId
      ? { ...item, id: newFactId, value, displayValue, status: 'CONFIRMED' as const }
      : item);
    return { ok: true as const, podatak: { newFactId } };
  },
  async saveDraft(_conversationId: string, _clientRequestId: string) {
    return { ok: true as const, podatak: { needId: 'ormar' } };
  },
};
"""
    Path('src/data/aiNeedV2VisualProof.ts').write_text(ai, encoding='utf-8')

    path = Path('src/data/index.ts')
    text = path.read_text(encoding='utf-8-sig')
    import_marker = "import { aiNeedV2Production } from './aiNeedV2Production';"
    if import_marker not in text:
        raise SystemExit('AI import marker not found')
    text = text.replace(
        import_marker,
        import_marker + "\nimport { aiNeedV2VisualProof } from './aiNeedV2VisualProof';",
        1,
    )
    export_marker = 'export const aiNeedV2Izvor = aiNeedV2Production;'
    if export_marker not in text:
        raise SystemExit('AI export marker not found')
    text = text.replace(
        export_marker,
        'export const aiNeedV2Izvor = koristiLazniIzvor ? aiNeedV2VisualProof : aiNeedV2Production;',
        1,
    )
    path.write_text(text, encoding='utf-8')


def patch_app_identity() -> None:
    import json
    path = Path('app.json')
    data = json.loads(path.read_text(encoding='utf-8'))
    data.setdefault('expo', {}).setdefault('android', {})['package'] = 'rs.uskoci.visualproofall'
    data['expo']['name'] = 'USKOČI VISUAL CRAWL'
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    patch_session()
    seed_fake_agreement()
    write_fake_ai()
    patch_app_identity()
    print('visual proof fixture prepared')
