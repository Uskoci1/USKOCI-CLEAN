import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Star } from 'phosphor-react-native';
import type { ReviewTag } from '../../data/reviewsClientService';
import { Press } from '../Press';
import { Avatar } from '../system/Avatar';
import { DetailTopBar } from '../system/DetailTopBar';
import { StateView } from '../system/StateView';
import { SuccessMark } from '../system/SuccessMark';
import { plural } from '../system/plural';
import { brandAction, inset, sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';

/*
 * The rating screen as it is drawn (round 6, unit `prijava`, 2026-09-24), apart from the screen that reads and saves it
 * (`AgreementReviewScreen`), so the internal gallery can draw every state from fixtures without touching a data service.
 * It imports the review types only, never the service.
 */
export const tagLabels: Record<ReviewTag, string> = {
  AS_AGREED: 'Po dogovoru', CAREFUL: 'Pažljivo', CLEAR_COMMUNICATION: 'Jasna komunikacija',
  ON_TIME: 'Na vreme', RELIABLE: 'Pouzdano', RESPECTFUL: 'Uz poštovanje',
};
const ratingLabels = ['Izaberi ocenu', 'Loše', 'Ispod očekivanja', 'Dobro', 'Vrlo dobro', 'Odlično'];
/** The side padding of the screen; five stars share what is left. */
const SIDE = sys.space.lg;
/** A star is a 56 px square while five fit, never under the 48 a control needs. */
const STAR_MAX = 56, STAR_MIN = 48;
const reviewedTags = (tags: readonly ReviewTag[]) => tags.map(tag => tagLabels[tag]).join(' · ');
/** Whom the rating is about, as the screen draws them: never invented, absent when the Dogovor did not say. */
export type ReviewPerson = { name: string; initials: string; profileId: string | null; role: string; task: string };
/** What the rating screen shows; each state carries only what it draws. */
export type ReviewView =
  | { kind: 'loading' } | { kind: 'none' } | { kind: 'unavailable' }
  | { kind: 'error'; message: string }
  | { kind: 'saved'; rating: number; tags: readonly ReviewTag[]; fresh: boolean }
  | { kind: 'eligible'; catalog: { maxTags: number; tags: readonly ReviewTag[] }; rating: number; tags: readonly ReviewTag[]; editable: boolean;
      attempt: boolean; onRate: (value: number) => void; onToggleTag: (tag: ReviewTag) => void;
      save: { label: string; loading: boolean; disabled: boolean; reason: string | null; onPress: () => void } };
type ReviewRetry = { label: string; disabled: boolean; onPress: () => void };

/**
 * The rating screen as it is drawn, from its state alone (the internal gallery draws it with fixtures). Presentation
 * only: every press is the screen's own handler, which keeps its guards.
 */
export function AgreementReviewPresentation({ backLabel, onBack, view, retry, notice, person, photo }: {
  backLabel: string; onBack: () => void; view: ReviewView; retry: ReviewRetry;
  /** A failure with the rating still on screen: said in the foot, beside the one way to check again. */
  notice: string | null;
  person: ReviewPerson | null; photo?: (profileId: string, fallback: ReactNode) => ReactNode;
}) {
  const { width } = useWindowDimensions();
  const star = Math.max(STAR_MIN, Math.min(STAR_MAX, Math.floor((width - 2 * SIDE) / 5)));
  const face = (size: 40 | 56) => person ? size === 56 && person.profileId && photo
    ? photo(person.profileId, <Avatar initials={person.initials} size={56} />) : <Avatar initials={person.initials} size={size} /> : null;
  const tagsFull = view.kind === 'eligible' && view.tags.length >= view.catalog.maxTags;
  // `none` (no read has answered yet) is drawn as loading: never an empty screen without a way on.
  const loading = view.kind === 'loading' || view.kind === 'none';
  const footer = loading || view.kind === 'error' ? null
    // A saved rating stays saved when a later read fails: the way back stays the green action, the check beside it.
    : notice && view.kind === 'saved' ? <>
      <View style={s.notice}><T accessibilityRole="alert" variant="body" style={s.ink}>{notice}</T></View>
      <V2Action label={backLabel} onPress={onBack} style={brandAction} />
      <V2Action label={retry.label} kind="quiet" disabled={retry.disabled} onPress={retry.onPress} />
    </>
    : notice ? <>
      <View style={s.notice}><T accessibilityRole="alert" variant="body" style={s.ink}>{notice}</T></View>
      <V2Action label={retry.label} disabled={retry.disabled} onPress={retry.onPress} style={brandAction} />
    </>
    : view.kind === 'saved' ? <V2Action label={backLabel} onPress={onBack} style={brandAction} />
    : view.kind === 'eligible' ? <V2Action label={view.save.label} loading={view.save.loading} disabled={view.save.disabled}
      reason={view.save.reason} onPress={view.save.onPress} style={brandAction} />
    : null;
  const [errorTitle, errorBody] = view.kind === 'error' ? firstSentence(view.message) : ['', null];
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <DetailTopBar title="Ocena saradnje" backLabel={backLabel} onBack={onBack} />
    <ScrollView contentContainerStyle={s.content}>
      {loading ? <StateView kind="loading" title="Učitavamo ocenu…" skeleton={{ count: 1, variant: 'person' }} />
        : view.kind === 'error' ? <StateView kind="error" title={errorTitle} body={errorBody ?? undefined}
          primary={{ label: retry.label, onPress: retry.onPress, disabled: retry.disabled }} />
        : view.kind === 'saved' ? <View style={s.saved}>
          {/* Settles in with one spring and a success haptic only right after saving; reopened later it is still. */}
          <SuccessMark fresh={view.fresh} size={64} />
          {/* A sentence-form event title ends with a stop, as "Prijava je poslata." and "Dogovor je sklopljen." do. */}
          <T accessibilityRole="header" variant="title" style={s.ink}>Ocena je sačuvana.</T>
          {person ? <View style={s.savedPerson}>{face(40)}<T variant="bodyStrong" style={[s.ink, s.grow]} numberOfLines={2}>{person.name}</T></View> : null}
          <View style={s.starRow} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {[1, 2, 3, 4, 5].map(value => <Star key={value} size={28} weight={value <= view.rating ? 'fill' : 'regular'}
              color={value <= view.rating ? sys.color.orange : sys.color.muted} />)}
          </View>
          <T variant="body" style={s.ink}>{`Tvoja ocena: ${view.rating} od 5`}</T>
          {view.tags.length ? <T variant="note" tone="muted">{reviewedTags(view.tags)}</T> : null}
          <T variant="meta" tone="muted">Ova ocena ulazi u reputaciju naloga. Sačuvana ocena se ne menja.</T>
        </View> : view.kind === 'eligible' ? <>
          {person ? <View accessible accessibilityLabel={[person.name, person.role, person.task].filter(Boolean).join(', ')} style={s.person}>
            {face(56)}
            <View style={s.personCopy}>
              <T accessible={false} variant="title" style={s.ink} numberOfLines={2}>{person.name}</T>
              {person.role ? <T variant="meta" tone="muted">{person.role}</T> : null}
              {person.task ? <T variant="meta" tone="muted" numberOfLines={2}>{person.task}</T> : null}
            </View>
          </View> : null}
          <T accessibilityRole="header" variant={person ? 'heading' : 'title'} style={s.ink}>Kako je prošla saradnja?</T>
          <View style={s.stars}>
            <View accessibilityRole="radiogroup" accessibilityLabel="Ocena od 1 do 5" style={s.starRow}>
              {/* A star takes its colour on the press, with no scale or bounce: the rating is a fact. */}
              {[1, 2, 3, 4, 5].map(value => <Press key={value} accessibilityRole="radio" accessibilityLabel={`Ocena ${value} od 5`}
                accessibilityHint={ratingLabels[value]}
                accessibilityState={{ checked: view.rating === value, disabled: !view.editable }} disabled={!view.editable} haptic="select" scaleTo={1} hitSlop={0}
                onPress={() => view.onRate(value)} style={[s.star, { width: star, height: star }]}>
                <Star size={40} weight={value <= view.rating ? 'fill' : 'regular'} color={value <= view.rating ? sys.color.orange : sys.color.muted} />
              </Press>)}
            </View>
            <T accessibilityLiveRegion="polite" variant="bodyStrong" tone={view.rating ? 'ink' : 'muted'}>{ratingLabels[view.rating]}</T>
          </View>
          <View style={s.section}>
            <T accessibilityRole="header" variant="heading" style={s.ink}>Šta je obeležilo saradnju?</T>
            <T variant="meta" tone="muted">{`Nije obavezno · najviše ${view.catalog.maxTags}`}</T>
            <View style={s.tags}>
              {view.catalog.tags.map(tag => {
                const selected = view.tags.includes(tag), capped = !selected && tagsFull, disabled = !view.editable || capped;
                return <Press key={tag} accessibilityRole="checkbox" accessibilityLabel={tagLabels[tag]}
                  accessibilityHint={capped ? fullHint(view.catalog.maxTags) : undefined}
                  accessibilityState={{ checked: selected, disabled }} disabled={disabled} haptic="select" hitSlop={0}
                  onPress={() => { if (!disabled) view.onToggleTag(tag); }} style={[s.tag, selected && s.tagSelected]}>
                  {selected ? <Check size={16} weight="bold" color={sys.color.green} /> : null}
                  <T variant="note" style={selected ? s.tagTextSelected : capped ? s.tagTextCapped : s.ink}>{tagLabels[tag]}</T>
                </Press>;
              })}
            </View>
            {tagsFull && view.editable ? <T variant="meta" tone="muted" accessibilityLiveRegion="polite">{fullHint(view.catalog.maxTags)}</T> : null}
          </View>
          {view.attempt ? <T variant="meta" tone="muted">Čuvamo tvoj prvobitni izbor dok proveravaš ishod slanja.</T> : null}
        </> : view.kind === 'unavailable' ? <StateView kind="empty" art="star" title="Ocena još nije dostupna" body="Oceni saradnju kad Dogovor bude završen."
          primary={{ label: backLabel, onPress: onBack }} /> : null}
    </ScrollView>
    {footer ? <View style={s.footer}>{footer}</View> : null}
  </SafeAreaView>;
}

/** Why the other tags stopped taking a press once the most are chosen. */
function fullHint(max: number): string {
  return `Najviše ${plural(max, 'oznaka', 'oznake', 'oznaka')}. Skini jednu da izabereš drugu.`;
}
/** "Ocenu trenutno nije moguće učitati. Proveri vezu." → the first sentence and the rest. */
function firstSentence(message: string): [string, string | null] {
  const match = /^(.+?[.!?])\s+(\S[\s\S]*)$/.exec(message.trim());
  return match ? [match[1], match[2]] : [message.trim(), null];
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  ink: { color: sys.color.ink }, grow: { flex: 1, minWidth: 0 },
  content: { paddingHorizontal: SIDE, paddingTop: sys.space.base, paddingBottom: sys.space.xxl, gap: sys.space.lg },
  person: { flexDirection: 'row', alignItems: 'center', gap: sys.space.base },
  personCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  stars: { gap: sys.space.sm, alignItems: 'center' },
  starRow: { flexDirection: 'row', justifyContent: 'center' },
  star: { alignItems: 'center', justifyContent: 'center' },
  section: { gap: sys.space.sm, paddingTop: sys.space.lg, borderTopWidth: 1, borderColor: sys.color.line },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm, paddingTop: sys.space.xs },
  tag: { minHeight: 48, paddingHorizontal: sys.space.base, flexDirection: 'row', alignItems: 'center', gap: sys.space.xs,
    borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface },
  tagSelected: { borderColor: sys.color.green, backgroundColor: sys.color.greenSoft },
  tagTextSelected: { color: sys.color.green, fontWeight: '700' }, tagTextCapped: { color: sys.color.muted },
  saved: { gap: sys.space.md, alignItems: 'flex-start', paddingTop: sys.space.sm },
  savedPerson: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, alignSelf: 'stretch' },
  notice: { ...inset, backgroundColor: sys.color.warnSoft },
  footer: { backgroundColor: sys.color.surface, paddingHorizontal: SIDE, paddingVertical: sys.space.md, borderTopWidth: 1, borderColor: sys.color.line, gap: sys.space.sm },
});
