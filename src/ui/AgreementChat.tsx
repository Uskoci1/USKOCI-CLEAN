import { useEffect, useRef } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { V2Icon } from './v2/icons';
import { v2 } from './v2/tokens';
import type { PorukaProjekcija } from '../contracts/projections';
import { sameMessagePhotos, type createAgreementOutbox, type OutboxError } from '../data/agreementOutbox';
import type { AgreementPhotosController } from '../hooks/useAgreementPhotos';
import { AgreementPhotoComposer } from './media/AgreementPhotoComposer';
import { AuthorizedPhoto } from './media/AuthorizedPhoto';
import { palette, radius, space, touch } from '../theme/tokens';
import { Press } from './Press';
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
  return (
    <View style={{ flex: 1 }}>
      <ScrollView ref={list} keyboardShouldPersistTaps="handled" onContentSizeChange={followLatest} onLayout={followLatest}
        scrollEventThrottle={100} onScroll={({ nativeEvent: event }) => {
          nearBottom.current = event.contentOffset.y + event.layoutMeasurement.height >= event.contentSize.height - 80;
        }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={palette.teal500} />}
        contentContainerStyle={{ padding: v2.space.lg, gap: v2.space.md, flexGrow: 1 }}>
        <T variant="meta" tone="muted" style={{ textAlign: 'center' }}>Razgovor o ovom Dogovoru. Povucite naniže za nove poruke.</T>
        {loading && <ActivityIndicator accessibilityLabel="Učitavanje poruka" color={palette.teal500} />}
        {error && <View style={{ gap: space.sm, alignItems: 'center' }}>
          <T variant="bodyStrong">Poruke nisu učitane</T>
          <T variant="meta" tone="muted">Proverite vezu. Vaš tekst ostaje sačuvan.</T>
          <Press accessibilityRole="button" accessibilityLabel="Ponovo učitaj poruke" onPress={() => void refresh()}
            style={{ minHeight: touch.min, justifyContent: 'center', paddingHorizontal: space.base }}>
            <T variant="action" tone="orange">Pokušajte ponovo</T>
          </Press>
        </View>}
        {!loading && !error && messages.length === 0 && local.length === 0 &&
          <T variant="meta" tone="muted" style={{ textAlign: 'center', padding: space.lg }}>Još nema poruka.</T>}
        {!error && messages.map(message => <View key={message.id} style={{
          alignSelf: message.moja ? 'flex-end' : 'flex-start', maxWidth: '88%', borderRadius: radius.lg,
          padding: space.md, gap: space.xs, backgroundColor: message.moja ? v2.color.answer : v2.color.surface, borderWidth: 1, borderColor: message.moja ? v2.color.contextLine : v2.color.line, borderBottomRightRadius: message.moja ? 4 : 18, borderBottomLeftRadius: message.moja ? 18 : 4,
        }}>
          {!message.moja && <T variant="meta" tone="muted">{message.posiljalacIme}</T>}
          <T selectable variant="body" style={{ ...v2.text.body, color: v2.color.ink }}>{message.telo}</T>
          {message.fotografije?.map((photo, index) => photos ? <AuthorizedPhoto key={photo.assetId} assetId={photo.assetId}
            agreementId={photos.agreementId} messageId={message.id} label={`Fotografija poruke ${index + 1}`}
            style={{ width: 220, maxWidth: '100%' }} /> : null)}
          <T variant="meta" style={{ ...v2.text.label, color: v2.color.muted, textAlign: 'right' }}>{message.vremeTekst}</T>
          {support && uuid(message.id) && positiveInteger(message.dogovorVerzija) ? <SupportContextEntry
            reference={{ kind: 'AGREEMENT_MESSAGE', id: message.id.toLowerCase(), revision: message.dogovorVerzija }}
            label="Izaberi ovu poruku za podršku" previewText={[message.telo, message.fotografije?.length
              ? `Privatne fotografije uz ovu poruku: ${message.fotografije.length}. Uključene su u izabrani dokaz.` : ''].filter(Boolean).join('\n')} disabled={loading}
            canAct={supportCurrent} navigate={support.navigate} /> : null}
        </View>)}
        {local.map(entry => <View key={entry.command.clientMessageId} style={{
          alignSelf: 'flex-end', maxWidth: '88%', borderRadius: radius.lg,
          padding: space.md, gap: space.xs, backgroundColor: v2.color.answer, borderWidth: 1, borderColor: v2.color.contextLine, borderBottomRightRadius: 4,
        }}>
          <T selectable variant="body" style={{ color: v2.color.ink }}>{entry.command.body}</T>
          {entry.command.photos?.assetIds.map((assetId, index) => <AuthorizedPhoto key={assetId} assetId={assetId}
            agreementId={entry.command.agreementId} messageId={entry.messageId} label={`Fotografija poruke na čekanju ${index + 1}`}
            style={{ width: 220, maxWidth: '100%' }} />)}
          <T variant="meta" style={{ color: v2.color.muted }} accessibilityLiveRegion="polite">
            {entry.state === 'sending' ? 'Šalje se…' : entry.state === 'confirmed' ? 'Poslato'
              : entry.state === 'unknown' ? 'Slanje nije potvrđeno' : 'Nije poslato'}
          </T>
          {entry.state === 'failed' && entry.error && <T variant="meta" style={{ color: v2.color.muted }}>{errors[entry.error]}</T>}
          {(entry.state === 'unknown' || entry.state === 'failed') &&
            <Press accessibilityRole="button" accessibilityLabel={`Ponovi slanje poruke ${entry.command.body}`}
              onPress={() => { void outbox.retry(entry.command.clientMessageId).then(() => refresh()); }}
              style={{ minHeight: touch.min, justifyContent: 'center' }}>
              <T variant="action" style={{ color: v2.color.ink }}>Pokušajte ponovo</T>
            </Press>}
        </View>)}
      </ScrollView>
      <View style={{ padding: space.base, paddingTop: space.sm, gap: space.sm, borderTopWidth: 1,
        borderColor: v2.color.line, backgroundColor: v2.color.canvas }}>
        {state.error && <T variant="meta" tone="danger" accessibilityLiveRegion="polite">
          {errors[state.error]}
        </T>}
        {state.phase === 'error' && <Press accessibilityRole="button" accessibilityLabel="Ponovo učitaj sačuvane poruke"
          onPress={() => void outbox.start()} style={{ minHeight: touch.min, justifyContent: 'center' }}>
          <T variant="action" tone="orange">Pokušajte ponovo</T>
        </Press>}
        {terminal && <T variant="meta" tone="muted">Dogovor je zatvoren; poruke su samo za čitanje.</T>}
        {!terminal && !writable && <T variant="meta" tone="muted">Osvežite Dogovor pre nove poruke. Nacrt ostaje sačuvan.</T>}
        {(!writable || state.entries.some(entry => entry.error === 'READ_ONLY' || entry.error === 'NOT_AVAILABLE')) &&
          <Press accessibilityRole="button" accessibilityLabel="Osveži status Dogovora" onPress={() => void refreshWorkspace()}
            style={{ minHeight: touch.min, justifyContent: 'center' }}><T variant="action" tone="orange">Osvežite Dogovor</T></Press>}
        {length > 2000 && <T variant="meta" tone="danger">{length.toLocaleString('sr-Latn-RS')} / 2.000 znakova — skratite poruku.</T>}
        {photos ? <AgreementPhotoComposer photos={photos} capturing={state.capturing} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, padding: space.sm,
          borderWidth: 1, borderColor: v2.color.controlLine, borderRadius: 20, backgroundColor: v2.color.surface }}>
          <TextInput value={state.draft} onChangeText={outbox.setDraft} multiline editable={!terminal}
            accessibilityLabel="Napišite poruku" placeholder="Napiši poruku…" placeholderTextColor={palette.inkMuted}
            style={{ flex: 1, minHeight: touch.min, maxHeight: 140, fontSize: 16, color: palette.ink, padding: space.sm }} />
          <Press accessibilityRole="button" accessibilityLabel="Pošalji poruku" disabled={!canSend}
            accessibilityState={{ disabled: !canSend, busy: state.capturing }} onPress={send} haptic={canSend ? 'light' : 'none'}
            style={{ width: touch.min, height: touch.min, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
              backgroundColor: canSend ? v2.color.ink : v2.color.soft }}>
            <V2Icon name="send" size={22} color={canSend ? v2.color.surface : v2.color.muted} />
          </Press>
        </View>
      </View>
    </View>
  );
}
