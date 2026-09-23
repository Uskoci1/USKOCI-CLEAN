import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Star } from 'phosphor-react-native';
import { reviewsClientService, type ReviewCommand, type ReviewTag } from '../../data/reviewsClientService';
import { failure } from '../../data/serverReceipt';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { Press } from '../Press';
import { DetailTopBar } from '../system/DetailTopBar';
import { SuccessMark } from '../system/SuccessMark';
import { SkeletonList } from '../system/Skeleton';
import { brandAction, sys, card } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';

const tagLabels: Record<ReviewTag, string> = {
  AS_AGREED: 'Po dogovoru', CAREFUL: 'Pažljivo', CLEAR_COMMUNICATION: 'Jasna komunikacija',
  ON_TIME: 'Na vreme', RELIABLE: 'Pouzdano', RESPECTFUL: 'Uz poštovanje',
};
const ratingLabels = ['Izaberi ocenu', 'Loše', 'Ispod očekivanja', 'Dobro', 'Vrlo dobro', 'Odlično'];
export function backFromReview() { if (router.canGoBack()) router.back(); else router.replace('/dogovori'); }

/** One rating, up to N tags, one save. The saved receipt is final and shown as such. */
export function AgreementReviewScreen({ agreementId, accountId, accountRevision }: {
  agreementId: string; accountId: string; accountRevision: number;
}) {
  const read = useCallback(() => reviewsClientService.context(agreementId, { accountId, accountRevision }),
    [agreementId, accountId, accountRevision]);
  const workspace = useOwnedEditor(read);
  const [rating, setRating] = useState(0), [tags, setTags] = useState<ReviewTag[]>([]);
  const [attempt, setAttempt] = useState<ReviewCommand | null>(null);
  const attemptRef = useRef<ReviewCommand | null>(null);
  const activeRef = useRef(true);
  const [foreground, setForeground] = useState(true), [resumeRequired, setResumeRequired] = useState(false);
  // A mount effect, not a focus effect. On 2026-09-23 every star and tag on this screen was dead on two phones
  // and the emulator while the back arrow in the same top bar worked; the one difference was a guard that
  // compared a focus token minted inside `useFocusEffect` with the token the render had captured, and on the
  // device the two never met: the emulator probe of 2026-09-23 (build 4e864a08) showed the focus effect ran once with
  // AppState active, so the token was minted after the render that drew the stars, and nothing re-rendered after it. Which screen is current is
  // already owned by `useOwnedEditor` (its data is null while this screen is blurred, so nothing is editable
  // then, and a stale save is refused by its scope); the app's foreground state belongs to a mount effect.
  useEffect(() => {
    activeRef.current = true;
    const subscription = AppState.addEventListener('change', state => {
      activeRef.current = state === 'active'; setForeground(activeRef.current); setResumeRequired(true);
    });
    return () => { subscription.remove(); activeRef.current = false; };
  }, []);
  useEffect(() => {
    if (!foreground || !resumeRequired || workspace.busy) return;
    let current = true;
    void workspace.refresh().then(() => { if (current && activeRef.current) setResumeRequired(false); });
    return () => { current = false; };
  }, [foreground, resumeRequired, workspace.busy, workspace.refresh]);
  const context = workspace.data, receipt = context?.review;
  const enabled = foreground && !resumeRequired && !workspace.loading && !workspace.busy && !workspace.error && !workspace.uncertain;
  const current = () => activeRef.current;
  const editable = enabled && context?.eligible === true && !attempt;
  const submit = () => {
    if (!enabled || !current() || !context?.eligible || rating < 1) return;
    void workspace.save(async () => {
      const command = attemptRef.current ?? { agreementId, targetAccountId: context.targetAccountId,
        rating, tags: [...tags].sort(), clientRequestId: noviUuidZahtevId() };
      attemptRef.current = command; setAttempt(command);
      const result = await reviewsClientService.submit(command, { accountId, accountRevision });
      if (!result.ok) return result;
      const checked = await read();
      if (!checked.ok) return checked;
      if (checked.podatak.review?.reviewId !== result.podatak.reviewId) {
        return failure('REVIEW_READBACK_REQUIRED', 'Potvrda ocene nije učitana. Proveri sačuvanu ocenu.');
      }
      return checked;
    });
  };
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <DetailTopBar eyebrow="Dogovor" title="Ocena saradnje" onBack={backFromReview} />
    <ScrollView contentContainerStyle={s.content}>
      {workspace.loading || !foreground || resumeRequired ? <View accessible accessibilityLabel="Učitavanje ocene"><SkeletonList count={1} rows={3} /></View>
        : receipt ? <View style={s.card}>
          {/* Settles in with one spring and a success haptic only right after saving; reopened later it is still. */}
          <SuccessMark fresh={workspace.saved} tone="orange"><Star size={32} weight="fill" color={sys.color.orange} /></SuccessMark>
          <T accessibilityRole="header" variant="title" style={s.ink}>Ocena je sačuvana</T>
          <T variant="body" style={s.ink}>Tvoja ocena: {receipt.rating} od 5</T>
          {receipt.tags.length ? <View style={s.tags}>{receipt.tags.map(tag => <View key={tag} style={[s.tag, s.tagSelected]}><T variant="meta" style={s.tagTextSelected}>{tagLabels[tag]}</T></View>)}</View> : null}
          <T variant="meta" tone="muted">Ova ocena ulazi u reputaciju naloga. Sačuvana ocena se ne menja.</T>
          <V2Action label="Nazad na Dogovor" onPress={backFromReview} style={brandAction} />
        </View> : context?.eligible ? <>
          <View style={s.intro}>
            <T accessibilityRole="header" variant="display" style={s.ink}>Kako je prošla saradnja?</T>
            <T variant="body" tone="muted">Oceni drugu stranu završenog Dogovora.</T>
          </View>
          <View style={s.card}>
            <View style={s.stars}>
              <View accessibilityRole="radiogroup" accessibilityLabel="Ocena od 1 do 5" style={s.starRow}>
                {[1, 2, 3, 4, 5].map(value => <Press key={value} accessibilityRole="radio" accessibilityLabel={`Ocena ${value} od 5`}
                  accessibilityState={{ checked: rating === value, disabled: !editable }} disabled={!editable} haptic="select"
                  onPress={() => { if (editable && current() && !attemptRef.current) setRating(value); }} style={s.star}>
                  <Star size={38} weight={value <= rating ? 'fill' : 'regular'} color={value <= rating ? sys.color.orange : sys.color.lineStrong} />
                </Press>)}
              </View>
              <T accessibilityLiveRegion="polite" variant="bodyStrong" style={s.ink}>{ratingLabels[rating]}</T>
            </View>
            <View style={s.divider} />
            <T variant="bodyStrong" style={s.ink}>Šta je obeležilo saradnju?</T>
            <T variant="meta" tone="muted">Opciono · najviše {context.tagCatalog.maxTags} oznake</T>
            <View style={s.tags}>
              {context.tagCatalog.tags.map(tag => {
                const selected = tags.includes(tag), disabled = !editable || (!selected && tags.length >= context.tagCatalog.maxTags);
                return <Press key={tag} accessibilityRole="checkbox" accessibilityLabel={tagLabels[tag]}
                  accessibilityState={{ checked: selected, disabled }} disabled={disabled} haptic="select"
                  onPress={() => { if (!disabled && current() && !attemptRef.current) setTags(values => values.includes(tag)
                    ? values.filter(value => value !== tag) : values.length < context.tagCatalog.maxTags ? [...values, tag] : values); }}
                  style={[s.tag, selected && s.tagSelected, disabled && !selected && s.tagDisabled]}>
                  <T variant="meta" style={selected ? s.tagTextSelected : s.tagText}>{tagLabels[tag]}</T>
                </Press>;
              })}
            </View>
          </View>
          {attempt ? <T variant="meta" tone="muted">Čuvamo tvoj prvobitni izbor dok proveravaš ishod slanja.</T> : null}
          <View style={s.grow} />
          <V2Action label={workspace.busy ? 'Čuvamo ocenu…' : attempt ? 'Ponovi istu ocenu' : 'Sačuvaj ocenu'}
            disabled={!enabled || rating < 1} onPress={submit} style={brandAction} />
          {/* A grey button with nothing saying why is a dead end. It waits on one thing. */}
          {enabled && rating < 1 ? <T variant="meta" tone="muted" style={{ textAlign: 'center' }}>Izaberi ocenu od 1 do 5 pre slanja.</T> : null}
        </> : context ? <View style={s.card}>
          <T accessibilityRole="header" variant="title" style={s.ink}>Ocena još nije dostupna</T>
          <T variant="body" tone="muted">Možeš oceniti drugu stranu kada Dogovor bude završen.</T>
          <V2Action label="Nazad na Dogovor" onPress={backFromReview} />
        </View> : null}
      {workspace.error ? <View style={s.errorBlock}>
        <T accessibilityRole="alert" variant="body" style={s.danger}>{workspace.error}</T>
        <V2Action label={attempt ? 'Proveri sačuvanu ocenu' : 'Ponovo učitaj ocenu'} disabled={workspace.busy || !foreground}
          onPress={() => { if (current()) void workspace.refresh(); }} />
      </View> : null}
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  ink: { color: sys.color.ink }, danger: { color: sys.color.danger }, grow: { flex: 1 },
  content: { padding: 20, gap: 16, flexGrow: 1 },
  intro: { gap: 8, paddingHorizontal: 2 },
  card: { ...card, gap: 12 },
  stars: { gap: 10, alignItems: 'center', paddingVertical: 6 },
  starRow: { flexDirection: 'row', gap: 6 },
  star: { width: 48, height: 52, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, backgroundColor: sys.color.line, marginVertical: 4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 11, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface },
  tagSelected: { borderColor: sys.color.green, backgroundColor: sys.color.greenSoft }, tagDisabled: { opacity: 0.5 },
  tagText: { color: sys.color.ink }, tagTextSelected: { color: sys.color.green, fontWeight: '700' },
  errorBlock: { gap: 12 },
});
