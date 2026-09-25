import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowClockwise, ArrowDown, PaperPlaneTilt, Plus, X } from 'phosphor-react-native';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import type { PorukaProjekcija } from '../contracts/projections';
import { sameMessagePhotos, type createAgreementOutbox, type OutboxError } from '../data/agreementOutbox';
import type { AgreementPhotosController } from '../hooks/useAgreementPhotos';
import { AgreementPhotoComposer } from './media/AgreementPhotoComposer';
import { AuthorizedPhoto } from './media/AuthorizedPhoto';
import { Press } from './Press';
import { FactArt } from './system/FactArt';
import { plural } from './system/plural';
import { floating, sys } from './system/tokens';
import { useTextScale } from './system/textScale';
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
  /** The surrounding frame moves identity/accepted terms into history when the keyboard or text needs the space. */
  context?: ReactNode;
  compact?: boolean;
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
function ChatAction({ label, text = label, onPress, tone = 'green', center = false, refresh = false }: { label: string; text?: string; onPress: () => void;
  tone?: 'green' | 'ink' | 'onMine'; center?: boolean; refresh?: boolean }) {
  return <Press accessibilityRole="button" accessibilityLabel={label} haptic="select" onPress={onPress}
    style={[s.chatAction, refresh && s.refreshAction, center && s.center]}>
    {refresh ? <ArrowClockwise size={16} color={sys.color.green} /> : null}
    <T variant={refresh ? 'note' : 'action'} style={{ color: tone === 'onMine' ? sys.conversation.onUser : tone === 'green' ? sys.color.green : sys.color.ink }}>{text}</T>
  </Press>;
}

/**
 * The Dogovor keeps its human speakers distinct: nuanced white incoming messages and forest-green outgoing messages,
 * with readable clocks and a day named once. Writing uses the full composer width; photo and send controls have their
 * own 48 dp toolbar below it. Pending sends retain their real outbox state (never a text-match guess), and no delivery
 * or read state is drawn that the read does not carry. The composer stays above the keyboard.
 */
export function AgreementChat({ messages, loading, error, writable, terminal, refresh, refreshWorkspace, outbox, state, support, photos,
  context, compact = false }: Props) {
  const textScale = useTextScale();
  // Which message the person is holding, for the support path that used to stand under every one.
  const [chosen, setChosen] = useState<string | null>(null);
  // The photo tools stay behind the pill's "+" until asked for, or while a photo is chosen, prepared or explained.
  const [attachOpen, setAttachOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const list = useRef<ScrollView>(null);
  // Native layout/keyboard scroll events describe geometry, not a decision to stop following.
  const following = useRef(true);
  const userScrolling = useRef(false);
  const readingOffset = useRef(0);
  const geometry = useRef({ offset: 0, viewport: 0, content: 0 });
  const contextHeight = useRef(0);
  const followFrame = useRef<number | null>(null);
  const [showLatest, setShowLatest] = useState(false);
  const cancelFollow = () => {
    if (followFrame.current !== null) cancelAnimationFrame(followFrame.current);
    followFrame.current = null;
  };
  useEffect(() => () => cancelFollow(), []);
  const followLatest = () => {
    if (!following.current || userScrolling.current) return;
    list.current?.scrollToEnd({ animated: false });
    cancelFollow();
    // The compact header can change content and viewport in adjacent native layout passes.
    followFrame.current = requestAnimationFrame(() => {
      followFrame.current = null;
      if (following.current && !userScrolling.current) list.current?.scrollToEnd({ animated: false });
    });
  };
  const chooseLatest = () => {
    following.current = true; userScrolling.current = false; setShowLatest(false); followLatest();
  };
  const readUserPosition = ({ nativeEvent: event }: NativeSyntheticEvent<NativeScrollEvent>) => {
    readingOffset.current = Math.max(0, event.contentOffset.y);
    following.current = event.contentOffset.y + event.layoutMeasurement.height >= event.contentSize.height - 80;
    setShowLatest(previous => previous === !following.current ? previous : !following.current);
  };
  const observePosition = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const native = event.nativeEvent;
    geometry.current = { offset: native.contentOffset.y, viewport: native.layoutMeasurement.height, content: native.contentSize.height };
    if (userScrolling.current) readUserPosition(event);
  };
  const previousOutgoing = useRef(new Set<string>());
  const source = useRef({ messages, support, loading, error, photos }); source.current = { messages, support, loading, error, photos };
  const supportCurrent = () => !!support && source.current.support === support && source.current.messages === messages
    && !source.current.loading && !source.current.error && support.canAct();
  const outgoingIds = state.entries.map(entry => entry.command.clientMessageId).join('|');
  useEffect(() => {
    const currentIds = new Set(outgoingIds ? outgoingIds.split('|') : []);
    if ([...currentIds].some(id => !previousOutgoing.current.has(id))) {
      chooseLatest();
    }
    previousOutgoing.current = currentIds;
  }, [outgoingIds]);
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
      <ScrollView ref={list} testID="agreement-chat-history" style={s.history} keyboardShouldPersistTaps="handled"
        onContentSizeChange={(_width, height) => { geometry.current.content = height; followLatest(); }}
        onLayout={event => { if (event) geometry.current.viewport = event.nativeEvent.layout.height; followLatest(); }}
        accessibilityActions={[{ name: 'scrollBackward', label: 'Starije poruke' }, { name: 'scrollForward', label: 'Novije poruke' }]}
        onAccessibilityAction={({ nativeEvent }) => {
          const direction = nativeEvent.actionName === 'scrollBackward' ? -1 : nativeEvent.actionName === 'scrollForward' ? 1 : 0;
          if (!direction) return;
          cancelFollow(); userScrolling.current = false;
          const { offset, viewport, content } = geometry.current;
          const end = Math.max(0, content - viewport);
          const y = Math.max(0, Math.min(end, offset + direction * viewport * 0.8));
          geometry.current.offset = readingOffset.current = y;
          following.current = direction > 0 && y >= end - 1;
          setShowLatest(!following.current);
          list.current?.scrollTo({ y, animated: false });
        }}
        scrollEventThrottle={100}
        onScrollBeginDrag={event => { cancelFollow(); userScrolling.current = true; readUserPosition(event); }}
        onScroll={observePosition}
        onScrollEndDrag={event => { readUserPosition(event); userScrolling.current = false; }}
        onMomentumScrollBegin={() => { cancelFollow(); userScrolling.current = true; }}
        onMomentumScrollEnd={event => { readUserPosition(event); userScrolling.current = false; }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={sys.color.green} colors={[sys.color.green]} />}
        contentContainerStyle={[s.list, centred ? s.listCentred : s.listBottom]}>
        <View testID="agreement-chat-context" onLayout={({ nativeEvent }) => {
          const height = nativeEvent.layout.height;
          const delta = height - contextHeight.current;
          contextHeight.current = height;
          if (following.current) followLatest();
          else if (delta && !userScrolling.current) {
            // Preserve the message's screen position when accepted terms enter/leave the top of history.
            readingOffset.current = Math.max(0, readingOffset.current + delta);
            list.current?.scrollTo({ y: readingOffset.current, animated: false });
          }
        }}>{context}</View>
        {loading && !shown.length ? <ActivityIndicator accessibilityLabel="Učitavanje poruka" color={sys.color.green} style={s.loading} /> : null}
        {/* New messages come on focus, on return to the app, after my own send, or by pulling down (there is no live
            update), and a screen reader cannot easily pull. So the refresh is also a quiet action at the head of the
            thread (review r4 rd item 4; "Povuci naniže za nove poruke." used to be the only hint). It is there in the
            empty thread too, where someone waits for the other side's first message, and not on a closed Dogovor, where
            nothing new can arrive (verify r4b rd item 4); the first read's spinner stands alone. In the empty thread it
            stands under the empty state's words, as the error state's action does, not above its drawing (verify r4c
            item 2). */}
        {!error && !terminal && (shown.length > 0 || local.length > 0) && !(loading && !shown.length)
          ? <ChatAction label="Osveži poruke" onPress={() => void refresh()} center refresh /> : null}
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
            <ChatAction label="Osveži poruke" onPress={() => void refresh()} center refresh /></>}
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
              {message.telo ? <T selectable style={[s.body,message.moja&&s.onMine]}>{message.telo}</T> : null}
              {message.fotografije?.map((photo, photoIndex) => photos ? <AuthorizedPhoto key={photo.assetId} assetId={photo.assetId}
                agreementId={photos.agreementId} messageId={message.id} label={`Fotografija poruke ${photoIndex + 1}`}
                style={s.photo} /> : null)}
              <T style={[s.time,message.moja&&s.onMine]}>{moment.clock}</T>
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
          {entry.command.body ? <T selectable style={[s.body,entry.state!=='failed'&&s.onMine]}>{entry.command.body}</T> : null}
          {entry.command.photos?.assetIds.map((assetId, photoIndex) => <AuthorizedPhoto key={assetId} assetId={assetId}
            agreementId={entry.command.agreementId} messageId={entry.messageId} label={`Fotografija poruke na čekanju ${photoIndex + 1}`}
            style={s.photo} />)}
          <T style={[s.time, entry.state === 'failed' ? s.timeFailed : s.onMine]} accessibilityLiveRegion="polite">
            {entry.state === 'sending' ? 'Šalje se…' : entry.state === 'confirmed' ? 'Poslato'
              : entry.state === 'unknown' ? 'Slanje nije potvrđeno' : 'Nije poslato'}
          </T>
          {entry.state === 'failed' && entry.error ? <T variant="meta" tone="muted">{errors[entry.error]}</T> : null}
          {(entry.state === 'unknown' || entry.state === 'failed') &&
            <ChatAction label={`Ponovi slanje poruke ${entry.command.body}`} text="Pokušaj ponovo" tone={entry.state==='failed'?'ink':'onMine'}
              onPress={() => { void outbox.retry(entry.command.clientMessageId).then(() => refresh()); }} />}
        </View>)}
      {/* Photo preparation and recovery can be taller than the remaining keyboard viewport. They belong to its
          scroll, directly above writing, so their complete explanation and every exact retry remain reachable. */}
      {state.error || state.phase === 'error' || terminal || !writable || denied || length > 2000 || photoPanel ? <View testID="agreement-chat-details" style={s.details}>
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
      </View> : null}
      </ScrollView>
      {showLatest ? <View style={s.latestRow}>
        <Press accessibilityRole="button" accessibilityLabel="Najnovije poruke" onPress={chooseLatest}
          haptic="select" hitSlop={0} style={s.latest}>
          <ArrowDown size={18} color={sys.color.green} />
          <T variant="note" tone="green">Najnovije poruke</T>
        </Press>
      </View> : null}
      {!terminal ? <View testID="agreement-chat-composer" style={[s.composerArea, compact && s.composerCompact]}>
        <View style={[s.pill, focused && s.pillFocused]}>
          <TextInput value={state.draft} onChangeText={outbox.setDraft} multiline editable={!terminal}
            accessibilityLabel="Napiši poruku" placeholder="Napiši poruku…" placeholderTextColor={sys.color.muted}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            scrollEnabled style={[s.input, compact && { paddingTop: 8, paddingBottom: 8,
              maxHeight: Math.max(COMMAND, Math.ceil(sys.type.body.lineHeight * textScale + 16)) }]} />
          <View style={s.toolbar}>
            {photos ? <Press accessibilityRole="button" accessibilityLabel="Fotografije uz poruku"
              accessibilityHint={forcedWhy}
              accessibilityState={{ expanded: photoPanel, disabled: forced }} disabled={forced}
              onPress={() => { chooseLatest(); setAttachOpen(open => !open); }} haptic={forced ? 'none' : 'select'} hitSlop={0} style={s.tool}>
              {photoPanel ? <X size={24} color={forced ? sys.color.muted : sys.color.green} /> : <Plus size={24} color={sys.color.green} />}
              <T variant="meta" style={[s.toolLabel,forced&&s.toolLabelDisabled]}>Fotografije</T>
            </Press> : null}
            <Press accessibilityRole="button" accessibilityLabel="Pošalji poruku" disabled={!canSend}
              accessibilityState={{ disabled: !canSend, busy: state.capturing }} onPress={send} haptic={canSend ? 'light' : 'none'} hitSlop={0} style={s.sendArea}>
              <View style={[s.send, canSend && s.sendReady]}>
                {state.capturing ? <ActivityIndicator color={sys.color.muted} />
                  : <PaperPlaneTilt size={22} color={canSend ? sys.color.onGreen : sys.color.muted} weight="fill" />}
              </View>
            </Press>
          </View>
        </View>
      </View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: sys.conversation.ground },
  history: { flex: 1, minHeight: 0 },
  latestRow: { alignItems: 'center', paddingHorizontal: sys.space.md },
  latest: { minHeight: COMMAND, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm,
    paddingHorizontal: sys.space.md },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, flexGrow: 1 },
  // A short conversation sits on the composer, where a reply is written; a state stands in the middle.
  listBottom: { justifyContent: 'flex-end' },
  listCentred: { justifyContent: 'center' },
  loading: { paddingVertical: 24 },
  center: { alignSelf: 'center' }, centerText: { textAlign: 'center' }, ink: { color: sys.color.ink },
  stateBlock: { gap: 8, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16 },
  stateArt: { width: 72, height: 72, borderRadius: sys.radius.card, backgroundColor: sys.conversation.iconWell, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  chatAction: { minHeight: COMMAND, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 4 },
  refreshAction: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingHorizontal: sys.space.base,
    borderWidth: 1, borderColor: sys.color.line, borderRadius: sys.radius.pill },
  day: { alignSelf: 'center', marginTop: 16, marginBottom: 4, paddingHorizontal: sys.space.md, paddingVertical: sys.space.xs,
    borderRadius: sys.radius.control, backgroundColor: sys.conversation.surface, fontSize: 12, lineHeight: 16, fontWeight: '600', color: sys.color.muted },
  bubble: { maxWidth: '82%', borderRadius: sys.radius.card, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, gap: 4 },
  // A turn of the conversation leaves air; the next message of the same person sits close under the last.
  turn: { marginTop: 12 }, run: { marginTop: 4 },
  mine: { alignSelf: 'flex-end', backgroundColor: sys.conversation.user, borderBottomRightRadius: 8 },
  // Position and surface both identify the speaker. Status and retry text follow the same contrast as their bubble.
  theirs: { alignSelf: 'flex-start', backgroundColor: sys.conversation.surface, borderWidth: 1, borderColor: sys.conversation.edge, borderBottomLeftRadius: 8 },
  // The support entry of a held message stands under it, on its side, as wide as a bubble may be.
  supportEntry: { maxWidth: '82%', marginTop: 4 },
  supportMine: { alignSelf: 'flex-end' }, supportTheirs: { alignSelf: 'flex-start' },
  failed: { backgroundColor: sys.color.dangerSoft },
  body: { ...sys.type.body, color: sys.color.ink },
  onMine: { color: sys.conversation.onUser },
  photo: { width: 220, maxWidth: '100%' },
  time: { alignSelf: 'flex-end', fontSize: 12, lineHeight: 16, fontWeight: '500', color: sys.color.muted, fontVariant: ['tabular-nums'] },
  timeFailed: { color: sys.color.danger },
  // One lifted writing surface. Its full-width draft stays above controls instead of being squeezed between them.
  composerArea: { flexShrink: 0, paddingHorizontal: sys.space.md, paddingTop: sys.space.sm, paddingBottom: sys.space.md, backgroundColor: sys.conversation.ground },
  composerCompact: { paddingTop: 4, paddingBottom: 8 },
  details: { gap: sys.space.sm, paddingTop: sys.space.sm },
  pill: { ...floating, paddingHorizontal: sys.space.sm, paddingVertical: sys.space.xs, borderRadius: sys.radius.sheet,
    borderWidth: 1, borderColor: sys.conversation.edge, backgroundColor: sys.conversation.surface },
  pillFocused: { borderColor: sys.color.green },
  toolbar: { minHeight: COMMAND, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  tool: { minWidth: COMMAND, minHeight: COMMAND, flexShrink: 1, flexDirection: 'row', gap: sys.space.sm, paddingHorizontal: sys.space.md,
    borderRadius: sys.radius.pill, backgroundColor: sys.conversation.iconWell, alignItems: 'center', justifyContent: 'center' },
  toolLabel: { flexShrink: 1, color: sys.color.green },
  toolLabelDisabled: { color: sys.color.muted },
  input: withInter({ ...sys.type.body, minWidth: 0, minHeight: COMMAND, maxHeight: 140, color: sys.color.ink,
    paddingHorizontal: sys.space.md, paddingTop: sys.space.md, paddingBottom: sys.space.md, textAlignVertical: 'top' }),
  // The send is a 48 px target around a 40 px circle: green with a white glyph when a message can go, a grey well
  // with a muted glyph when it cannot (never faded), a quiet spinner while photos are being captured.
  sendArea: { width: COMMAND, height: COMMAND, marginLeft: 'auto', alignItems: 'center', justifyContent: 'center' },
  send: { width: 40, height: 40, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: sys.color.control },
  sendReady: { backgroundColor: sys.color.green },
});
