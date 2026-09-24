import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, ActivityIndicator, FlatList, StyleSheet, View, type TextStyle } from 'react-native';
import { Check } from 'phosphor-react-native';
import type { InboxItem, InboxRole } from '../../contracts/inbox';
import type { InboxState } from '../../data/inboxModel';
import { trenutak, type Trenutak } from '../../lib/trenutak';
import { Press } from '../Press';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { Appear, useAppear } from '../system/Appear';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { neprocitanih } from '../system/plural';
import { Segmented } from '../system/Segmented';
import { StateView } from '../system/StateView';
import { useTextScale } from '../system/textScale';
import { inset, sys } from '../system/tokens';

/**
 * The inbox as a list of events, newest first, grouped under a day ("Danas", "Juče", "22. sep"). Step 11a, 2026-09-24:
 * every event used to be its own bordered card, an unread one a green-tinted card with an orange icon well, and each
 * card repeated the full date. Now an event is a row on a hairline: an unread one carries a green dot and a heavier
 * title, the clock stands on the title's line, and the day is said once above its rows. No card, no tint, no chevron:
 * the whole row is the button.
 *
 * Presentation only. What opening a row does (mark read, resolve, land exactly where the event points) stays with the
 * route, `app/obavestenja.tsx`, and the model; this file draws whatever state it is handed, so the internal gallery
 * can draw it from fixtures.
 *
 * A row is event-first because an event carries only the server's title and body (no actor name, no task title); a
 * person-first row waits for the server package "obaveštenja sa imenom". The one exception the data allows is a new
 * task for you (OPPORTUNITY_AVAILABLE), whose body is the task's own title as the server writes it: that row leads
 * with the task.
 */
export type InboxView = Pick<InboxState, 'page' | 'loading' | 'paging' | 'acting' | 'error' | 'unavailable'>;

export const INBOX_FILTERS: { label: string; role: InboxRole | null }[] = [
  { label: 'Sve', role: null }, { label: 'Moji zadaci', role: 'REQUESTER' }, { label: 'Moje prijave', role: 'WORKER' },
];

const EMPTY_TITLE: Record<'ALL' | InboxRole, string> = {
  ALL: 'Još nema obaveštenja',
  REQUESTER: 'Još nema obaveštenja o tvojim zadacima',
  WORKER: 'Još nema obaveštenja o tvojim prijavama',
};
const AGAIN = 'Proveri vezu i pokušaj ponovo. Poslednje učitano stanje ostaje prikazano.';

type DayRow = { kind: 'day'; id: string; label: string; first: boolean };
type EventRow = { kind: 'event'; id: string; item: InboxItem; moment: Trenutak | null; last: boolean };
export type InboxRowModel = DayRow | EventRow;

/**
 * The list's rows in the server's order: a day header before the first event of each civil day, then that day's
 * events. Every row carries `id` (the event's own id, or `day:` and the day). An event without a readable moment joins
 * the day before it and gets no header of its own: no day is made up for it.
 */
export function inboxRows(items: readonly InboxItem[], options: { zona?: string; sada?: Date } = {}): InboxRowModel[] {
  const rows: InboxRowModel[] = [];
  let day: string | null = null, previous: EventRow | null = null;
  for (const item of items) {
    const moment = trenutak(item.occurredAt, options);
    if (moment && moment.kljuc !== day) {
      if (previous) previous.last = true;
      day = moment.kljuc;
      rows.push({ kind: 'day', id: `day:${moment.kljuc}`, label: moment.dan, first: rows.length === 0 });
    }
    previous = { kind: 'event', id: item.id, item, moment, last: false };
    rows.push(previous);
  }
  if (previous) previous.last = true;
  return rows;
}

/**
 * What each event is drawn with: the event type decides first, the family after it. The server sends six families
 * (opportunities, responses, dogovor, execution, recovery, account); two of them hide more than one thing — 'dogovor'
 * carries a message and a review beside the Agreement itself, 'responses' carries a task's change, its cancellation and
 * a question beside the offers — so a message is a speech bubble and a cancelled task is the task, whatever family the
 * server files it under.
 */
export function inboxEventArt(eventType: string, family: string): FactArtKind {
  switch (eventType) {
    case 'MESSAGE_RECEIVED': case 'CLARIFICATION_CREATED': case 'CLARIFICATION_ANSWERED': return 'chat';
    case 'REVIEW_RECEIVED': return 'star';
    case 'PRIVATE_ACCESS_GRANTED': return 'lock';
    case 'OPPORTUNITY_AVAILABLE': case 'NEED_REVISED': case 'NEED_CANCELLED': return 'tasks';
    case 'COMPLETION_REQUIRED': return 'check';
  }
  return family === 'responses' ? 'offers' : family === 'dogovor' ? 'agreements' : family === 'execution' ? 'check'
    : family === 'recovery' ? 'shield' : family === 'opportunities' ? 'tasks' : 'bell';
}

/** Lead and second line of a row: the task first where the data has it (a new task for you), the event otherwise. */
function rowCopy(item: InboxItem): { primary: string; secondary: string } {
  return item.eventType === 'OPPORTUNITY_AVAILABLE' && item.body.trim()
    ? { primary: item.body, secondary: item.title } : { primary: item.title, secondary: item.body };
}

type RowProps = { item: InboxItem; moment: Trenutak | null; last: boolean; acting: boolean; disabled: boolean;
  large: boolean; onOpen: (item: InboxItem) => void };

function InboxRowBase({ item, moment, last, acting, disabled, large, onOpen }: RowProps) {
  const unread = !item.readAt;
  const { primary, secondary } = rowCopy(item);
  const when = moment ? `. ${moment.dan}, ${moment.sat}` : '';
  const time = moment ? <T variant="meta" tone="muted" numberOfLines={1} style={large ? s.clock : [s.clock, s.clockBeside]}>{moment.sat}</T> : null;
  return <Press accessibilityRole="button" accessibilityLabel={`${unread ? 'Nepročitano' : 'Pročitano'}. ${item.title}. ${item.body}${when}`}
    accessibilityState={{ disabled, busy: acting }} disabled={disabled} haptic="select" scaleTo={1}
    onPress={() => onOpen(item)} style={[s.row, last && s.rowLast]}>
    <View style={s.dotColumn} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {unread ? <View testID="inbox-unread-dot" style={s.dot} /> : null}
    </View>
    <View style={s.art}>{acting ? <ActivityIndicator size="small" color={sys.color.green} />
      : <FactArt kind={inboxEventArt(item.eventType, item.family)} size={28} />}</View>
    <View style={s.copy}>
      <View style={s.firstLine}>
        <T variant={unread ? 'bodyStrong' : 'body'} numberOfLines={large ? 3 : 2} style={s.primary}>{primary}</T>
        {large ? null : time}
      </View>
      {secondary ? <T variant="note" tone="muted" numberOfLines={2}>{secondary}</T> : null}
      {large ? time : null}
    </View>
  </Press>;
}
const InboxRow = memo(InboxRowBase);

function DayHeader({ label, first }: { label: string; first: boolean }) {
  return <T variant="meta" tone="muted" accessibilityRole="header" style={[s.day, first && s.dayFirst]}>{label}</T>;
}

/**
 * One quiet notice at the top of the list; never an orange fill. Only an error offers a way forward, and its button says
 * what it does: after an unconfirmed action it reads the list again, it does not repeat the action.
 */
function Banner({ title, sentence, retry, retryLabel = 'Pokušaj ponovo', disabled }: {
  title: string; sentence: string; retry?: () => void; retryLabel?: string; disabled: boolean;
}) {
  return <View style={s.banner}>
    <FactArt kind="info" size={24} muted />
    <View style={s.bannerCopy}>
      <T variant="bodyStrong" accessibilityRole="alert">{title}</T>
      <T variant="note" tone="muted">{sentence}</T>
      {retry ? <V2Action kind="quiet" compact label={retryLabel} disabled={disabled} onPress={retry} style={s.inlineAction} /> : null}
    </View>
  </View>;
}

/** An event's moment in milliseconds, or null when it cannot be read (such an event is never treated as new). */
const occurredMs = (item: InboxItem): number | null => { const ms = Date.parse(item.occurredAt); return Number.isFinite(ms) ? ms : null; };

/**
 * Which events are arrivals. `useAppear` settles the first list it is given and animates every id it has not seen; an
 * older page ("Učitaj starija obaveštenja") is also made of ids it has not seen, and those did not arrive, they were
 * fetched. So an unseen event is an arrival only when it is newer than the newest one already on screen; every other
 * unseen event is marked seen here, before the rows ask, and stays still. Called once per render, before the rows.
 *
 * `list` names the list being shown (the filter). Another filter is another list, so its first page is what was there,
 * not news: the newest moment is forgotten, and every event of that filter's first page is then marked seen. The list
 * itself stays mounted across a filter switch (round 5c, 2026-09-24): remounting it threw away the tab a screen reader
 * had just pressed, and rebuilt every row and the header for nothing.
 */
function useArrivals(items: readonly InboxItem[], list: string) {
  const appear = useAppear();
  const newest = useRef<number | null>(null);
  const shown = useRef(list);
  if (shown.current !== list) { shown.current = list; newest.current = null; }
  appear.settle(items.map(item => item.id));
  const before = newest.current;
  for (const item of items) {
    const ms = occurredMs(item);
    if (ms === null || before === null || ms <= before) appear.isNew(item.id);
    if (ms !== null && (newest.current === null || ms > newest.current)) newest.current = ms;
  }
  return appear;
}

export function InboxList({ state, role, onRole, onOpen, onReadAll, onRefresh, onMore, onSettings, zona, sada }: {
  state: InboxView; role: InboxRole | null; onRole: (role: InboxRole | null) => void;
  onOpen: (item: InboxItem) => void; onReadAll: () => void; onRefresh: () => void; onMore: () => void; onSettings: () => void;
  /** Fixed only by the gallery and tests; the phone's zone and "now" otherwise. */ zona?: string; sada?: Date;
}) {
  const { page, loading, paging, acting, error, unavailable } = state;
  const busy = loading || paging || !!acting;
  const large = useTextScale() >= 1.3;
  const items = page?.items;
  const rows = useMemo(() => inboxRows(items ?? [], { zona, sada }), [items, zona, sada]);
  // An event that arrives while the Inbox is open is worth a moment of motion; the ones that were there when it opened,
  // the ones a refresh returns unchanged and an older page are not. Only event rows take part, never a day header. Each
  // filter is its own list, so a filter's first page is what was there, too.
  const appear = useArrivals(items ?? [], role ?? 'ALL');
  const unreadCount = page?.unreadCount;
  useReadAllAnnouncement(unreadCount);

  const banner = unavailable ? <Banner title="Sadržaj više nije dostupan." sentence="Možda je uklonjen ili mu više nemaš pristup." disabled={busy} />
    : error === 'action' ? <Banner title="Radnja nije potvrđena." sentence={AGAIN} retry={onRefresh} retryLabel="Osveži obaveštenja" disabled={busy} />
      : error === 'load' && page ? <Banner title="Obaveštenja nisu osvežena." sentence={AGAIN} retry={onRefresh} disabled={busy} /> : null;

  const header = <View style={s.header}>
    <Segmented appearance="underline" value={role ?? 'ALL'} onChange={key => onRole(key === 'ALL' ? null : key as InboxRole)}
      options={INBOX_FILTERS.map(filter => ({ key: filter.role ?? 'ALL', label: filter.label }))} />
    {page && page.unreadCount > 0 ? <View style={[s.summary, large && s.summaryLarge]}>
      <T variant="meta" tone="muted" accessibilityLiveRegion="polite">{neprocitanih(page.unreadCount)}</T>
      <V2Action kind="quiet" compact label="Označi sve kao pročitano" icon={<Check size={18} color={sys.color.green} />}
        loading={acting === 'all'} disabled={busy} onPress={onReadAll} style={s.inlineAction} />
    </View> : null}
    {banner}
  </View>;

  const empty = loading || (!page && !error)
    ? <StateView kind="loading" title="Učitavamo obaveštenja…" skeleton={{ count: 5, rows: 2, variant: 'plain' }} />
    : !page ? <StateView kind="error" title="Obaveštenja nisu učitana" body="Proveri vezu i pokušaj ponovo da učitaš obaveštenja."
        primary={{ label: 'Pokušaj ponovo', onPress: onRefresh, disabled: busy }} />
      // The last loaded list always stays: an error with an empty page is the banner above, never "nothing here".
      : error ? null
        : <StateView kind="empty" art="bell" title={EMPTY_TITLE[role ?? 'ALL']}
            body={role ? undefined : 'Nove Prijave, poruke i važne promene stižu ovde — uz Zadatak ili Dogovor na koji se odnose.'}
            quiet={role ? undefined : { label: 'Podesi obaveštenja', onPress: onSettings }} />;

  const footer = error === 'page' || page?.hasMore ? <View style={s.footer}>
    {error === 'page' ? <>
      <T variant="note" tone="danger" accessibilityRole="alert">Starija obaveštenja nisu učitana.</T>
      <T variant="note" tone="muted">{AGAIN}</T>
    </> : null}
    {page?.hasMore ? <V2Action kind="secondary" label="Učitaj starija obaveštenja" loading={paging} disabled={busy && !paging} onPress={onMore} /> : null}
  </View> : null;

  // One stable row renderer while nothing a row draws has changed, so a switch of the filter or a refresh does not
  // re-render every row the list already holds.
  const renderItem = useCallback(({ item: row }: { item: InboxRowModel }) => row.kind === 'day' ? <DayHeader label={row.label} first={row.first} />
    : <Appear animate={appear.isNew(row.item.id)}>
      <InboxRow item={row.item} moment={row.moment} last={row.last} acting={acting === row.item.id} disabled={busy}
        large={large} onOpen={onOpen} />
    </Appear>, [appear, acting, busy, large, onOpen]);

  return <FlatList data={rows} keyExtractor={rowKey}
    contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
    refreshing={loading && !!page} onRefresh={onRefresh}
    ListHeaderComponent={header} ListEmptyComponent={empty} ListFooterComponent={footer}
    renderItem={renderItem} />;
}
const rowKey = (row: InboxRowModel) => row.id;

/** Said once when the last unread notification is read while the list is open: the count row and the dots leave quietly. */
function useReadAllAnnouncement(unreadCount: number | undefined) {
  const before = useRef(unreadCount);
  useEffect(() => {
    const previous = before.current; before.current = unreadCount;
    if (previous !== undefined && previous > 0 && unreadCount === 0) AccessibilityInfo.announceForAccessibility('Nema nepročitanih obaveštenja.');
  }, [unreadCount]);
}

const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

const s = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: { gap: 12, paddingTop: 4 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12, minHeight: 48 },
  summaryLarge: { flexDirection: 'column', alignItems: 'flex-start' },
  // A text action at the content's own edge: the label lines up with the rows, the touch area keeps 48 px.
  inlineAction: { paddingHorizontal: 0, alignSelf: 'flex-start' },
  banner: { ...inset, backgroundColor: sys.color.wash, flexDirection: 'row', gap: 12 },
  bannerCopy: { flex: 1, minWidth: 0, gap: 4 },
  day: { fontWeight: '600', paddingTop: 20, paddingBottom: 4 },
  dayFirst: { paddingTop: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 64, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: sys.color.line },
  rowLast: { borderBottomWidth: 0 },
  dotColumn: { width: 8, marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: sys.radius.pill, backgroundColor: sys.color.green },
  // No top padding: the icon's centre then sits 2 dp from the unread dot's, which stands on the title's first line
  // (with `space.xs` it hung 6 dp below it).
  art: { width: 32, alignItems: 'center', paddingTop: 0 },
  copy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  firstLine: { flexDirection: 'row', alignItems: 'flex-start' },
  primary: { flex: 1, minWidth: 0, color: sys.color.ink },
  clock: { ...tabular },
  clockBeside: { marginLeft: sys.space.sm, marginTop: sys.space.xs },
  footer: { paddingTop: 16, gap: 8 },
});
