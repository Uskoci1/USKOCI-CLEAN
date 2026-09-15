import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Star } from 'phosphor-react-native';
import { reviewsClientService, type ReviewCommand, type ReviewTag } from '../../data/reviewsClientService';
import { failure } from '../../data/serverReceipt';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { Press } from '../Press';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { V2Icon } from '../v2/icons';
import { v2 } from '../v2/tokens';

const tagLabels: Record<ReviewTag, string> = {
  AS_AGREED: 'Po dogovoru', CAREFUL: 'Pažljivo', CLEAR_COMMUNICATION: 'Jasna komunikacija',
  ON_TIME: 'Na vreme', RELIABLE: 'Pouzdano', RESPECTFUL: 'Uz poštovanje',
};
const ratingLabels = ['Izaberite ocenu', 'Loše', 'Ispod očekivanja', 'Dobro', 'Vrlo dobro', 'Odlično'];
const body = { ...v2.text.body, color: v2.color.ink };
const meta = { ...v2.text.label, color: v2.color.muted };
export function backFromReview() { if (router.canGoBack()) router.back(); else router.replace('/dogovori'); }

export function AgreementReviewScreen({ agreementId, accountId, accountRevision }: {
  agreementId: string; accountId: string; accountRevision: number;
}) {
  const read = useCallback(() => reviewsClientService.context(agreementId, { accountId, accountRevision }),
    [agreementId, accountId, accountRevision]);
  const workspace = useOwnedEditor(read);
  const [rating, setRating] = useState(0), [tags, setTags] = useState<ReviewTag[]>([]);
  const [attempt, setAttempt] = useState<ReviewCommand | null>(null);
  const attemptRef = useRef<ReviewCommand | null>(null);
  const activeRef = useRef(false), focusRef = useRef<object | null>(null);
  const [foreground, setForeground] = useState(true), [resumeRequired, setResumeRequired] = useState(false);
  const renderedFocus = focusRef.current;
  useFocusEffect(useCallback(() => {
    const focus = {}; focusRef.current = focus;
    activeRef.current = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    setForeground(activeRef.current);
    const subscription = AppState.addEventListener('change', state => {
      activeRef.current = state === 'active'; setForeground(activeRef.current); setResumeRequired(true);
    });
    return () => { subscription.remove(); activeRef.current = false; focusRef.current = null; };
  }, []));
  useEffect(() => {
    if (!foreground || !resumeRequired || workspace.busy) return;
    let current = true;
    void workspace.refresh().then(() => { if (current && activeRef.current) setResumeRequired(false); });
    return () => { current = false; };
  }, [foreground, resumeRequired, workspace.busy, workspace.refresh]);
  const context = workspace.data, receipt = context?.review;
  const enabled = foreground && !resumeRequired && !workspace.loading && !workspace.busy && !workspace.error && !workspace.uncertain;
  const current = () => activeRef.current && focusRef.current !== null && focusRef.current === renderedFocus;
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
        return failure('REVIEW_READBACK_REQUIRED', 'Potvrda ocene nije učitana. Proverite sačuvanu ocenu.');
      }
      return checked;
    });
  };
  return <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: v2.color.canvas }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }}>
      <Press accessibilityRole="button" accessibilityLabel="Nazad" onPress={backFromReview}
        style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}><V2Icon name="back" /></Press>
      <T accessibilityRole="header" style={{ ...v2.text.title, color: v2.color.ink }}>Ocena saradnje</T>
    </View>
    <ScrollView contentContainerStyle={{ padding: 24, gap: 24, flexGrow: 1 }}>
      {workspace.loading || !foreground || resumeRequired ? <ActivityIndicator accessibilityLabel="Učitavanje ocene" color={v2.color.teal} />
        : receipt ? <View style={{ gap: 20 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: v2.color.warm, alignItems: 'center', justifyContent: 'center' }}>
            <Star size={32} weight="fill" color={v2.color.orange} />
          </View>
          <T accessibilityRole="header" style={{ ...v2.text.hero, color: v2.color.ink }}>Ocena je sačuvana</T>
          <T style={body}>Vaša ocena: {receipt.rating} od 5</T>
          {receipt.tags.length ? <T style={body}>{receipt.tags.map(tag => tagLabels[tag]).join(' · ')}</T> : null}
          <T style={meta}>Ova ocena ulazi u reputaciju naloga. Sačuvana ocena se ne menja.</T>
          <V2Action label="Nazad na Dogovor" kind="primary" onPress={backFromReview} />
        </View> : context?.eligible ? <>
          <View style={{ gap: 12 }}>
            <T accessibilityRole="header" style={{ ...v2.text.hero, color: v2.color.ink }}>Kako je prošla saradnja?</T>
            <T style={body}>Ocenite drugu stranu završenog Dogovora.</T>
          </View>
          <View style={{ gap: 12, alignItems: 'center', paddingVertical: 12 }}>
            <View accessibilityRole="radiogroup" accessibilityLabel="Ocena od 1 do 5" style={{ flexDirection: 'row', gap: 8 }}>
              {[1, 2, 3, 4, 5].map(value => <Press key={value} accessibilityRole="radio" accessibilityLabel={`Ocena ${value} od 5`}
                accessibilityState={{ checked: rating === value, disabled: !editable }} disabled={!editable} haptic="select"
                onPress={() => { if (editable && current() && !attemptRef.current) setRating(value); }}
                style={{ width: 44, height: 52, alignItems: 'center', justifyContent: 'center' }}>
                <Star size={36} weight={value <= rating ? 'fill' : 'regular'} color={value <= rating ? v2.color.orange : v2.color.controlLine} />
              </Press>)}
            </View>
            <T accessibilityLiveRegion="polite" style={{ ...body, fontWeight: '700' }}>{ratingLabels[rating]}</T>
          </View>
          <View style={{ gap: 12 }}>
            <T style={{ ...body, fontWeight: '700' }}>Šta je obeležilo saradnju?</T>
            <T style={meta}>Opciono · najviše {context.tagCatalog.maxTags} oznake</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {context.tagCatalog.tags.map(tag => {
                const selected = tags.includes(tag), disabled = !editable || (!selected && tags.length >= context.tagCatalog.maxTags);
                return <Press key={tag} accessibilityRole="checkbox" accessibilityLabel={tagLabels[tag]}
                  accessibilityState={{ checked: selected, disabled }} disabled={disabled} haptic="select"
                  onPress={() => { if (!disabled && current() && !attemptRef.current) setTags(values => values.includes(tag)
                    ? values.filter(value => value !== tag) : values.length < context.tagCatalog.maxTags ? [...values, tag] : values); }}
                  style={{ minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 22, borderWidth: 1,
                    borderColor: selected ? v2.color.teal : v2.color.line, backgroundColor: selected ? v2.color.soft : v2.color.surface, opacity: disabled && !selected ? 0.5 : 1 }}>
                  <T style={{ ...meta, color: selected ? v2.color.teal : v2.color.ink, fontWeight: selected ? '700' : '400' }}>{tagLabels[tag]}</T>
                </Press>;
              })}
            </View>
          </View>
          {attempt ? <T style={meta}>Čuvamo vaš prvobitni izbor dok proveravate ishod slanja.</T> : null}
          <View style={{ flex: 1 }} />
          <V2Action label={workspace.busy ? 'Čuvamo ocenu…' : attempt ? 'Ponovi istu ocenu' : 'Sačuvaj ocenu'} kind="primary"
            disabled={!enabled || rating < 1} onPress={submit} style={{ backgroundColor: v2.color.orange }} />
        </> : context ? <View style={{ gap: 12 }}>
          <T style={{ ...v2.text.title, color: v2.color.ink }}>Ocena još nije dostupna</T>
          <T style={body}>Možete oceniti drugu stranu kada Dogovor bude završen.</T>
          <V2Action label="Nazad na Dogovor" onPress={backFromReview} />
        </View> : null}
      {workspace.error ? <View style={{ gap: 12 }}>
        <T accessibilityRole="alert" style={{ ...body, color: v2.color.danger }}>{workspace.error}</T>
        <V2Action label={attempt ? 'Proveri sačuvanu ocenu' : 'Ponovo učitaj ocenu'} disabled={workspace.busy || !foreground}
          onPress={() => { if (current()) void workspace.refresh(); }} />
      </View> : null}
    </ScrollView>
  </SafeAreaView>;
}
