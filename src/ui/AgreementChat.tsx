import { useEffect, useRef } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { V2Icon } from './v2/icons';
import type { PorukaProjekcija } from '../contracts/projections';
import { sameMessagePhotos, type createAgreementOutbox, type OutboxError } from '../data/agreementOutbox';
import type { AgreementPhotosController } from '../hooks/useAgreementPhotos';
import { AgreementPhotoComposer } from './media/AgreementPhotoComposer';
import { AuthorizedPhoto } from './media/AuthorizedPhoto';
import { Press } from './Press';
import { sys } from './system/tokens';
import { T } from './Text';
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
  STORAGE_UNAVAILABLE: 'Poruka nije sačuvana na telefonu. Tekst nije odbačen; pokušajte ponovo.',
  STORAGE_INVALID: 'Sačuvane poruke nije moguće učitati. Ostale poruke su bezbedne na serveru.',
  CAPACITY: 'Imate 50 nepotvrđenih poruka. Proverite njihovo slanje pre nove poruke.',
  INVALID_MESSAGE: 'Poruka može imati od 1 do 2.000 znakova. Proverite tekst.',
  READ_ONLY: 'Dogovor trenutno ne prihvata nove poruke. Osvežite njegov status.',
  NOT_AVAILABLE: 'Više nemate pristup slanju u ovom Dogovoru. Osvežite njegov status.',
  AUTH_CONTEXT_CHANGED: 'Nalog je promenjen. Vratite se na Dogovore.',
  CONFLICT: 'Ovaj pokušaj slanja ne odgovara sačuvanoj poruci. Tekst možete kopirati.',
  UNAVAILABLE: 'Veza je prekinuta. Slanje još nije potvrđeno.',
  INVALID_RESPONSE: 'Potvrda slanja nije stigla. Pokušajte ponovo za istu poruku.',
  NOT_READY: 'Sačekajte da se učitaju sačuvane poruke.',
};

/** Quiet text action used inside the conversation (retry, refresh). The spoken label may be longer than the visible text. */
function ChatAction({ label, text = label, onPress, tone = 'green' }: { label: string; text?: string; onPress: () => void; tone?: 'green' | 'ink' }) {
  return <Press accessibilityRole="button" accessibilityLabel={label} haptic="select" onPress={onPress} style={s.chatAction}>
    <T variant="action" style={{ color: tone === 'green' ? sys.color.green : sys.color.ink }}>{text}</T>
  </Press>;
}

/**
 * Agreement conversation. Own messages sit right in a soft green bubble, the other
 * party's sit left on white; pending sends render under the list with their real
 * outbox state (never a text-match guess). The composer stays above the keyboard.
 */
export function AgreementChat({ messages, loading, error, writable, terminal, refresh, refreshWorkspace, outbox, state, support, photos }: Props) {
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
    void outbox.sendDraft(attachments ?? undefined).then(async () => { await refresh(); await currentPhotos?.refresh(); });
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
  return (
    <View style={s.screen}>
      <ScrollView ref={list} keyboardShouldPersistTaps="handled" onContentSizeChange={followLatest} onLayout={followLatest}
        scrollEventThrottle={100} onScroll={({ nativeEvent: event }) => {
          nearBottom.current = event.contentOffset.y + event.layoutMeasurement.height >= event.contentSize.height - 80;
        }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={sys.color.green} />}
        contentContainerStyle={s.list}>
        <T variant="meta" tone="muted" style={s.center}>Razgovor o ovom Dogovoru. Povucite naniže za nove poruke.</T>
        {loading && <ActivityIndicator accessibilityLabel="Učitavanje poruka" color={sys.color.green} />}
        {error && <View style={s.errorBlock}>
          <T variant="bodyStrong" style={s.ink}>Poruke nisu učitane</T>
          <T variant="meta" tone="muted">Proverite vezu. Vaš tekst ostaje sačuvan.</T>
          <Press accessibilityRole="button" accessibilityLabel="Ponovo učitaj poruke" haptic="select" onPress={() => void refresh()} style={s.chatAction}>
            <T variant="action" style={{ color: sys.color.green }}>Pokušajte ponovo</T>
          </Press>
        </View>}
        {!loading && !error && messages.length === 0 && local.length === 0 &&
          <T variant="meta" tone="muted" style={[s.center, s.emptyCopy]}>Još nema poruka.</T>}
        {!error && messages.map(message => <View key={message.id} style={[s.bubble, message.moja ? s.mine : s.theirs]}>
          {!message.moja && <T variant="meta" style={s.sender}>{message.posiljalacIme}</T>}
          <T selectable variant="body" style={s.ink}>{message.telo}</T>
          {message.fotografije?.map((photo, index) => photos ? <AuthorizedPhoto key={photo.assetId} assetId={photo.assetId}
            agreementId={photos.agreementId} messageId={message.id} label={`Fotografija poruke ${index + 1}`}
            style={s.photo} /> : null)}
          <T variant="label" style={s.time}>{message.vremeTekst}</T>
          {support && uuid(message.id) && positiveInteger(message.dogovorVerzija) ? <SupportContextEntry
            reference={{ kind: 'AGREEMENT_MESSAGE', id: message.id.toLowerCase(), revision: message.dogovorVerzija }}
            label="Izaberi ovu poruku za podršku" previewText={[message.telo, message.fotografije?.length
              ? `Privatne fotografije uz ovu poruku: ${message.fotografije.length}. Uključene su u izabrani dokaz.` : ''].filter(Boolean).join('\n')} disabled={loading}
            canAct={supportCurrent} navigate={support.navigate} /> : null}
        </View>)}
        {local.map(entry => <View key={entry.command.clientMessageId} style={[s.bubble, s.mine, entry.state === 'failed' && s.failed]}>
          <T selectable variant="body" style={s.ink}>{entry.command.body}</T>
          {entry.command.photos?.assetIds.map((assetId, index) => <AuthorizedPhoto key={assetId} assetId={assetId}
            agreementId={entry.command.agreementId} messageId={entry.messageId} label={`Fotografija poruke na čekanju ${index + 1}`}
            style={s.photo} />)}
          <T variant="label" style={[s.time, entry.state === 'failed' && s.timeFailed]} accessibilityLiveRegion="polite">
            {entry.state === 'sending' ? 'Šalje se…' : entry.state === 'confirmed' ? 'Poslato'
              : entry.state === 'unknown' ? 'Slanje nije potvrđeno' : 'Nije poslato'}
          </T>
          {entry.state === 'failed' && entry.error && <T variant="meta" tone="muted">{errors[entry.error]}</T>}
          {(entry.state === 'unknown' || entry.state === 'failed') &&
            <ChatAction label={`Ponovi slanje poruke ${entry.command.body}`} text="Pokušajte ponovo" tone="ink"
              onPress={() => { void outbox.retry(entry.command.clientMessageId).then(() => refresh()); }} />}
        </View>)}
      </ScrollView>
      <View style={s.composerArea}>
        {state.error && <T variant="meta" tone="danger" accessibilityLiveRegion="polite">{errors[state.error]}</T>}
        {state.phase === 'error' && <ChatAction label="Ponovo učitaj sačuvane poruke" onPress={() => void outbox.start()} />}
        {terminal && <T variant="meta" tone="muted">Dogovor je zatvoren; poruke su samo za čitanje.</T>}
        {!terminal && !writable && <T variant="meta" tone="muted">Osvežite Dogovor pre nove poruke. Nacrt ostaje sačuvan.</T>}
        {(!writable || denied) && <ChatAction label="Osveži status Dogovora" onPress={() => void refreshWorkspace()} />}
        {length > 2000 && <T variant="meta" tone="danger">{length.toLocaleString('sr-Latn-RS')} / 2.000 znakova — skratite poruku.</T>}
        {photos ? <AgreementPhotoComposer photos={photos} capturing={state.capturing} /> : null}
        <View style={[s.composer, !writable && s.composerLocked]}>
          <TextInput value={state.draft} onChangeText={outbox.setDraft} multiline editable={!terminal}
            accessibilityLabel="Napišite poruku" placeholder="Napiši poruku…" placeholderTextColor={sys.color.muted} style={s.input} />
          <Press accessibilityRole="button" accessibilityLabel="Pošalji poruku" disabled={!canSend}
            accessibilityState={{ disabled: !canSend, busy: state.capturing }} onPress={send} haptic={canSend ? 'light' : 'none'}
            style={[s.send, canSend && s.sendReady]}>
            <V2Icon name="send" size={22} color={canSend ? sys.color.surface : sys.color.muted} />
          </Press>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  list: { padding: 18, gap: 10, flexGrow: 1 },
  center: { textAlign: 'center' }, emptyCopy: { padding: 20 }, ink: { color: sys.color.ink },
  errorBlock: { gap: 8, alignItems: 'center', padding: 12 },
  chatAction: { minHeight: sys.touch.min, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 4 },
  bubble: { maxWidth: '88%', borderRadius: sys.radius.card, padding: 12, gap: 4 },
  mine: { alignSelf: 'flex-end', backgroundColor: sys.color.greenSoft, borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.line, borderBottomLeftRadius: 6 },
  failed: { backgroundColor: sys.color.dangerSoft },
  sender: { color: sys.color.green, fontWeight: '600' },
  photo: { width: 220, maxWidth: '100%' },
  time: { color: sys.color.muted, textAlign: 'right', fontWeight: '500', letterSpacing: 0 }, timeFailed: { color: sys.color.danger },
  composerArea: { padding: 16, paddingTop: 10, gap: 8, borderTopWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 6, paddingLeft: 12, borderWidth: 1, borderColor: sys.color.lineStrong, borderRadius: sys.radius.control, backgroundColor: sys.color.surface },
  composerLocked: { backgroundColor: sys.color.wash },
  input: { flex: 1, minHeight: sys.touch.min, maxHeight: 140, ...sys.type.body, color: sys.color.ink, paddingVertical: 10 },
  send: { width: sys.touch.min, height: sys.touch.min, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: sys.color.control },
  sendReady: { backgroundColor: sys.color.ink },
});
