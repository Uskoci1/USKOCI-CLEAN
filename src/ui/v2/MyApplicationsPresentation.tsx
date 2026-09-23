import { memo, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretRight } from 'phosphor-react-native';
import type { MojaPrijavaProjekcija } from '../../contracts/projections';
import type { ApplicationEditPricing } from '../../data/myApplicationsClientService';
import { needScheduleText, readableTitle } from '../../data/needDetailPresentation';
import { osoba } from '../system/plural';
import { Press } from '../Press';
import { Appear, useAppear } from '../system/Appear';
import { DetailTopBar } from '../system/DetailTopBar';
import { Segmented } from '../system/Segmented';
import { SkeletonList } from '../system/Skeleton';
import { FactArt } from '../system/FactArt';
import { brandAction, card, sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from './V2Action';

export type ApplicationsTab = 'all' | 'attention' | 'active' | 'finished';
export type OfferEdit = { price: string; people: string; note: string; start: string | null; end: string | null; pricing: ApplicationEditPricing };
const applicationStatus = (state: MojaPrijavaProjekcija['stanje']) => ({
  SUBMITTED: 'Poslata', VIEWED: 'Pregledana', SHORTLISTED: 'U užem izboru', SELECTED: 'Izabrana',
  WITHDRAWN: 'Povučena', CLOSED: 'Zadatak je zatvoren', STALE_REVIEW_REQUIRED: 'Potrebna nova provera',
})[state];
function applicationSection(p: MojaPrijavaProjekcija): Exclude<ApplicationsTab, 'all'> {
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
  /** An application arrived at from a notification, brought into view once. */
  focusId?: string | null;
  /** Requested destination, including a row that the current owned read cannot return. */
  requestedId?: string | null;
};
function Note({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'warn' }) {
  return <View style={[s.notice, tone === 'warn' && s.noticeWarn]}><T accessibilityRole="alert" variant="body" style={s.ink}>{children}</T></View>;
}
/** One application with the shared card anatomy: status → Task → where/when → your offer in the foot → the actions this state allows. */
const ApplicationCard = memo(function ApplicationCard({ row: p, expanded, focused, children, onReview, onAgreement, onWithdraw, onTask, disabled }: {
  row: MojaPrijavaProjekcija; expanded: boolean; focused: boolean; children?: ReactNode; onReview: () => void;
  onAgreement: () => void; onWithdraw: () => void; onTask: () => void; disabled: boolean;
}) {
  const stale = p.stanje === 'STALE_REVIEW_REQUIRED';
  return <View style={[card, s.card, focused && s.focusedCard, stale && s.attentionCard, p.stanje === 'SELECTED' && s.selectedCard]}>
    {focused ? <T variant="meta" style={s.focusLabel}>Otvorena prijava</T> : null}
    {/* Everything a person reads to recognise the application is one press that opens the Task it
        belongs to. It used to be a small green line of text under the card, easy to miss and the
        only way back to the Task a worker had applied to; the actions below stay separate so no
        touch target sits inside another. */}
    <Press accessibilityRole="button" accessibilityLabel={`Otvori zadatak: ${readableTitle(p.naslov)}`} accessibilityState={{ disabled }}
      onPress={onTask} disabled={disabled} haptic="select" scaleTo={0.99} style={s.head}>
      <View style={s.statusRow}><View style={[s.dot, { backgroundColor: statusDot(p.stanje) }]} />
        <T variant="label" style={[s.status, { color: statusTone(p.stanje) }]}>{applicationStatus(p.stanje)}</T>
        <View style={s.grow} /><CaretRight size={18} color={sys.color.muted} /></View>
      <T accessibilityRole="header" style={s.title}>{readableTitle(p.naslov)}</T>
      <View style={s.facts}>
        <View style={s.fact}><FactArt kind="pin" size={26} /><T variant="note" tone="muted" style={s.factText}>{p.podrucjeTekst}</T></View>
        <View style={s.fact}><FactArt kind="calendar" size={26} /><T variant="note" tone="muted" style={s.factText}>{p.vremeTekst}</T></View>
      </View>
      <View style={s.foot}>
        <View style={s.offerTotal}><T variant="meta" tone="muted">Tvoja ponuda · ukupno</T><T style={s.amount}>{p.cena.prikaz}</T></View>
        <View style={s.people}><FactArt kind="users" size={26} /><T variant="bodyStrong" style={s.ink}>{osoba(p.pokrivaMesta)}</T></View>
      </View>
    </Press>
    {/* The orange border already says this card wants you. An orange button inside it as well, on
        every card of the "Čeka te" tab, spends the one colour that is supposed to mean "the step". */}
    {stale ? <><T variant="copy" style={s.ink}>Zadatak je izmenjen. Pregledaj aktuelne uslove pre nego što odlučiš o svojoj Prijavi.</T>
      {!expanded ? <V2Action label="Pregledaj izmene" accessibilityLabel={`Pregledaj izmene: ${readableTitle(p.naslov)}`} onPress={onReview} disabled={disabled} kind="primary" /> : null}</> : null}
    {p.stanje === 'SELECTED' && p.dogovorId ? <V2Action label="Otvori Dogovor" accessibilityLabel={`Otvori Dogovor: ${readableTitle(p.naslov)}`} onPress={onAgreement} kind="primary" disabled={disabled} /> : null}
    {p.stanje !== 'STALE_REVIEW_REQUIRED' && p.napomena?.trim() ? <View style={s.offerNote}>
      <T variant="meta" tone="muted">Tvoja poruka</T><T variant="note" style={s.ink}>{p.napomena}</T></View> : null}
    {!stale && p.mozePovuci ? <V2Action label="Povuci prijavu" accessibilityLabel={`Povuci prijavu: ${readableTitle(p.naslov)}`} onPress={onWithdraw} compact kind="destructive" disabled={disabled} style={s.quietLeft} /> : null}
    {children}
  </View>;
});
/** Prijave — the worker's personal workspace: what you applied to and where each application stands. Presentation only. */
const deviceZone = (): string | undefined => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch { return undefined; }
};

export function MyApplicationsPresentation(props: Props) {
  const filtered = props.tab === 'all' ? props.rows : props.rows.filter(p => applicationSection(p) === props.tab);
  // Put the explicitly requested row first. Unlike scrollToIndex this also works before variable-height
  // cards outside the initial virtualized window have been measured. Never change the user's filter.
  const focused = props.focusId ? filtered.find(p => p.prijavaId === props.focusId) : undefined;
  const visible = focused ? [focused, ...filtered.filter(p => p.prijavaId !== focused.prijavaId)] : filtered;
  const missingNamed = !!props.requestedId && !props.rows.some(p => p.prijavaId === props.requestedId);
  const appear = useAppear();
  appear.settle(visible.map(p => p.prijavaId));
  const disabled = props.busy || props.pending || props.editingLoading;
  const count = (tab: ApplicationsTab) => tab === 'all' ? props.rows.length : props.rows.filter(p => applicationSection(p) === tab).length;
  const badge = (tab: ApplicationsTab) => count(tab) || undefined;
  const empty = <View style={s.empty} accessibilityLiveRegion="polite">
    {props.loading ? <><SkeletonList count={3} rows={2} /><T variant="meta" tone="muted" style={s.center}>Učitavamo tvoje Prijave…</T></>
      : props.unavailable ? <View style={s.state}><T style={s.stateTitle}>Prijave trenutno nisu dostupne</T><T variant="copy" tone="muted">{props.message}</T>
        <V2Action label="Pokušaj ponovo" onPress={props.onRefresh} disabled={props.busy} style={brandAction} /><V2Action label="Nazad" onPress={props.onBack} kind="quiet" /></View>
        : props.rows.length ? <View style={s.state}><T style={s.stateTitle}>Nema prijava u ovom prikazu</T><T variant="copy" tone="muted">Ostale Prijave su sačuvane u svojim statusima.</T>
          <V2Action label="Prikaži sve prijave" onPress={() => props.onTab('all')} /></View>
          : <View style={s.state}><View style={s.emptyArt}><FactArt kind="offers" size={56} /></View>
            {/* The kicker "Tvoje ponude" only said where you are; the bar already does (owner, 2026-09-23). */}
            <T style={s.stateTitle}>Tvoja sledeća prilika.</T><T variant="copy" tone="muted">Kada se prijaviš na Zadatak, ovde pratiš svoju ponudu i svaki sledeći korak.</T>
            <V2Action label="Istraži zadatke" onPress={props.onExplore} style={brandAction} /></View>}
  </View>;
  return <SafeAreaView edges={['top']} style={s.screen}>
    <DetailTopBar title="Moje prijave" onBack={props.onBack} />
    {!props.unavailable && !props.loading ? <Segmented scroll style={s.tabs} value={props.tab} onChange={props.onTab}
      options={[{ key: 'all', label: 'Sve', badge: badge('all') }, { key: 'attention', label: 'Čeka te', badge: badge('attention') },
        { key: 'active', label: 'Aktivne', badge: badge('active') }, { key: 'finished', label: 'Završene', badge: badge('finished') }] as const} /> : null}
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.grow}>
      <FlatList<MojaPrijavaProjekcija> data={props.loading || props.unavailable ? [] : visible} keyExtractor={p => p.prijavaId}
        initialNumToRender={8} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={s.list}
        refreshing={props.loading} onRefresh={props.onRefresh} ListEmptyComponent={empty}
        ListHeaderComponent={!props.loading && !props.unavailable && (props.message || props.notice || props.pending || missingNamed) ? <View style={s.feedback}>
          {missingNamed ? <View style={s.notice}><T variant="body" accessibilityRole="alert">Ova prijava trenutno nije dostupna</T>
            <T variant="note" tone="muted">Osveži spisak da proveriš njeno stanje.</T>
            <V2Action label="Osveži prijave" onPress={props.onRefresh} disabled={props.busy} /></View> : null}
          {props.message ? <Note tone="warn">{props.message}</Note> : null}{props.notice ? <Note>{props.notice}</Note> : null}
          {props.pending ? <View style={[card, s.pendingCard]}><T variant="body" style={s.ink}>{props.busy ? 'Čekamo potvrdu radnje…' : 'Pre nove odluke proveri sačuvano stanje. Ponavljanje koristi istu ponudu i isti zahtev.'}</T>
            <V2Action label="Proveri sačuvano stanje" onPress={props.onRefresh} disabled={props.busy} />
            {props.canRetry ? <V2Action label="Ponovi isti zahtev" onPress={props.onRetry} disabled={props.busy} /> : null}
            {props.canReset ? <V2Action label="Pregledaj aktuelnu prijavu" onPress={props.onReset} disabled={props.busy} /> : null}</View> : null}
        </View> : null}
        renderItem={({ item: p, index }) => <Appear index={index} animate={appear.isNew(p.prijavaId)}>
          <ApplicationCard row={p} expanded={props.expanded === p.prijavaId} focused={p.prijavaId === props.focusId} disabled={disabled}
          onReview={() => props.onReview(p)} onAgreement={() => props.onAgreement(p)} onWithdraw={() => props.onWithdraw(p)}
          onTask={() => props.onTask(p)}>
          {props.expanded === p.prijavaId && p.stanje === 'STALE_REVIEW_REQUIRED' ? <View style={s.review}>
            <T variant="label" style={s.eyebrow}>Aktuelni uslovi · verzija {p.potrebaRevizija}</T><T variant="body" style={s.ink}>{p.opis || 'Dodatni opis nije naveden.'}</T>
            <T variant="note" tone="muted">Tvoja Prijava se odnosi na verziju {p.prijavaRevizija}. Zadržavanje čuva ponuđenu cenu, obim, termin i napomenu.</T>
            {p.napomena ? <T variant="body" style={s.ink}>Tvoja napomena: {p.napomena}</T> : null}
            {props.editingLoading ? <ActivityIndicator accessibilityLabel="Učitavanje sačuvanog termina" color={sys.color.green} /> : null}
            {props.draft ? <View style={s.fields}>
              <T accessibilityRole="header" variant="heading" style={s.ink}>Izmeni svoju ponudu</T><T variant="note" tone="muted">{props.draft.pricing.rezimCene === 'OFFERS' ? 'Cena važi za ceo ponuđeni obim.'
                : props.draft.pricing.osnovaCene === 'PER_PERSON' ? 'Cena po osobi iz zadatka množi se brojem ljudi u tvojoj prijavi.'
                : props.draft.pricing.osnovaCene === 'TOTAL' ? 'Ukupna cena važi za ceo zadatak. Prijava pokriva sva mesta.' : 'Cena je određena u zadatku.'}</T>
              <T variant="meta" tone="muted">Cena prijave ukupno (RSD)</T><TextInput accessibilityLabel="Cena ponude (RSD)" value={props.draft.price} keyboardType="number-pad" editable={!disabled && props.draft.pricing.rezimCene === 'OFFERS'} onChangeText={price => props.onChange({ ...props.draft!, price })} style={s.input} />
              <T variant="meta" tone="muted">Ljudi koje obezbeđuješ</T><TextInput accessibilityLabel="Broj ljudi" value={props.draft.people} keyboardType="number-pad" editable={!disabled && !(props.draft.pricing.rezimCene === 'MY_PRICE' && props.draft.pricing.osnovaCene === 'TOTAL')} onChangeText={people => props.onChange({ ...props.draft!, people })} style={s.input} />
              <T variant="meta" tone="muted">Napomena</T><TextInput accessibilityLabel="Napomena uz ponudu" value={props.draft.note} multiline editable={!disabled} onChangeText={note => props.onChange({ ...props.draft!, note })} style={[s.input, s.multiline]} />
              <T variant="note" tone="muted">Ponuđeni termin ostaje nepromenjen: {props.draft.start || props.draft.end
                ? needScheduleText({ kind: 'FIXED_WINDOW', startsAt: props.draft.start, endsAt: props.draft.end }, deviceZone()) : 'Nije naveden u Prijavi.'}</T>
              <V2Action label="Sačuvaj izmenjenu prijavu" onPress={() => props.onUpdate(p)} disabled={disabled} style={brandAction} />
              <V2Action label="Odustani od izmene" onPress={props.onCancelEdit} disabled={disabled} kind="quiet" />
            </View> : <><V2Action label="Zadrži prijavu" onPress={() => props.onKeep(p)} disabled={disabled} kind="primary" />
              <V2Action label="Izmeni prijavu" onPress={() => props.onEdit(p)} disabled={disabled} />
              <V2Action label="Povuci izmenjenu prijavu" onPress={() => props.onWithdraw(p)} disabled={disabled} kind="destructive" style={s.quietLeft} /></>}
            <V2Action label="Zatvori pregled izmena" onPress={props.onClose} disabled={props.busy || props.pending} kind="quiet" />
          </View> : null}
        </ApplicationCard></Appear>} />
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
  card: { gap: 12, marginBottom: 16 },
  head: { gap: 10 },
  focusedCard: { borderColor: sys.color.green }, focusLabel: { color: sys.color.green, fontWeight: '600' },
  offerNote: { gap: 4, paddingLeft: 12, borderLeftWidth: 2, borderColor: sys.color.lineStrong },
  attentionCard: { borderColor: sys.color.orange }, selectedCard: { borderColor: sys.color.green },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, dot: { width: 6, height: 6, borderRadius: sys.radius.pill }, status: { flexShrink: 1, letterSpacing: 0.3 },
  title: { ...sys.type.cardTitle, color: sys.color.green },
  facts: { gap: 6, marginTop: 1 }, fact: { flexDirection: 'row', alignItems: 'center', gap: 8 }, factText: { flex: 1 },
  foot: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12, marginTop: 6, paddingTop: 13, borderTopWidth: 1, borderTopColor: sys.color.line },
  amount: { ...sys.type.price, color: sys.color.money },
  offerTotal: { flexGrow: 1, flexBasis: 160, maxWidth: '100%' },
  people: { flexDirection: 'row', flexShrink: 1, alignItems: 'center', gap: 6, paddingBottom: 4 },
  quietLeft: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  review: { gap: 12, paddingTop: 14, marginTop: 6, borderTopWidth: 1, borderColor: sys.color.line }, fields: { gap: 8 },
  input: { ...sys.type.body, minHeight: 48, borderRadius: sys.radius.control, borderWidth: 1, borderColor: sys.color.lineStrong, color: sys.color.ink, backgroundColor: sys.color.surface, paddingHorizontal: 12, paddingVertical: 9 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  notice: { padding: 14, backgroundColor: sys.color.greenSoft, borderRadius: sys.radius.control }, noticeWarn: { backgroundColor: sys.color.warnSoft },
  pendingCard: { gap: 8 },
  feedback: { gap: 10, marginBottom: 14 },
});
