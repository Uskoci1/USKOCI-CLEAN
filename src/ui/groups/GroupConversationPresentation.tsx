import { useState, type ReactNode } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View, type ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users } from 'phosphor-react-native';
import type { GroupMessage } from '../../data/groupConversationService';
import { inicijali } from '../../lib/inicijali';
import { vreme } from '../../lib/vreme';
import { Press } from '../Press';
import { T } from '../Text';
import { Appear, useAppear } from '../system/Appear';
import { Avatar } from '../system/Avatar';
import { PillComposer, PillNote } from '../system/PillComposer';
import { ChromeIconButton, ScreenChrome } from '../system/ScreenChrome';
import { StateView } from '../system/StateView';
import { brandAction, sys } from '../system/tokens';
import { V2Action } from '../v2/V2Action';
import type { GroupState } from './GroupConversationController';

type Group = NonNullable<NonNullable<GroupState['context']>['group']>;
type Member = Group['members'][number];
const time = (value: string) => vreme(value, { danas: true });
// The management block is the requester's alone, so a finish that waits on the requester waits on the person reading it.
const status = (value: string) => ({ CONFIRMED: 'Važeći Dogovor', AWAITING_REQUESTER: 'Čeka tvoju potvrdu završetka', COMPLETED: 'Završen', CANCELLED: 'Otkazan' }[value] ?? 'Dogovor');
/** The counter appears only near the limit, as in Poruke. */
const LIMIT = 2000, NEAR = 1800;

export type GroupConversationPresentationProps = {
  state: GroupState; draft: string; showPeople: boolean; listKey: number;
  /** The draft's length as the group counts it, and whether it is a message that can go (the screen's own rule). */
  draftLength: number; draftSendable: boolean;
  viewability: { viewAreaCoveragePercentThreshold: number; minimumViewTime: number };
  onVisible: (info: { viewableItems: ViewToken<GroupMessage>[] }) => void;
  onBack: () => void; onTogglePeople: () => void; onRefresh: () => void; onOlder: () => void; onManagementNext: () => void;
  onOpenAgreement: (id: string) => void; onDraft: (value: string) => void; onSend: () => void; onAcknowledge: () => void;
  /** The member's photo, drawn by the screen (it reads media); the gallery leaves it out and the initials stand. */
  photo?: (member: Member, fallback: ReactNode) => ReactNode;
  /** The support entry under a message, drawn by the screen (it opens support); the gallery leaves it out. */
  support?: (message: GroupMessage) => ReactNode;
};

/**
 * The shared conversation of a group task, in the look of Poruke (round 6): the other people's messages on the left,
 * white with the card edge and the name at the start of their turn, mine on the right on pale green, the clock small,
 * and the floating pill to write in. A short thread sits on the composer, where a reply is written, and a state stands
 * in the middle; the header copy and the states keep the screens' 20 dp gutter while the bubbles stay on Poruke's 16.
 * The people of the group sit behind the bar's people button. Presentation only: the screen owns the controller, the
 * journal, the read marking of truly visible rows and every fence.
 */
export function GroupConversationPresentation(p: GroupConversationPresentationProps) {
  const { state } = p, group = state.context?.group ?? null, ready = state.phase === 'READY';
  const retry = state.phase === 'UNKNOWN' && state.canRetry;
  const first = state.phase === 'LOADING' && !state.messages.length && !group;
  // As in Poruke: a thread is anchored to the composer, a state (the first read, an error, nothing to show) to the middle.
  const centred = first || state.phase === 'ERROR' || (ready && (!group || state.messages.length === 0));
  const me = state.context?.accountId;
  // In a conversation the arrival IS the message. The history that was already there settles silently, "Starije poruke"
  // does not replay the thread, and only a message that has just landed moves.
  const appear = useAppear();
  // Which message the person is holding, for the support path (as in Poruke: it stood under every message).
  const [chosen, setChosen] = useState<string | null>(null);
  const toggle = (id: string) => setChosen(current => current === id ? null : id);
  appear.settle(state.messages.map(message => message.messageId));
  const length = p.draftLength;
  const composer = (ready && group?.canSend) || retry;
  const name = (message: GroupMessage) => message.mine ? 'Ti' : group?.members.find(member => member.accountId === message.senderAccountId)?.displayName ?? 'Učesnik';
  const header = <View style={[s.stack, s.gutter]}>
    {first ? <StateView kind="loading" title="Učitavamo razgovor…" skeleton={{ count: 2, rows: 2 }} /> : null}
    {state.phase === 'ERROR' ? <StateView kind="error" art="chat" title="Razgovor nije učitan" body={state.message ?? undefined}
      primary={{ label: 'Pokušaj ponovo', onPress: p.onRefresh }} /> : null}
    {group ? <>
      <T variant="copy" tone="muted">Zajedničke poruke za koordinaciju Zadatka. Cenu, lične uslove i probleme dogovori u svom privatnom Dogovoru.</T>
      {/* A finished conversation says so once, where the pill would be. */}
      {!group.terminal && !group.canSend ? <T variant="meta" tone="muted">Dostupna istorija razgovora</T> : null}
      {p.showPeople ? <View style={s.people}>
        {group.members.map(member => {
          const fallback = <Avatar initials={inicijali(member.displayName)} size={40} />;
          // The read lists the requester and every member, the reader included: their own row says so.
          const role = member.role === 'REQUESTER' ? 'Traži pomoć' : 'Učesnik';
          return <View key={member.accountId} style={s.member}>
            {p.photo ? p.photo(member, fallback) : fallback}
            <View style={s.flex}><T variant="bodyStrong">{member.displayName}</T><T variant="meta" tone="muted">{member.accountId === me ? `Ti · ${role}` : role}</T></View>
          </View>;
        })}
        {group.members.length === 0 ? <T variant="meta" tone="muted">Prikazana je ranije dostupna istorija.</T> : null}
        {group.role === 'REQUESTER' ? <View style={[s.stack, s.parted]}>
          <T variant="heading" accessibilityRole="header">Tvoji pojedinačni Dogovori</T><T variant="meta" tone="muted">Ovo vidiš samo ti.</T>
          {(group.management ?? []).map(item => <View key={item.agreementId} style={s.managed}>
            <T variant="body">{group.members.find(member => member.accountId === item.accountId)?.displayName ?? 'Učesnik'} · {status(item.executionState ?? item.status)}</T>
            {item.problemOpened ? <T variant="meta" tone="muted">Privatan problem u Dogovoru</T> : null}
            <V2Action label="Otvori pojedinačni Dogovor" compact onPress={() => p.onOpenAgreement(item.agreementId)} />
          </View>)}
          {group.managementNextId ? <V2Action label="Još pojedinačnih Dogovora" kind="quiet" onPress={p.onManagementNext} /> : null}
        </View> : null}
      </View> : null}
    </> : ready ? <StateView kind="empty" art="users" title="Grupni razgovor još nije otvoren"
      body="Grupni razgovor se otvara kada su u ovom Zadatku izabrana najmanje dva nezavisna učesnika. Tvoj privatni Dogovor je i dalje dostupan." /> : null}
    {state.message && state.phase !== 'ERROR' ? <T variant="copy" accessibilityLiveRegion="polite">{state.message}</T> : null}
    {state.before ? <V2Action label="Starije poruke" kind="quiet" disabled={!ready} onPress={p.onOlder} /> : null}
    {/* A member admitted later reads the group from their admission on, so an empty thread is honest about what it shows. */}
    {ready && group && state.messages.length === 0 ? <StateView kind="empty" art="chat" title="Još nema poruka"
      body={group.canSend ? 'Vidiš poruke od svog ulaska u grupu. Napiši prvu.' : 'Vidiš poruke od svog ulaska u grupu.'} /> : null}
    {/* New messages come on focus, after my own send or by pulling down, and a screen reader cannot easily pull: as in
        Poruke the refresh is also a quiet action at the head of the thread, centred, under the empty state's words when
        there is none, and never on a finished conversation, where nothing new can arrive. */}
    {ready && group && !group.terminal ? <V2Action label="Osveži poruke" kind="quiet" style={s.centred} onPress={p.onRefresh} /> : null}
  </View>;
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <ScreenChrome variant="detail" title={group?.title ?? 'Grupni razgovor'} subtitle={group ? 'Grupni razgovor' : undefined}
      backLabel="Nazad na Dogovor" onBack={p.onBack}
      right={group ? <ChromeIconButton label="Učesnici razgovora" icon={Users} active={p.showPeople} onPress={p.onTogglePeople} /> : undefined} />
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <FlatList key={p.listKey} data={state.messages} keyExtractor={item => item.messageId} contentContainerStyle={[s.content, centred ? s.listCentred : s.listBottom]} keyboardShouldPersistTaps="handled"
        onViewableItemsChanged={p.onVisible} viewabilityConfig={p.viewability} refreshing={state.phase === 'LOADING' && state.messages.length > 0} onRefresh={p.onRefresh}
        ListHeaderComponent={header}
        renderItem={({ item }) => {
          // The position is read from the page itself, so the run is right whatever index the list hands in.
          const index = state.messages.indexOf(item), before = index > 0 ? state.messages[index - 1] : undefined;
          // Messages of one person in a row sit close, and only the first of another person's turn carries the name.
          const run = !!before && before.senderAccountId === item.senderAccountId;
          return <Appear index={index} animate={appear.isNew(item.messageId)}>
            {/* A tap (or a long press, or the screen reader's action) offers the message to support: the entry that stood
                under every message is one step away, never behind a gesture alone (review r6). Without support the
                bubble is text, not a button. */}
            <Press accessibilityRole={p.support ? 'button' : 'text'} accessibilityLabel={`${name(item)}: ${item.body}, ${time(item.createdAt)}`}
              accessibilityHint={p.support ? 'Dodir nudi prijavu podršci.' : undefined} haptic={p.support ? 'select' : 'none'} scaleTo={1}
              disabled={!p.support} onPress={p.support ? () => toggle(item.messageId) : undefined}
              onLongPress={p.support ? () => toggle(item.messageId) : undefined}
              accessibilityActions={p.support ? [{ name: 'activate', label: 'Izaberi ovu poruku za podršku' }] : undefined}
              onAccessibilityAction={p.support ? () => toggle(item.messageId) : undefined}
              style={[s.bubble, item.mine ? s.mine : s.theirs, run ? s.run : s.turn]}>
              {!item.mine && !run ? <T variant="meta" style={s.sender}>{name(item)}</T> : null}
              <T variant="body">{item.body}</T>
              <T variant="meta" tone="muted" style={s.time}>{time(item.createdAt)}</T>
            </Press>
            {p.support && chosen === item.messageId ? <View style={[s.support, item.mine ? s.supportMine : s.supportTheirs]}>{p.support(item)}</View> : null}
          </Appear>;
        }}
        ListFooterComponent={<View style={[s.stack, s.gutter]}>
          {state.phase === 'SENDING' ? <T variant="meta" tone="muted" accessibilityLiveRegion="polite">Čekam potvrdu slanja…</T> : null}
          {state.phase === 'UNKNOWN' ? <V2Action label="Proveri prvobitno slanje" style={brandAction} onPress={p.onRefresh} /> : null}
          {state.phase === 'CONFIRMED' ? <V2Action label="Prikaži razgovor" style={brandAction} onPress={p.onAcknowledge} /> : null}
        </View>} />
      {composer ? <PillComposer value={p.draft} onChange={p.onDraft} label={retry ? 'Unesi prvobitnu poruku' : 'Poruka grupi'}
        placeholder={retry ? 'Prvobitna poruka…' : 'Napiši poruku grupi…'} sendLabel={retry ? 'Ponovi slanje iste poruke' : 'Pošalji poruku grupi'}
        canSend={p.draftSendable} reason={length === 0 ? 'Upiši poruku pre slanja.' : length > LIMIT ? 'Poruka je duža od 2.000 znakova.' : null}
        onSend={p.onSend} maxLength={4000}
        above={<>
          {retry ? <PillNote>Prvobitna poruka</PillNote> : null}
          {length > NEAR ? <PillNote tone={length > LIMIT ? 'danger' : 'muted'}>{length.toLocaleString('sr-Latn-RS')} / 2.000 znakova</PillNote> : null}
        </>} />
        : group?.terminal ? <T variant="meta" tone="muted" style={s.closed}>Razgovor je završen · poruke su samo za čitanje.</T> : null}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  // Poruke's list: the bubbles on 16, and the content grows so a short thread can sit on the composer.
  content: { paddingHorizontal: sys.space.base, paddingTop: sys.space.sm, paddingBottom: sys.space.md, gap: 0, flexGrow: 1 },
  listBottom: { justifyContent: 'flex-end' },
  listCentred: { justifyContent: 'center' },
  stack: { gap: sys.space.md, paddingBottom: sys.space.sm },
  // The header copy, the people panel and the states sit on the screens' 20 dp gutter, 4 in from the bubbles' 16.
  gutter: { paddingHorizontal: sys.space.xs },
  centred: { alignSelf: 'center' },
  flex: { flex: 1 },
  people: { gap: sys.space.md, paddingVertical: sys.space.sm },
  member: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 48 },
  parted: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: sys.color.cardLine, paddingTop: sys.space.md },
  managed: { gap: sys.space.xs },
  // The bubbles of Poruke: the card corner, the tail side drawn tighter, 82 % of the width at most.
  bubble: { maxWidth: '82%', borderRadius: sys.radius.card, paddingHorizontal: 14, paddingTop: 10, paddingBottom: sys.space.sm, gap: sys.space.xs },
  turn: { marginTop: sys.space.md }, run: { marginTop: sys.space.xs },
  mine: { alignSelf: 'flex-end', backgroundColor: sys.color.greenSoft, borderBottomRightRadius: sys.space.sm },
  theirs: { alignSelf: 'flex-start', backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.cardLine, borderBottomLeftRadius: sys.space.sm },
  sender: { color: sys.color.green },
  time: { alignSelf: 'flex-end', fontVariant: ['tabular-nums'] },
  support: { maxWidth: '82%', marginTop: sys.space.xs },
  supportMine: { alignSelf: 'flex-end' }, supportTheirs: { alignSelf: 'flex-start' },
  closed: { textAlign: 'center', paddingHorizontal: sys.space.base, paddingVertical: sys.space.md },
});
