import { useState, type ComponentProps } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Bell } from 'phosphor-react-native';
import type { DogovorProjekcija, PorukaProjekcija, UcesnikProjekcija } from '../contracts/projections';
import type { AgreementPhotosController } from '../hooks/useAgreementPhotos';
import { AgreementChat } from '../ui/AgreementChat';
import { NextStepCard, WorkspaceFooter, WorkspaceRow, WorkspaceRows, agreementNextStep } from '../ui/agreements/AgreementWorkspace';
import { Press } from '../ui/Press';
import { ProductHeader } from '../ui/product/ProductDetails';
import { ChromeIconButton, ScreenChrome } from '../ui/system/ScreenChrome';
import { sys } from '../ui/system/tokens';
import { T } from '../ui/Text';
import { AgreementCollectionPresentation, type AgreementCollectionSection } from '../ui/v2/AgreementCollectionPresentation';
import { AgreementHero, AgreementPeople, AgreementPersonBar, AgreementSection, AgreementTabs, isGroupAgreement,
  type AgreementTab } from '../ui/v2/AgreementPresentation';

/**
 * The Dogovori gallery (owner step 8): the real presentation of the Dogovori list, the Dogovor's Pregled and its Poruke,
 * drawn from fixtures in their main states so the lead can photograph them on the emulator, where opening the real
 * screens writes to the server (the Poruke tab settles notifications). Reached only by its address
 * (uskociapp://dizajn-dogovori) in the internal build; the store package shows nothing. Nothing here reads or writes
 * data: no photo, inbox, group or profile read is drawn (every person has no public profile id, and the root bar's bell
 * is a still one), and every command is a no-op. Large text is the system's: set the font scale on the device.
 */
const noop = () => {};
const later = async () => {};

const ME_REQUESTER: UcesnikProjekcija = { id: 'ja', profilId: null, ime: 'Ana Petrović', inicijali: 'AP', uloga: 'narucilac', mesta: null, viSte: true, telefon: null };
const ME_WORKER: UcesnikProjekcija = { ...ME_REQUESTER, uloga: 'uskocer', mesta: 1 };
const worker = (ime: string, inicijali: string, mesta = 1): UcesnikProjekcija =>
  ({ id: `druga-${inicijali}`, profilId: null, ime, inicijali, uloga: 'uskocer', mesta, viSte: false, telefon: null });
const requester = (ime: string, inicijali: string): UcesnikProjekcija =>
  ({ id: `druga-${inicijali}`, profilId: null, ime, inicijali, uloga: 'narucilac', mesta: null, viSte: false, telefon: null });

function agreement(id: string, patch: Partial<DogovorProjekcija> = {}): DogovorProjekcija {
  return { id, verzija: 1, naslov: 'Prenos ormana do kombija', stanje: 'CONFIRMED', cena: { iznos: 5500, valuta: 'RSD', prikaz: '5.500 RSD' },
    vremeTekst: '26. sep · 17:00–19:00', putanjaTekst: 'Liman, Novi Sad', pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 },
    ucesnici: [ME_REQUESTER, worker('Marko Jovanović', 'MJ')], rezim: 'FIZICKI',
    kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: true, tacnaLokacija: null, emailNijeDeljen: true },
    chatDostupan: true, rokPotvrdeIso: null, problemOtvoren: false, ocenaMoguca: false, hronologija: [], radnje: null,
    pocinje: '2026-09-26T15:00:00Z', izmenaCeka: null, izvor: { zadatakId: 'zadatak', prijavaId: 'prijava' }, ...patch };
}

const LIST: DogovorProjekcija[] = [
  agreement('zona', { vremeTekst: '26. sep · 17:00–19:00 (po vremenu u Srbiji)' }),
  agreement('potvrda', { stanje: 'AWAITING_REQUESTER', naslov: 'Montaža police u hodniku', cena: { iznos: 2000, valuta: 'RSD', prikaz: '2.000 RSD' },
    vremeTekst: '24. sep · 09:00–11:00', putanjaTekst: 'Grbavica, Novi Sad', pocinje: '2026-09-24T07:00:00Z',
    ucesnici: [ME_REQUESTER, worker('Stefan Ilić', 'SI')] }),
  agreement('izmena', { naslov: 'Košenje trave u dvorištu', ucesnici: [ME_WORKER, requester('Jelena Nikolić', 'JN')], vremeTekst: '28. sep · 08:00–12:00',
    putanjaTekst: 'Sremska Kamenica', izmenaCeka: { predlogId: 'predlog', mojPredlog: false }, pocinje: '2026-09-28T06:00:00Z' }),
  agreement('ocena', { stanje: 'COMPLETED', ocenaMoguca: true, naslov: 'Pomoć pri selidbi', vremeTekst: '20. sep · 10:00–14:00', chatDostupan: false,
    ucesnici: [ME_WORKER, requester('Milica Stojanović', 'MS')], pocinje: '2026-09-20T08:00:00Z' }),
  agreement('grupa', { naslov: 'Prevod uputstva na engleski', rezim: 'DALJINSKI', putanjaTekst: '', vremeTekst: 'Termin nije potvrđen', pocinje: null,
    pokrivenost: { ukupno: 3, popunjeno: 2, preostalo: 1, udeo: 2 / 3 }, verzija: 2, izmenaCeka: { predlogId: 'moj', mojPredlog: true }, problemOtvoren: true,
    ucesnici: [ME_REQUESTER, worker('Nikola Marković', 'NM', 2)] }),
  agreement('bez-termina', { stanje: 'COMPLETED', vremeTekst: 'Termin nije potvrđen', chatDostupan: false, naslov: 'Čišćenje podruma' }),
  agreement('otkazan', { stanje: 'CANCELLED', cena: { iznos: 0, valuta: 'RSD', prikaz: '' }, chatDostupan: false, naslov: 'Farbanje ograde',
    ucesnici: [ME_WORKER, requester('Druga strana', '')] }),
];
const LONG: DogovorProjekcija[] = [
  agreement('dugo', { naslov: 'Prenos trosed i dve fotelje sa trećeg sprata zgrade bez lifta do kombija ispred ulaza',
    vremeTekst: '26. sep · 22:00 – 27. sep · 06:00 (po vremenu u Srbiji)', putanjaTekst: 'Petrovaradinska tvrđava, Petrovaradin, Novi Sad',
    cena: { iznos: 125000, valuta: 'RSD', prikaz: '125.000 RSD' },
    ucesnici: [ME_REQUESTER, worker('Aleksandra Konstantinović-Radovanović', 'AK', 4)], pokrivenost: { ukupno: 4, popunjeno: 4, preostalo: 0, udeo: 1 } }),
  agreement('dugo-ocena', { stanje: 'COMPLETED', ocenaMoguca: true, chatDostupan: false,
    naslov: 'Sklapanje garderobera od tri krila sa kliznim vratima i ogledalom u spavaćoj sobi',
    ucesnici: [ME_WORKER, requester('Vladimir Aleksandrović Petrović', 'VA')] }),
];

const OTHER = 'druga-MJ';
const message = (n: number, moja: boolean, telo: string, vremeTekst: string): PorukaProjekcija => ({ id: `poruka-${n}`, dogovorVerzija: 1,
  clientMessageId: null, posiljalacAccountId: moja ? 'ja' : OTHER, posiljalacIme: moja ? 'Ja' : 'Marko Jovanović', moja, telo, vremeTekst, procitano: null });
const MESSAGES: PorukaProjekcija[] = [
  message(1, false, 'Zdravo! Da li je orman već rasklopljen?', '23. sep · 18:10'),
  message(2, true, 'Jeste, u dva dela je. Treba samo da se snese do kombija.', '23. sep · 18:12'),
  message(3, true, 'Zgrada nema lift, treći sprat.', '23. sep · 18:12'),
  message(4, false, 'Nema problema, dolazim sa još jednom osobom. Ponesite samo ključ od podruma ako tamo stoje delovi, da ne tražimo portira u sedam ujutru.', '09:05'),
  message(5, false, 'Stižem oko 17:00.', '09:06'),
];
type ChatProps = ComponentProps<typeof AgreementChat>;
const PENDING: ChatProps['state']['entries'] = [
  { command: { accountId: 'ja', agreementId: 'zona', clientMessageId: 'galerija-salje', body: 'Super, vidimo se.' }, state: 'sending', persisted: true, attempt: 1 },
  { command: { accountId: 'ja', agreementId: 'zona', clientMessageId: 'galerija-greska', body: 'Parking je iza zgrade.' }, state: 'failed',
    error: 'UNAVAILABLE', persisted: true, attempt: 2 },
];
/** A photo tool that can do nothing: the gallery shows the "+" and its panel, never a picker or an upload. */
const PHOTOS = { agreementId: 'zona', loaded: true, busy: false, ready: false, hasSelection: false, available: false, items: [], saved: [],
  message: null, versionConflict: false, canSubmit: () => false, capture: () => null, refresh: later, pick: later, retry: later, remove: later,
  restore: later, reserved: () => false, canRetry: () => false } as unknown as AgreementPhotosController;

type SceneKey = 'list' | 'history' | 'long' | 'empty' | 'loading' | 'error' | 'one' | 'group' | 'done' | 'waiting' | 'worker'
  | 'chat' | 'chat-empty' | 'chat-loading' | 'chat-error' | 'chat-closed';
const SCENES: { key: SceneKey; label: string }[] = [
  { key: 'list', label: 'Lista' }, { key: 'history', label: 'Istorija' }, { key: 'long', label: 'Dugačka imena' }, { key: 'empty', label: 'Prazno' },
  { key: 'loading', label: 'Učitavanje' }, { key: 'error', label: 'Greška' }, { key: 'one', label: 'Pregled 1:1' }, { key: 'worker', label: 'Pregled · uskačem' },
  { key: 'group', label: 'Pregled · grupa' }, { key: 'waiting', label: 'Pregled · čeka potvrdu' }, { key: 'done', label: 'Pregled · završen' },
  { key: 'chat', label: 'Poruke' }, { key: 'chat-empty', label: 'Poruke · prazne' }, { key: 'chat-loading', label: 'Poruke · učitavanje' },
  { key: 'chat-error', label: 'Poruke · greška' }, { key: 'chat-closed', label: 'Poruke · zatvoren' },
];

/** The root bar as the Dogovori tab draws it, with a bell that reads nothing. */
const STILL_HEADER = <ScreenChrome variant="root" title="Dogovori" onProfile={noop}
  bell={<ChromeIconButton label="Obaveštenja" icon={Bell} tone="green" onPress={noop} />} />;

function ListScene({ items, loading = false, error = false, initial = 'active' }: { items: DogovorProjekcija[]; loading?: boolean; error?: boolean;
  initial?: AgreementCollectionSection }) {
  const [section, setSection] = useState<AgreementCollectionSection>(initial);
  const [only, setOnly] = useState(false);
  return <AgreementCollectionPresentation items={items} loading={loading} error={error} section={section} confirmationOnly={only}
    onSection={setSection} onConfirmationOnly={setOnly} onRefresh={noop} onOpen={noop} onRate={noop} onCalendar={noop} onProfile={noop}
    onHome={noop} header={STILL_HEADER} />;
}

function Chat({ messages = MESSAGES, entries = PENDING, loading = false, error = false, terminal = false }: {
  messages?: PorukaProjekcija[]; entries?: ChatProps['state']['entries']; loading?: boolean; error?: boolean; terminal?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const outbox = { setDraft, sendDraft: later, retry: later, start: later, reconcile: later } as unknown as ChatProps['outbox'];
  return <AgreementChat messages={messages} loading={loading} error={error} writable={!terminal} terminal={terminal} refresh={later}
    refreshWorkspace={later} outbox={outbox} state={{ phase: 'ready', draft, capturing: false, entries, error: null }} photos={PHOTOS} />;
}

/** The Dogovor as its route composes it: the person's bar, the tabs, the Pregled and its footer, or the Poruke. */
function DogovorScene({ item, me, ownRating = 'NOT_APPLICABLE', brand, initialTab = 'pregled', chat }: {
  item: DogovorProjekcija; me: UcesnikProjekcija; ownRating?: 'DUE' | 'GIVEN' | 'CLOSED' | 'UNKNOWN' | 'NOT_APPLICABLE'; brand: string;
  initialTab?: AgreementTab; chat?: ComponentProps<typeof Chat>;
}) {
  const [tab, setTab] = useState<AgreementTab>(initialTab);
  const other = item.ucesnici.find(person => !person.viSte);
  const isWorker = me.uloga === 'uskocer';
  const active = item.stanje === 'CONFIRMED' || item.stanje === 'AWAITING_REQUESTER';
  const step = agreementNextStep({ state: item.stanje, party: true, worker: isWorker, change: { waits: false, mine: null }, ownRating,
    problemOpen: item.problemOtvoren, deadline: 'Do 27. sep · 17:00' });
  return <View style={s.fill}>
    {other ? <AgreementPersonBar person={other} back={noop} /> : <ProductHeader back={noop} title="Dogovor" />}
    <View style={s.tabs}>
      <AgreementTabs tab={tab} onChange={setTab} />
      {tab === 'poruke' ? <AgreementHero agreement={item} compact onOpen={() => setTab('pregled')} /> : null}
    </View>
    {tab === 'poruke' ? <Chat {...chat} terminal={chat?.terminal ?? !item.chatDostupan} /> : <>
      <ScrollView contentContainerStyle={s.content}>
        <AgreementHero agreement={item} />
        <NextStepCard tone={step.tone} title={step.title} body={step.body} />
        {isGroupAgreement(item) ? <AgreementPeople agreement={item} /> : null}
        <WorkspaceRows>
          <WorkspaceRow art="tasks" label="Zadatak" onPress={noop} />
          {isWorker ? <WorkspaceRow art="offers" label="Tvoja prijava" onPress={noop} /> : null}
          {active ? <WorkspaceRow art="document" label="Izmene i otkazivanje Dogovora" hint="Cena, obim, termin ili otkazivanje uz razlog" onPress={noop} /> : null}
          {active && item.rezim !== 'DALJINSKI' ? <WorkspaceRow art="pin" label={isWorker ? 'Podeli svoju trenutnu lokaciju' : 'Trenutna lokacija osobe koja dolazi'}
            hint="Jedna tačka, samo uz pristanak" onPress={noop} /> : null}
          <WorkspaceRow art="shield" label="Bezbednost i privatna prijava" hint="Blokiranje i poverljiva prijava podršci" onPress={noop} />
        </WorkspaceRows>
        <AgreementSection art="phone" label="Kontakt" summary="Podeli svoj broj kada ti odgovara">
          <T variant="meta" tone="muted">Deljenje je odvojeno u oba smera. Kada podeliš svoj broj, druga strana ne deli automatski svoj.</T>
        </AgreementSection>
      </ScrollView>
      <WorkspaceFooter brand={{ label: brand, onPress: brand === 'Otvori poruke' ? () => setTab('poruke') : noop }} />
    </>}
  </View>;
}

function Scene({ scene }: { scene: SceneKey }) {
  switch (scene) {
    case 'list': return <ListScene items={LIST} />;
    case 'history': return <ListScene items={LIST} initial="history" />;
    case 'long': return <ListScene items={LONG} />;
    case 'empty': return <ListScene items={[]} />;
    case 'loading': return <ListScene items={LIST} loading />;
    case 'error': return <ListScene items={LIST} error />;
    case 'one': return <DogovorScene item={LIST[0]} me={ME_REQUESTER} brand="Otvori poruke" />;
    case 'worker': return <DogovorScene item={LIST[2]} me={ME_WORKER} brand="Otvori poruke" />;
    case 'group': return <DogovorScene item={LIST[4]} me={ME_REQUESTER} brand="Otvori poruke" />;
    case 'waiting': return <DogovorScene item={LIST[1]} me={ME_REQUESTER} brand="Potvrdi završetak" />;
    case 'done': return <DogovorScene item={LIST[5]} me={ME_REQUESTER} ownRating="DUE" brand="Oceni saradnju" />;
    case 'chat': return <DogovorScene item={LIST[0]} me={ME_REQUESTER} brand="Otvori poruke" initialTab="poruke" />;
    case 'chat-empty': return <DogovorScene item={LIST[0]} me={ME_REQUESTER} brand="Otvori poruke" initialTab="poruke" chat={{ messages: [], entries: [] }} />;
    case 'chat-loading': return <DogovorScene item={LIST[0]} me={ME_REQUESTER} brand="Otvori poruke" initialTab="poruke" chat={{ messages: [], entries: [], loading: true }} />;
    case 'chat-error': return <DogovorScene item={LIST[0]} me={ME_REQUESTER} brand="Otvori poruke" initialTab="poruke" chat={{ error: true, entries: [] }} />;
    case 'chat-closed': return <DogovorScene item={LIST[5]} me={ME_REQUESTER} ownRating="DUE" brand="Oceni saradnju" initialTab="poruke" chat={{ entries: [] }} />;
  }
}

export default function DizajnDogovori() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  const [scene, setScene] = useState<SceneKey>('list');
  if (!internal) return <View style={s.screen}><T>Nije dostupno.</T></View>;
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <ScreenChrome variant="detail" title="Dogovori · galerija" onBack={() => router.back()} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.picker} contentContainerStyle={s.pickerRow}>
      {SCENES.map(option => <Press key={option.key} accessibilityRole="tab" accessibilityLabel={option.label} accessibilityState={{ selected: option.key === scene }}
        haptic="select" onPress={() => setScene(option.key)} style={[s.chip, option.key === scene && s.chipOn]}>
        <T variant="meta" style={[s.chipText, option.key === scene && s.chipTextOn]}>{option.label}</T>
      </Press>)}
    </ScrollView>
    {/* Each scene is mounted fresh, so its tabs and draft start where the scene says. */}
    <View key={scene} style={s.fill}><Scene scene={scene} /></View>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  fill: { flex: 1 },
  picker: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: sys.color.line },
  pickerRow: { gap: 8, paddingHorizontal: 20, paddingVertical: 8 },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.line },
  chipOn: { borderColor: sys.color.green, backgroundColor: sys.color.greenSoft },
  chipText: { color: sys.color.ink, fontWeight: '600' }, chipTextOn: { color: sys.color.green },
  tabs: { paddingHorizontal: 20, paddingBottom: 12, gap: 10 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, gap: 16 },
});
