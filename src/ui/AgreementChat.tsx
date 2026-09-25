import { Fragment, useEffect, useRef, useState } from 'react';
import { PaperPlaneTilt, Plus, X } from 'phosphor-react-native';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { PorukaProjekcija } from '../contracts/projections';
import { sameMessagePhotos, type createAgreementOutbox, type OutboxError } from '../data/agreementOutbox';
import type { AgreementPhotosController } from '../hooks/useAgreementPhotos';
import { AgreementPhotoComposer } from './media/AgreementPhotoComposer';
import { AuthorizedPhoto } from './media/AuthorizedPhoto';
import { Press } from './Press';
import { FactArt } from './system/FactArt';
import { plural } from './system/plural';
import { sys } from './system/tokens';
import { T } from './Text';
import { withInter } from './interFont';
import { positiveInteger, uuid } from '../data/serverReceipt';
import { SupportContextEntry } from './support/SupportContextEntry';

type Outbox = ReturnType<typeof createAgreementOutbox>;
type Props = {
  messages: PorukaProjekcija[];
  loading: boolean;
  error: boolean;
  writable: boolean;
  terminal: boolean;
  refresh: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
  outbox: Outbox;
  state: ReturnType<Outbox['getSnapshot']>;
  photos?: AgreementPhotosController;
  support?: { canAct: () => boolean; navigate: (action: () => void) => void };
};

const errors: Record<OutboxError, string> = {
  STORAGE_UNAVAILABLE: 'Poruka nije sačuvana na telefonu. Tekst nije odbačen; pokušaj ponovo.',
  STORAGE_INVALID: 'Poruke sačuvane na ovom telefonu nije moguće učitati. Prepiska je bezbedno sačuvana.',
  CAPACITY: 'Imaš 50 nepotvrđenih poruka. Proveri njihovo slanje pre nove poruke.',
  INVALID_MESSAGE: 'Poruka može imati od 1 do 2.000 znakova. Proveri tekst.',
  READ_ONLY: 'Dogovor trenutno ne prihvata nove poruke. Osveži njegov status.',
  NOT_AVAILABLE: 'Više nemaš pristup slanju u ovom Dogovoru. Osveži njegov status.',
  AUTH_CONTEXT_CHANGED: 'Nalog je promenjen. Vrati se na Dogovore.',
  CONFLICT: 'Ovaj pokušaj slanja ne odgovara sačuvanoj poruci. Tekst možeš kopirati.',
  UNAVAILABLE: 'Veza je prekinuta. Slanje još nije potvrđeno.',
  INVALID_RESPONSE: 'Potvrda slanja nije stigla. Pokušaj ponovo za istu poruku.',
  NOT_READY: 'Sačekaj da se učitaju sačuvane poruke.',
};

/** A command in the conversation (send, the "+", retry) is at least 48 high; the touch token is the 44 of a row. */
const COMMAND = 48;
const CLOCK = /^\d{1,2}:\d{2}$/;
/**
 * The day a message belongs to and its clock, from the words the message read already wrote (`vreme`, "24. sep · 14:05",
 * and a bare "14:05" for a message of today). Nothing is recomputed from a device clock: a text in any other shape keeps
 * its words as the time and opens no day of its own, so a day separator never says something the read did not.
 */
export function messageMoment(text: string): { day: string | null; clock: string } {
  const at = text.lastIndexOf(' · ');
  if (at > 0) return { day: text.slice(0, at), clock: text.slice(at + 3) };
  return CLOCK.test(text.trim()) ? { day: 'Danas', clock: text.trim() } : { day: null, clock: text };
}

/**
 * A message as a screen reader hears it, in one stop: who ("Ti" for mine), what (the text, then how many photos it
 * carries), and when (the day the read named, then the clock). The bubble's press hides its children, so a photo the
 * label does not name is never heard (verify r4b rd item 2).
 */
export function messageSpoken(message: Pick<PorukaProjekcija, 'moja' | 'posiljalacIme' | 'telo' | 'fotografije'>,
  moment: { day: string | null; clock: string }): string {
  const who = message.moja ? 'Ti' : message.posiljalacIme;
  const photoCount = message.fotografije?.length ?? 0;
  const what = [message.telo, photoCount ? plural(photoCount, 'fotografija', 'fotografije', 'fotografija') : '']
    .filter(Boolean).join(', ') || 'poruka bez teksta';
  return `${who}: ${what}, ${moment.day ? `${moment.day}, ` : ''}${moment.clock}`;
}

/** Quiet text action used inside the conversation (retry, refresh). The spoken label may be longer than the visible text. */
function ChatAction({ label, text = label, onPress, tone = 'green', center = false }: { label: string; text?: string; onPress: () => void;
  tone?: 'green' | 'ink'; center?: boolean }) {
  return <Press accessibilityRole="button" accessibilityLabel={label} haptic="select" onPress={onPress} style={[s.chatAction, center && s.center]}>
    <T variant="action" style={{ color: tone === 'green' ? sys.color.green : sys.color.ink }}>{text}</T>
  </Press>;
}

/**
 * The conversation of a Dogovor, calm and modern (owner step 8): the other person's messages on the left, white with the
 * card edge, mine on the right on pale green, each with its clock small and muted, a day named once above its messages, and
 * a floating pill to write in, in the look of the AI conversation's composer (text and send, with the photo tools behind
 * its "+"). Pending sends render under the list with their real outbox state (never a text-match guess), and no delivery
 * or read state is drawn that the read does not carry. The composer stays above the keyboard.
 */
export function AgreementChat({ messages, loading, error, writable, terminal, refresh, refreshWorkspace, outbox, state, support, photos }: Props) {
  // Which message the person is holding, for the support path that used to stand under every one.
  const [chosen, setChosen] = useState<string | null>(null);
  // The photo tools stay behind the pill's "+" until asked for, or while a photo is chosen, prepared or explained.
  const [attachOpen, setAttachOpen] = useState(false);
  const list = useRef<ScrollView>(null);
  const nearBottom = useRef(true);
  const initialScroll = useRef(true);
  const previousOutgoing = useRef(new Set<string>());
  const source = useRef({ messages, support, loading, error, photos }); source.current = { messages, support, loading, error, photos };
  const supportCurrent = () => !!support && source.current.support === support && source.current.messages === messages
    && !source.current.loading && !source.current.error && support.canAct();
  const outgoingIds = state.entries.map(entry => entry.command.clientMessageId).join('|');
  useEffect(() => {
    const currentIds = new Set(outgoingIds ? outgoingIds.split('|') : []);
    if ([...currentIds].some(id => !previousOutgoing.current.has(id))) {
      nearBottom.current = true;
      list.current?.scrollToEnd({ animated: false });
    }
    previousOutgoing.current = currentIds;
  }, [outgoingIds]);
  const followLatest = () => {
    if (initialScroll.current || nearBottom.current) {
      list.current?.scrollToEnd({ animated: false });
      initialScroll.current = false;
    }
  };
  const ready = state.phase === 'ready';
  const length = Array.from(state.draft.trim()).length;
  const canSend = ready && writable && !state.capturing && (!photos || photos.loaded) && !photos?.busy && (length > 0 || photos?.ready === true) && length <= 2000
    && (!photos?.hasSelection || photos.ready);
  const send = () => {
    const currentPhotos = source.current.photos;
    if (currentPhotos && !currentPhotos.canSubmit()) return;
    const attachments = currentPhotos?.capture();
    if (currentPhotos?.hasSelection && !attachments) return;
    // The photo tools fold back behind the "+" once the message has gone (review r4 rd item 6).
    void outbox.sendDraft(attachments ?? undefined).then(async () => { setAttachOpen(false); await refresh(); await currentPhotos?.refresh(); });
  };
  // Reconciliation includes the real sender/key/body in the model. Never use
  // matching text alone to pretend that an uncertain send was accepted.
  const local = state.entries.filter(entry => error || !messages.some(message =>
    message.posiljalacAccountId === entry.command.accountId && message.telo === entry.command.body
      && message.clientMessageId === entry.command.clientMessageId
      && sameMessagePhotos(entry.command.photos, message.fotografije?.length
        ? { agreementVersion: message.dogovorVerzija!, assetIds: message.fotografije.map(photo => photo.assetId) } : undefined)
      && (!entry.messageId || message.id === entry.messageId)));
  const denied = state.entries.some(entry => entry.error === 'READ_ONLY' || entry.error === 'NOT_AVAILABLE');
  // A chosen, prepared or explained photo is never hidden behind the "+": the panel opens by itself while one exists, and
  // then the "+" (drawn as the close X) cannot fold it away, so it says so instead of swapping its icon for nothing
  // (review r4 rd item 6).
  const forced = !!photos && (photos.hasSelection || !!photos.items?.length || !!photos.message || !!photos.versionConflict);
  // Why the panel cannot fold, by what holds it open (verify r4b rd item 6: "fotografije čekaju slanje" was said also when
  // only a notice about the photos, such as the camera permission, or a changed Dogovor held it).
  const forcedWhy = !forced || !photos ? undefined
    : photos.versionConflict ? 'Ostaje otvoreno dok ne ukloniš fotografije pripremljene za raniju verziju Dogovora.'
      : photos.hasSelection || photos.items?.length ? 'Ostaje otvoreno dok fotografije čekaju slanje.'
        : 'Ostaje otvoreno dok je prikazana poruka o fotografijama.';
  const photoPanel = !!photos && !terminal && (attachOpen || forced);
  const shown = !error ? messages : [];
  const empty = !loading && !error && messages.length === 0 && local.length === 0;
  // The first read's spinner stands in the middle like every other state, not on the composer (review r4 rd item 8).
  const centred = empty || error || (loading && !shown.length && !local.length);
  let previousDay: string | null = null;
  return (
    <View style={s.screen}>
      <ScrollView ref={list} keyboardShouldPersistTaps="handled" onContentSizeChange={followLatest} onLayout={followLatest}
        scrollEventThrottle={100} onScroll={({ nativeEvent: event }) => {
          nearBottom.current = event.contentOffset.y + event.layoutMeasurement.height >= event.contentSize.height - 80;
        }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={sys.color.green} colors={[sys.color.green]} />}
        contentContainerStyle={[s.list, centred ? s.listCentred : s.listBottom]}>
        {loading && !shown.length ? <ActivityIndicator accessibilityLabel="Učitavanje poruka" color={sys.color.green} style={s.loading} /> : null}
        {/* New messages come on focus, on return to the app, after my own send, or by pulling down (there is no live
            update), and a screen reader cannot easily pull. So the refresh is also a quiet action at the head of the
            thread (review r4 rd item 4; "Povuci naniže za nove poruke." used to be the only hint). It is there in the
            empty thread too, where someone waits for the other side's first message, and not on a closed Dogovor, where
            nothing new can arrive (verify r4b rd item 4); the first read's spinner stands alone. In the empty thread it
            stands under the empty state's words, as the error state's action does, not above its drawing (verify r4c
            item 2). */}
        {!error && !terminal && (shown.length > 0 || local.length > 0) && !(loading && !shown.length)
          ? <ChatAction label="Osveži poruke" onPress={() => void refresh()} center /> : null}
        {error ? <View style={s.stateBlock} accessibilityLiveRegion="polite">
          <View style={s.stateArt}><FactArt kind="chat" size={40} muted /></View>
          <T accessibilityRole="alert" variant="bodyStrong" style={[s.ink, s.centerText]}>Poruke nisu učitane</T>
          <T variant="note" tone="muted" style={s.centerText}>Proveri vezu. Tvoj tekst ostaje sačuvan.</T>
          <ChatAction label="Ponovo učitaj poruke" text="Pokušaj ponovo" onPress={() => void refresh()} center />
        </View> : null}
        {empty ? <View style={s.stateBlock}>
          <View style={s.stateArt}><FactArt kind="chat" size={40} muted={terminal} /></View>
          {/* A finished Dogovor with no messages cannot take a first one; it says so instead of inviting it. */}
          {terminal ? <T variant="copy" tone="muted" style={s.centerText}>U ovom Dogovoru nije bilo poruka.</T> : <>
            <T accessibilityRole="header" variant="title" style={[s.ink, s.centerText]}>Napiši prvu poruku</T>
            <T variant="copy" tone="muted" style={s.centerText}>Poruke vide samo učesnici ovog Dogovora.</T>
            <ChatAction label="Osveži poruke" onPress={() => void refresh()} center /></>}
        </View> : null}
        {shown.map((message, index) => {
          const moment = messageMoment(message.vremeTekst);
          const newDay = moment.day !== null && moment.day !== previousDay;
          if (moment.day !== null) previousDay = moment.day;
          // Messages of one person in a row sit close; a turn of the conversation leaves air.
          const before = shown[index - 1];
          const sameRun = !!before && !newDay && before.moja === message.moja;
          return <Fragment key={message.id}>
            {newDay ? <T accessibilityRole="header" style={s.day}>{moment.day}</T> : null}
            {/* The bubble is one stop for a screen reader, so its label says the message itself: who, what, when
                (review r4 rd item 2; it said only "Poruka: <ime>", and the text and the time were never heard). */}
            <Press accessibilityRole="button" accessibilityLabel={messageSpoken(message, moment)} accessibilityHint="Dugi pritisak nudi prijavu podršci."
              onLongPress={() => setChosen(current => current === message.id ? null : message.id)} haptic="select" scaleTo={1}
              style={[s.bubble, message.moja ? s.mine : s.theirs, sameRun ? s.run : s.turn]}>
              {message.telo ? <T selectable style={s.body}>{message.telo}</T> : null}
              {message.fotografije?.map((photo, photoIndex) => photos ? <AuthorizedPhoto key={photo.assetId} assetId={photo.assetId}
                agreementId={photos.agreementId} messageId={message.id} label={`Fotografija poruke ${photoIndex + 1}`}
                style={s.photo} /> : null)}
              <T style={s.time}>{moment.clock}</T>
            </Press>
            {/* This stood under every message, full width, doubling the height of the transcript. It belongs to the
                message a person actually wants to report, which is the one they hold. It stands under that bubble, on
                its side, as a sibling: inside the bubble's press its own buttons were a target inside a target, and a
                screen reader never reached them. */}
            {support && chosen === message.id && uuid(message.id) && positiveInteger(message.dogovorVerzija) ? <View
              style={[s.supportEntry, message.moja ? s.supportMine : s.supportTheirs]}><SupportContextEntry
                reference={{ kind: 'AGREEMENT_MESSAGE', id: message.id.toLowerCase(), revision: message.dogovorVerzija }}
                label="Izaberi ovu poruku za podršku" previewText={[message.telo, message.fotografije?.length
                  ? `Privatne fotografije uz ovu poruku: ${message.fotografije.length}. Uključene su u izabrani dokaz.` : ''].filter(Boolean).join('\n')} disabled={loading}
                canAct={supportCurrent} navigate={support.navigate} /></View> : null}
          </Fragment>;
        })}
        {/* What I sent and the read has not returned yet: said by its real outbox state, with no day of its own (an
            unconfirmed send may be older than today). */}
        {local.map((entry, index) => <View key={entry.command.clientMessageId}
          style={[s.bubble, s.mine, entry.state === 'failed' && s.failed, index || shown[shown.length - 1]?.moja ? s.run : s.turn]}>
          {entry.command.body ? <T selectable style={s.body}>{entry.command.body}</T> : null}
          {entry.command.photos?.assetIds.map((assetId, photoIndex) => <AuthorizedPhoto key={assetId} assetId={assetId}
            agreementId={entry.command.agreementId} messageId={entry.messageId} label={`Fotografija poruke na čekanju ${photoIndex + 1}`}
            style={s.photo} />)}
          <T style={[s.time, entry.state === 'failed' && s.timeFailed]} accessibilityLiveRegion="polite">
            {entry.state === 'sending' ? 'Šalje se…' : entry.state === 'confirmed' ? 'Poslato'
              : entry.state === 'unknown' ? 'Slanje nije potvrđeno' : 'Nije poslato'}
          </T>
          {entry.state === 'failed' && entry.error ? <T variant="meta" tone="muted">{errors[entry.error]}</T> : null}
          {(entry.state === 'unknown' || entry.state === 'failed') &&
            <ChatAction label={`Ponovi slanje poruke ${entry.command.body}`} text="Pokušaj ponovo" tone="ink"
              onPress={() => { void outbox.retry(entry.command.clientMessageId).then(() => refresh()); }} />}
        </View>)}
      </ScrollView>
      <View style={s.composerArea}>
        {state.error ? <T variant="meta" tone="danger" accessibilityLiveRegion="polite">{errors[state.error]}</T> : null}
        {state.phase === 'error' ? <ChatAction label="Ponovo učitaj sačuvane poruke" onPress={() => void outbox.start()} /> : null}
        {/* A closed Dogovor keeps its conversation to read; the composer, the photo tools and the refresh helper
            used to stay under it, a third of the screen with nothing to do (emulator, 2026-09-23). One line remains.
            It says "zatvoren", which is true of a finished and of a cancelled Dogovor alike. */}
        {terminal ? <T variant="meta" tone="muted" style={s.centerText}>Dogovor je zatvoren · poruke su samo za čitanje.</T> : null}
        {!terminal && !writable ? <T variant="meta" tone="muted">Osveži Dogovor pre nove poruke. Nacrt ostaje sačuvan.</T> : null}
        {!terminal && (!writable || denied) ? <ChatAction label="Osveži status Dogovora" onPress={() => void refreshWorkspace()} /> : null}
        {!terminal && length > 2000 ? <T variant="meta" tone="danger">{length.toLocaleString('sr-Latn-RS')} / 2.000 znakova — skrati poruku.</T> : null}
        {photos && photoPanel ? <AgreementPhotoComposer photos={photos} capturing={state.capturing} /> : null}
        {terminal ? null : <View style={s.pill}>
          {photos ? <Press accessibilityRole="button" accessibilityLabel="Fotografije uz poruku"
            accessibilityHint={forcedWhy}
            accessibilityState={{ expanded: photoPanel, disabled: forced }} disabled={forced}
            onPress={() => setAttachOpen(open => !open)} haptic={forced ? 'none' : 'select'} style={s.tool}>
            {photoPanel ? <X size={22} color={forced ? sys.color.muted : sys.color.ink} /> : <Plus size={22} color={sys.color.ink} />}
          </Press> : null}
          <TextInput value={state.draft} onChangeText={outbox.setDraft} multiline editable={!terminal}
            accessibilityLabel="Napiši poruku" placeholder="Napiši poruku…" placeholderTextColor={sys.color.muted}
            style={[s.input, !photos && s.inputAlone]} />
          <Press accessibilityRole="button" accessibilityLabel="Pošalji poruku" disabled={!canSend}
            accessibilityState={{ disabled: !canSend, busy: state.capturing }} onPress={send} haptic={canSend ? 'light' : 'none'} style={s.sendArea}>
            <View style={[s.send, canSend && s.sendReady]}>
              {state.capturing ? <ActivityIndicator color={sys.color.muted} />
                : <PaperPlaneTilt size={20} color={canSend ? sys.color.onGreen : sys.color.muted} weight="fill" />}
            </View>
          </Press>
        </View>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, flexGrow: 1 },
  // A short conversation sits on the composer, where a reply is written; a state stands in the middle.
  listBottom: { justifyContent: 'flex-end' },
  listCentred: { justifyContent: 'center' },
  loading: { paddingVertical: 24 },
  center: { alignSelf: 'center' }, centerText: { textAlign: 'center' }, ink: { color: sys.color.ink },
  stateBlock: { gap: 8, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16 },
  stateArt: { width: 72, height: 72, borderRadius: sys.radius.card, backgroundColor: sys.color.wash, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  chatAction: { minHeight: COMMAND, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 4 },
  day: { alignSelf: 'center', marginTop: 16, marginBottom: 4, fontSize: 12, lineHeight: 16, fontWeight: '600', color: sys.color.muted },
  bubble: { maxWidth: '82%', borderRadius: sys.radius.card, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, gap: 4 },
  // A turn of the conversation leaves air; the next message of the same person sits close under the last.
  turn: { marginTop: 12 }, run: { marginTop: 4 },
  mine: { alignSelf: 'flex-end', backgroundColor: sys.color.greenSoft, borderBottomRightRadius: 8 },
  // The other person's messages are white with the card edge, so the two sides differ by more than their place: the wash
  // (#F2F7F4) beside pale green (#EFF6F0) read as one colour (review r4 rd item 5).
  theirs: { alignSelf: 'flex-start', backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.cardLine, borderBottomLeftRadius: 8 },
  // The support entry of a held message stands under it, on its side, as wide as a bubble may be.
  supportEntry: { maxWidth: '82%', marginTop: 4 },
  supportMine: { alignSelf: 'flex-end' }, supportTheirs: { alignSelf: 'flex-start' },
  failed: { backgroundColor: sys.color.dangerSoft },
  body: { fontSize: 16, lineHeight: 22, color: sys.color.ink },
  photo: { width: 220, maxWidth: '100%' },
  time: { alignSelf: 'flex-end', fontSize: 12, lineHeight: 16, fontWeight: '500', color: sys.color.muted, fontVariant: ['tabular-nums'] },
  timeFailed: { color: sys.color.danger },
  // The composer floats: no rule above it, only air around one soft pill.
  composerArea: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10, gap: 8, backgroundColor: sys.color.surface },
  pill: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, padding: 4, borderRadius: sys.radius.sheet, backgroundColor: sys.color.wash },
  tool: { width: COMMAND, height: COMMAND, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  input: withInter({ flex: 1, minHeight: COMMAND, maxHeight: 140, fontSize: 16, lineHeight: 22, color: sys.color.ink, paddingHorizontal: 4,
    paddingTop: 13, paddingBottom: 13, textAlignVertical: 'top' }),
  inputAlone: { paddingHorizontal: 14 },
  // The send is a 48 px target around a 40 px circle: green with a white glyph when a message can go, a grey well
  // with a muted glyph when it cannot (never faded), a quiet spinner while photos are being captured.
  sendArea: { width: COMMAND, height: COMMAND, alignItems: 'center', justifyContent: 'center' },
  send: { width: 40, height: 40, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: sys.color.control },
  sendReady: { backgroundColor: sys.color.green },
});
