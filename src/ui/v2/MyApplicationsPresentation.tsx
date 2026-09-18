import { memo, useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, MapPin } from 'phosphor-react-native';
import type { MojaPrijavaProjekcija, Uloga } from '../../contracts/projections';
import { needPeopleText, needScheduleText } from '../../data/needDetailPresentation';
import { ScreenHeader } from '../system/ScreenHeader';
import { Segmented } from '../system/Segmented';
import { SkeletonList } from '../system/Skeleton';
import { brandAction, card, intentLabel, sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from './V2Action';
import { V2Icon } from './icons';

export type ApplicationsTab = 'all' | 'attention' | 'active' | 'finished';
export type OfferEdit = { price: string; people: string; note: string; start: string | null; end: string | null };
export const applicationStatus = (state: MojaPrijavaProjekcija['stanje']) => ({
  SUBMITTED: 'Poslata', VIEWED: 'Pregledana', SHORTLISTED: 'U užem izboru', SELECTED: 'Izabrana',
  WITHDRAWN: 'Povučena', CLOSED: 'Zadatak je zatvoren', STALE_REVIEW_REQUIRED: 'Potrebna nova provera',
})[state];
export function applicationSection(p: MojaPrijavaProjekcija): Exclude<ApplicationsTab, 'all'> {
  if (p.traziPaznju) return 'attention';
  return ['SUBMITTED', 'VIEWED', 'SHORTLISTED'].includes(p.stanje) ? 'active' : 'finished';
}
const statusTone = (state: MojaPrijavaProjekcija['stanje']) => state === 'STALE_REVIEW_REQUIRED' ? sys.color.warn
  : state === 'SELECTED' || state === 'SHORTLISTED' ? sys.color.green : state === 'WITHDRAWN' || state === 'CLOSED' ? sys.color.muted : sys.color.ink;
const statusDot = (state: MojaPrijavaProjekcija['stanje']) => state === 'STALE_REVIEW_REQUIRED' ? sys.color.orange
  : state === 'SELECTED' || state === 'SHORTLISTED' ? sys.color.green : state === 'WITHDRAWN' || state === 'CLOSED' ? sys.color.lineStrong : sys.color.ink;
type Props = {
  rows: MojaPrijavaProjekcija[]; loading: boolean; unavailable: boolean; message: string | null; notice: string | null;
  tab: ApplicationsTab; onTab: (tab: ApplicationsTab) => void; expanded: string | null; draft: OfferEdit | null;
  busy: boolean; editingLoading: boolean; pending: boolean; canRetry: boolean; canReset: boolean;
  onRefresh: () => void; onExplore: () => void; onProfile: () => void; onBack: () => void;
  onReview: (p: MojaPrijavaProjekcija) => void; onClose: () => void; onEdit: (p: MojaPrijavaProjekcija) => void;
  onChange: (draft: OfferEdit) => void; onCancelEdit: () => void; onKeep: (p: MojaPrijavaProjekcija) => void;
  onUpdate: (p: MojaPrijavaProjekcija) => void; onWithdraw: (p: MojaPrijavaProjekcija) => void;
  onAgreement: (p: MojaPrijavaProjekcija) => void; onRetry: () => void; onReset: () => void;
  /** The task the application belongs to. Without it a worker who applied cannot get back to it. */
  onTask: (p: MojaPrijavaProjekcija) => void;
  /** Which intent the user is in; shown in the header eyebrow. */
  intent?: Uloga;
  /** An application arrived at from a notification, brought into view once. */
  focusId?: string | null;
};
function Note({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'warn' }) {
  return <View style={[s.notice, tone === 'warn' && s.noticeWarn]}><T accessibilityRole="alert" variant="body" style={s.ink}>{children}</T></View>;
}
/** One application with the shared card anatomy: status → Task → where/when → your offer in the foot → the actions this state allows. */
const ApplicationCard = memo(function ApplicationCard({ row: p, expanded, children, onReview, onAgreement, onWithdraw, onTask, disabled }: {
  row: MojaPrijavaProjekcija; expanded: boolean; children?: ReactNode; onReview: () => void;
  onAgreement: () => void; onWithdraw: () => void; onTask: () => void; disabled: boolean;
}) {
  const stale = p.stanje === 'STALE_REVIEW_REQUIRED';
  return <View style={[card, s.card, stale && s.attentionCard, p.stanje === 'SELECTED' && s.selectedCard]}>
    <View style={s.statusRow}><View style={[s.dot, { backgroundColor: statusDot(p.stanje) }]} /><T variant="label" style={[s.status, { color: statusTone(p.stanje) }]}>{applicationStatus(p.stanje)}</T></View>
    <T accessibilityRole="header" style={s.title}>{p.naslov}</T>
    <View style={s.facts}>
      <View style={s.fact}><MapPin size={17} color={sys.color.green} /><T variant="note" tone="muted" style={s.factText}>{p.podrucjeTekst}</T></View>
      <View style={s.fact}><Clock size={17} color={sys.color.green} /><T variant="note" tone="muted" style={s.factText}>{p.vremeTekst}</T></View>
    </View>
    <View style={s.foot}>
      <View style={s.grow}><T variant="meta" tone="muted">Tvoja ponuda</T><T style={s.amount}>{p.cena.prikaz}</T></View>
      <T variant="meta" style={s.people}>{needPeopleText(p.pokrivaMesta)}</T>
    </View>
    {stale ? <><T variant="copy" style={s.ink}>Zadatak je izmenjen. Pregledaj aktuelne uslove pre nego što odlučiš o svojoj Prijavi.</T>
      {!expanded ? <V2Action label={`Pregledaj izmene: ${p.naslov}`} onPress={onReview} disabled={disabled} style={brandAction} /> : null}</> : null}
    {p.stanje === 'SELECTED' && p.dogovorId ? <V2Action label={`Otvori Dogovor: ${p.naslov}`} onPress={onAgreement} kind="primary" disabled={disabled} /> : null}
    {p.stanje !== 'STALE_REVIEW_REQUIRED' && p.napomena ? <T variant="note" tone="muted">{p.napomena}</T> : null}
    {/* The list offered the agreement, the changes and the withdrawal — never the task itself, so a
        worker who had applied could not read it again, or reach its questions, from here. */}
    <V2Action label={`Otvori zadatak: ${p.naslov}`} onPress={onTask} kind="quiet" disabled={disabled} style={s.quietLeft} />
    {!stale && p.mozePovuci ? <V2Action label={`Povuci prijavu: ${p.naslov}`} onPress={onWithdraw} kind="destructive" disabled={disabled} style={s.quietLeft} /> : null}
    {children}
  </View>;
});
/** Prijave — the worker's personal workspace: what you applied to and where each application stands. Presentation only. */
const deviceZone = (): string | undefined => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch { return undefined; }
};

export function MyApplicationsPresentation(props: Props) {
  const visible = props.tab === 'all' ? props.rows : props.rows.filter(p => applicationSection(p) === props.tab);
  // A notification names one application. Opening its row is not enough if the row is the ninth one
  // down, so the list also goes to it — once, and never fighting a scroll the person then makes.
  const list = useRef<FlatList<MojaPrijavaProjekcija> | null>(null);
  const brought = useRef<string | null>(null);
  const index = props.focusId ? visible.findIndex(p => p.prijavaId === props.focusId) : -1;
  useEffect(() => {
    if (index < 0 || !props.focusId || brought.current === props.focusId) return;
    brought.current = props.focusId;
    list.current?.scrollToIndex({ index, viewPosition: 0.15, animated: true });
  }, [index, props.focusId]);
  const disabled = props.busy || props.pending || props.editingLoading;
  const count = (tab: ApplicationsTab) => tab === 'all' ? props.rows.length : props.rows.filter(p => applicationSection(p) === tab).length;
  const badge = (tab: ApplicationsTab) => count(tab) || undefined;
  const empty = <View style={s.empty} accessibilityLiveRegion="polite">
    {props.loading ? <><SkeletonList count={3} rows={2} /><T variant="meta" tone="muted" style={s.center}>Učitavamo tvoje Prijave…</T></>
      : props.unavailable ? <View style={s.state}><T style={s.stateTitle}>Prijave trenutno nisu dostupne</T><T variant="copy" tone="muted">{props.message}</T>
        <V2Action label="Pokušaj ponovo" onPress={props.onRefresh} disabled={props.busy} style={brandAction} /><V2Action label="Nazad" onPress={props.onBack} kind="quiet" /></View>
        : props.rows.length ? <View style={s.state}><T style={s.stateTitle}>Nema prijava u ovom prikazu</T><T variant="copy" tone="muted">Ostale Prijave su sačuvane u svojim statusima.</T>
          <V2Action label="Prikaži sve prijave" onPress={() => props.onTab('all')} /></View>
          : <View style={s.state}><View style={s.emptyArt}><V2Icon name="send" size={44} color={sys.color.green} /></View>
            <T variant="label" style={s.eyebrow}>Tvoje ponude</T>
            <T style={s.stateTitle}>Tvoja sledeća prilika.</T><T variant="copy" tone="muted">Kada se prijaviš na Zadatak, ovde pratiš svoju ponudu i svaki sledeći korak.</T>
            <V2Action label="Istraži zadatke" onPress={props.onExplore} style={brandAction} /></View>}
  </View>;
  return <SafeAreaView edges={['top']} style={s.screen}>
    <ScreenHeader eyebrow={intentLabel(props.intent ?? 'uskocer')} title="Prijave" onProfile={props.onProfile} />
    {!props.unavailable && !props.loading ? <Segmented scroll style={s.tabs} value={props.tab} onChange={props.onTab}
      options={[{ key: 'all', label: 'Sve', badge: badge('all') }, { key: 'attention', label: 'Čeka te', badge: badge('attention') },
        { key: 'active', label: 'Aktivne', badge: badge('active') }, { key: 'finished', label: 'Završene', badge: badge('finished') }] as const} /> : null}
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.grow}>
      <FlatList<MojaPrijavaProjekcija> ref={list} data={props.loading || props.unavailable ? [] : visible} keyExtractor={p => p.prijavaId}
        onScrollToIndexFailed={() => undefined} initialNumToRender={8} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={s.list}
        refreshing={props.loading} onRefresh={props.onRefresh} ListEmptyComponent={empty}
        ListHeaderComponent={!props.loading && !props.unavailable && (props.message || props.notice || props.pending) ? <View style={s.feedback}>
          {props.message ? <Note tone="warn">{props.message}</Note> : null}{props.notice ? <Note>{props.notice}</Note> : null}
          {props.pending ? <View style={[card, s.pendingCard]}><T variant="body" style={s.ink}>{props.busy ? 'Čekamo potvrdu radnje…' : 'Pre nove odluke proveri sačuvano stanje. Ponavljanje koristi istu ponudu i isti zahtev.'}</T>
            <V2Action label="Proveri sačuvano stanje" onPress={props.onRefresh} disabled={props.busy} />
            {props.canRetry ? <V2Action label="Ponovi isti zahtev" onPress={props.onRetry} disabled={props.busy} /> : null}
            {props.canReset ? <V2Action label="Pregledaj aktuelnu prijavu" onPress={props.onReset} disabled={props.busy} /> : null}</View> : null}
        </View> : null}
        renderItem={({ item: p }) => <ApplicationCard row={p} expanded={props.expanded === p.prijavaId} disabled={disabled}
          onReview={() => props.onReview(p)} onAgreement={() => props.onAgreement(p)} onWithdraw={() => props.onWithdraw(p)}
          onTask={() => props.onTask(p)}>
          {props.expanded === p.prijavaId ? <View style={s.review}>
            <T variant="label" style={s.eyebrow}>Aktuelni uslovi · verzija {p.potrebaRevizija}</T><T variant="body" style={s.ink}>{p.opis || 'Dodatni opis nije naveden.'}</T>
            <T variant="note" tone="muted">Tvoja Prijava se odnosi na verziju {p.prijavaRevizija}. Zadržavanje čuva ponuđenu cenu, obim, termin i napomenu.</T>
            {p.napomena ? <T variant="body" style={s.ink}>Tvoja napomena: {p.napomena}</T> : null}
            {props.editingLoading ? <ActivityIndicator accessibilityLabel="Učitavanje sačuvanog termina" color={sys.color.green} /> : null}
            {props.draft ? <View style={s.fields}>
              <T accessibilityRole="header" variant="heading" style={s.ink}>Izmeni svoju ponudu</T><T variant="note" tone="muted">Cena važi za ceo ponuđeni obim.</T>
              <T variant="meta" tone="muted">Cena (RSD)</T><TextInput accessibilityLabel="Cena ponude (RSD)" value={props.draft.price} keyboardType="number-pad" editable={!disabled} onChangeText={price => props.onChange({ ...props.draft!, price })} style={s.input} />
              <T variant="meta" tone="muted">Ljudi koje obezbeđuješ</T><TextInput accessibilityLabel="Broj ljudi" value={props.draft.people} keyboardType="number-pad" editable={!disabled} onChangeText={people => props.onChange({ ...props.draft!, people })} style={s.input} />
              <T variant="meta" tone="muted">Napomena</T><TextInput accessibilityLabel="Napomena uz ponudu" value={props.draft.note} multiline editable={!disabled} onChangeText={note => props.onChange({ ...props.draft!, note })} style={[s.input, s.multiline]} />
              <T variant="note" tone="muted">Ponuđeni termin ostaje nepromenjen: {props.draft.start || props.draft.end
                ? needScheduleText({ kind: 'FIXED_WINDOW', startsAt: props.draft.start, endsAt: props.draft.end }, deviceZone()) : 'Nije naveden u Prijavi.'}</T>
              <V2Action label="Sačuvaj izmenjenu prijavu" onPress={() => props.onUpdate(p)} disabled={disabled} style={brandAction} />
              <V2Action label="Odustani od izmene" onPress={props.onCancelEdit} disabled={disabled} kind="quiet" />
            </View> : <><V2Action label="Zadrži prijavu" onPress={() => props.onKeep(p)} disabled={disabled} kind="primary" />
              <V2Action label="Izmeni prijavu" onPress={() => props.onEdit(p)} disabled={disabled} />
              <V2Action label="Povuci izmenjenu prijavu" onPress={() => props.onWithdraw(p)} disabled={disabled} kind="destructive" /></>}
            <V2Action label="Zatvori pregled izmena" onPress={props.onClose} disabled={props.busy || props.pending} kind="quiet" />
          </View> : null}
        </ApplicationCard>} />
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground }, grow: { flex: 1, minWidth: 0 }, ink: { color: sys.color.ink }, center: { textAlign: 'center' },
  tabs: { marginHorizontal: 20, marginTop: 6, marginBottom: 12, flexGrow: 0 },
  eyebrow: { color: sys.color.green, letterSpacing: 0.4 },
  list: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28 },
  empty: { flex: 1, paddingVertical: 8, gap: 16 },
  state: { paddingVertical: 24, paddingHorizontal: 4, gap: 12, alignItems: 'flex-start' },
  stateTitle: { ...sys.type.title, color: sys.color.ink },
  emptyArt: { width: 84, height: 84, borderRadius: sys.radius.sheet, backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  card: { gap: 8, marginBottom: 12 },
  attentionCard: { borderColor: sys.color.orange }, selectedCard: { borderColor: sys.color.green },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, dot: { width: 6, height: 6, borderRadius: sys.radius.pill }, status: { flexShrink: 1, letterSpacing: 0.3 },
  title: { ...sys.type.cardTitle, color: sys.color.ink },
  facts: { gap: 6, marginTop: 1 }, fact: { flexDirection: 'row', alignItems: 'center', gap: 8 }, factText: { flex: 1 },
  foot: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 6, paddingTop: 13, borderTopWidth: 1, borderTopColor: sys.color.line },
  amount: { ...sys.type.price, color: sys.color.money },
  people: { color: sys.color.ink, fontWeight: '600', paddingBottom: 4 },
  quietLeft: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  review: { gap: 12, paddingTop: 14, marginTop: 6, borderTopWidth: 1, borderColor: sys.color.line }, fields: { gap: 8 },
  input: { ...sys.type.body, minHeight: 48, borderRadius: sys.radius.control, borderWidth: 1, borderColor: sys.color.lineStrong, color: sys.color.ink, backgroundColor: sys.color.surface, paddingHorizontal: 12, paddingVertical: 9 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  notice: { padding: 14, backgroundColor: sys.color.greenSoft, borderRadius: sys.radius.control }, noticeWarn: { backgroundColor: sys.color.warnSoft },
  pendingCard: { gap: 8 },
  feedback: { gap: 10, marginBottom: 14 },
});
