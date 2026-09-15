import { memo, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User } from 'phosphor-react-native';
import type { MojaPrijavaProjekcija } from '../../contracts/projections';
import { needPeopleText, needScheduleText } from '../../data/needDetailPresentation';
import { InboxBell } from '../InboxBell';
import { Press } from '../Press';
import { T } from '../Text';
import { V2Action } from './V2Action';
import { V2Icon } from './icons';
import { v2 } from './tokens';

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
type Props = {
  rows: MojaPrijavaProjekcija[]; loading: boolean; unavailable: boolean; message: string | null; notice: string | null;
  tab: ApplicationsTab; onTab: (tab: ApplicationsTab) => void; expanded: string | null; draft: OfferEdit | null;
  busy: boolean; editingLoading: boolean; pending: boolean; canRetry: boolean; canReset: boolean;
  onRefresh: () => void; onExplore: () => void; onProfile: () => void; onBack: () => void;
  onReview: (p: MojaPrijavaProjekcija) => void; onClose: () => void; onEdit: (p: MojaPrijavaProjekcija) => void;
  onChange: (draft: OfferEdit) => void; onCancelEdit: () => void; onKeep: (p: MojaPrijavaProjekcija) => void;
  onUpdate: (p: MojaPrijavaProjekcija) => void; onWithdraw: (p: MojaPrijavaProjekcija) => void;
  onAgreement: (p: MojaPrijavaProjekcija) => void; onRetry: () => void; onReset: () => void;
};
function Note({ children }: { children: ReactNode }) { return <View style={s.notice}><T accessibilityRole="alert" style={s.body}>{children}</T></View>; }
const ApplicationCard = memo(function ApplicationCard({ row: p, expanded, children, onReview, onAgreement, onWithdraw, disabled }: {
  row: MojaPrijavaProjekcija; expanded: boolean; children?: ReactNode; onReview: () => void;
  onAgreement: () => void; onWithdraw: () => void; disabled: boolean;
}) {
  const stale = p.stanje === 'STALE_REVIEW_REQUIRED';
  return <View style={[s.card, stale && s.attentionCard]}>
    <View style={[s.badge, stale && s.warm]}><T style={s.status}>{applicationStatus(p.stanje)}</T></View>
    <T accessibilityRole="header" style={s.title}>{p.naslov}</T>
    <T style={s.caption}>{p.podrucjeTekst}</T><T style={s.caption}>{p.vremeTekst}</T>
    <View style={s.offer}><View style={s.grow}><T style={s.caption}>Tvoja ponuda</T><T style={s.amount}>{p.cena.prikaz}</T></View>
      <T style={s.body}>{needPeopleText(p.pokrivaMesta)}</T></View>
    {stale ? <><T style={s.body}>Zadatak je izmenjen. Pregledaj aktuelne uslove pre nego što odlučiš o svojoj Prijavi.</T>
      {!expanded ? <V2Action label={`Pregledaj izmene: ${p.naslov}`} onPress={onReview} disabled={disabled} /> : null}</> : null}
    {p.stanje === 'SELECTED' && p.dogovorId ? <V2Action label={`Otvori Dogovor: ${p.naslov}`} onPress={onAgreement} kind="primary" disabled={disabled} /> : null}
    {!stale && p.mozePovuci ? <V2Action label={`Povuci prijavu: ${p.naslov}`} onPress={onWithdraw} kind="quiet" disabled={disabled} /> : null}
    {p.stanje !== 'STALE_REVIEW_REQUIRED' && p.napomena ? <T style={s.caption}>{p.napomena}</T> : null}
    {children}
  </View>;
});
export function MyApplicationsPresentation(props: Props) {
  const visible = props.tab === 'all' ? props.rows : props.rows.filter(p => applicationSection(p) === props.tab);
  const disabled = props.busy || props.pending || props.editingLoading;
  const empty = <View style={s.empty} accessibilityLiveRegion="polite">
    {props.loading ? <><ActivityIndicator accessibilityLabel="Učitavanje prijava" color={v2.color.teal} /><T style={s.body}>Učitavamo tvoje Prijave…</T></>
      : props.unavailable ? <><T style={s.hero}>Prijave trenutno nisu dostupne</T><T style={s.body}>{props.message}</T><V2Action label="Pokušajte ponovo" onPress={props.onRefresh} disabled={props.busy} /><V2Action label="Nazad" onPress={props.onBack} kind="quiet" /></>
        : props.rows.length ? <><T style={s.hero}>Nema prijava u ovom prikazu</T><T style={s.body}>Ostale Prijave su sačuvane u svojim statusima.</T><V2Action label="Prikaži sve prijave" onPress={() => props.onTab('all')} /></>
          : <><View style={s.emptyArt}><V2Icon name="send" size={66} color={v2.color.teal} /></View><T style={s.eyebrow}>TVOJE PONUDE</T>
            <T style={s.hero}>Tvoja sledeća prilika.</T><T style={s.body}>Kada se prijaviš na Zadatak, ovde ćeš pratiti svoju ponudu i svaki sledeći korak.</T>
            <V2Action label="Istraži zadatke" onPress={props.onExplore} style={s.orange} /></>}
  </View>;
  return <SafeAreaView edges={['top']} style={s.screen}>
    <View style={s.header}><View style={s.grow}><T style={s.caption}>Gde želiš da uskočiš</T><T accessibilityRole="header" style={s.heading}>Prijave</T></View>
      <InboxBell /><Press accessibilityRole="button" accessibilityLabel="Moj profil" onPress={props.onProfile} style={s.profile}><User size={21} color={v2.color.ink} /></Press></View>
    {!props.unavailable && !props.loading ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabScroll} contentContainerStyle={s.tabs}>
      {([['all', 'Sve'], ['attention', 'Čeka te'], ['active', 'Aktivne'], ['finished', 'Završene']] as const).map(([tab, label]) => {
        const count = tab === 'all' ? props.rows.length : props.rows.filter(p => applicationSection(p) === tab).length;
        return <Press key={tab} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: props.tab === tab }}
          onPress={() => props.onTab(tab)} haptic="select" style={[s.tab, props.tab === tab && s.tabSelected]}><T style={s.status}>{label} · {count}</T></Press>;
      })}
    </ScrollView> : null}
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.grow}>
      <FlatList<MojaPrijavaProjekcija> data={props.loading || props.unavailable ? [] : visible} keyExtractor={p => p.prijavaId}
        initialNumToRender={8} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={s.list}
        refreshing={props.loading} onRefresh={props.onRefresh} ListEmptyComponent={empty}
        ListHeaderComponent={!props.loading && !props.unavailable && (props.message || props.notice || props.pending) ? <View style={s.feedback}>
          {props.message ? <Note>{props.message}</Note> : null}{props.notice ? <Note>{props.notice}</Note> : null}
          {props.pending ? <><T style={s.body}>{props.busy ? 'Čekamo potvrdu radnje…' : 'Pre nove odluke proveri sačuvano stanje. Ponavljanje koristi istu ponudu i isti zahtev.'}</T>
            <V2Action label="Proveri sačuvano stanje" onPress={props.onRefresh} disabled={props.busy} />
            {props.canRetry ? <V2Action label="Ponovi isti zahtev" onPress={props.onRetry} disabled={props.busy} /> : null}
            {props.canReset ? <V2Action label="Pregledaj aktuelnu prijavu" onPress={props.onReset} disabled={props.busy} /> : null}</> : null}
        </View> : null}
        renderItem={({ item: p }) => <ApplicationCard row={p} expanded={props.expanded === p.prijavaId} disabled={disabled}
          onReview={() => props.onReview(p)} onAgreement={() => props.onAgreement(p)} onWithdraw={() => props.onWithdraw(p)}>
          {props.expanded === p.prijavaId ? <View style={s.review}>
            <T style={s.eyebrow}>AKTUELNI USLOVI · VERZIJA {p.potrebaRevizija}</T><T style={s.body}>{p.opis || 'Dodatni opis nije naveden.'}</T>
            <T style={s.caption}>Tvoja Prijava se odnosi na verziju {p.prijavaRevizija}. Zadržavanje čuva ponuđenu cenu, obim, termin i napomenu.</T>
            {p.napomena ? <T style={s.body}>Tvoja napomena: {p.napomena}</T> : null}
            {props.editingLoading ? <ActivityIndicator accessibilityLabel="Učitavanje sačuvanog termina" color={v2.color.teal} /> : null}
            {props.draft ? <View style={s.fields}>
              <T accessibilityRole="header" style={s.title}>Izmeni svoju ponudu</T><T style={s.caption}>Cena važi za ceo ponuđeni obim.</T>
              <T style={s.caption}>Cena (RSD)</T><TextInput accessibilityLabel="Cena ponude (RSD)" value={props.draft.price} keyboardType="number-pad" editable={!disabled} onChangeText={price => props.onChange({ ...props.draft!, price })} style={s.input} />
              <T style={s.caption}>Ljudi koje obezbeđuješ</T><TextInput accessibilityLabel="Broj ljudi" value={props.draft.people} keyboardType="number-pad" editable={!disabled} onChangeText={people => props.onChange({ ...props.draft!, people })} style={s.input} />
              <T style={s.caption}>Napomena</T><TextInput accessibilityLabel="Napomena uz ponudu" value={props.draft.note} multiline editable={!disabled} onChangeText={note => props.onChange({ ...props.draft!, note })} style={[s.input, s.multiline]} />
              <T style={s.caption}>Ponuđeni termin ostaje nepromenjen: {props.draft.start || props.draft.end
                ? needScheduleText({ kind: 'FIXED_WINDOW', startsAt: props.draft.start, endsAt: props.draft.end }) : 'Nije naveden u Prijavi.'}</T>
              <V2Action label="Sačuvaj izmenjenu prijavu" onPress={() => props.onUpdate(p)} disabled={disabled} style={s.orange} />
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
  screen: { flex: 1, backgroundColor: v2.color.canvas }, grow: { flex: 1 }, header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  heading: { ...v2.text.title, color: v2.color.ink }, hero: { ...v2.text.hero, color: v2.color.ink }, title: { fontSize: 19, lineHeight: 26, fontWeight: '700', color: v2.color.ink },
  body: { ...v2.text.body, color: v2.color.ink }, caption: { ...v2.text.label, color: v2.color.muted }, eyebrow: { ...v2.text.label, color: v2.color.teal, letterSpacing: 1.1, fontWeight: '700' },
  profile: { minHeight: 44, minWidth: 44, borderRadius: 22, backgroundColor: v2.color.soft, alignItems: 'center', justifyContent: 'center' },
  tabScroll: { flexGrow: 0 }, tabs: { paddingHorizontal: 20, paddingBottom: 12, gap: 6 }, tab: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 13, borderWidth: 1, borderColor: v2.color.line }, tabSelected: { backgroundColor: v2.color.soft, borderColor: v2.color.controlLine },
  list: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 28 }, empty: { flex: 1, paddingVertical: 38, justifyContent: 'center', gap: 18 }, emptyArt: { height: 118, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: v2.color.surface, borderRadius: 18, borderWidth: 1, borderColor: v2.color.line, padding: 18, gap: 9, marginBottom: 14 }, attentionCard: { borderColor: '#E8CBAF' },
  badge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: v2.color.soft }, warm: { backgroundColor: v2.color.warm }, status: { ...v2.text.label, color: v2.color.ink, fontWeight: '700' },
  offer: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderColor: v2.color.line, marginTop: 5 }, amount: { fontSize: 20, lineHeight: 27, fontWeight: '700', color: v2.color.ink },
  review: { gap: 13, paddingTop: 16, borderTopWidth: 1, borderColor: v2.color.line }, fields: { gap: 9 }, input: { ...v2.text.body, minHeight: 48, borderRadius: 11, borderWidth: 1, borderColor: v2.color.controlLine, color: v2.color.ink, backgroundColor: v2.color.surface, paddingHorizontal: 12, paddingVertical: 9 }, multiline: { minHeight: 90, textAlignVertical: 'top' },
  orange: { backgroundColor: v2.color.orange, borderWidth: 0, minHeight: 50 }, notice: { padding: 14, backgroundColor: v2.color.context, borderRadius: 14 }, feedback: { gap: 10, marginBottom: 16 },
});
