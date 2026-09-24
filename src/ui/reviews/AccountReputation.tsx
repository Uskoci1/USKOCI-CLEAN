import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { accountReputationLabel, reviewsClientService, type AccountReputation as Reputation } from '../../data/reviewsClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { Press } from '../Press';
import { T } from '../Text';
import { sys } from '../system/tokens';
import { FactArt } from '../system/FactArt';

/** Only a real aggregate is drawn: anything without a numeric count (a read that is not this one) draws nothing. */
const isReputation = (value: unknown): value is Reputation =>
  !!value && typeof value === 'object' && typeof (value as { reviewCount?: unknown }).reviewCount === 'number';

/** One account reputation in both intents; an unavailable read is not zero reviews. */
export function AccountReputation({ accountId }: { accountId: string }) {
  const load = useCallback(async () => {
    const result = await reviewsClientService.reputation(accountId);
    if (!result.ok) throw new Error('REPUTATION_NOT_AVAILABLE');
    return result.podatak;
  }, [accountId]);
  const reputation = useFocusedResource(load);
  return <ReputationLine state={reputation.loading ? 'loading' : reputation.error ? 'error' : reputation.data}
    onRetry={() => { void reputation.refresh(); }} />;
}

/**
 * The reputation as one line under the name in the profile's identity column (2026-09-24). While it reads: a still bar
 * where the line will be (no spinner, nothing moves). With reviews: the star and "4,8 · 12 ocena". With none: "Još nema
 * ocena" and no star. When the read fails: one 48 dp row that says so and offers "Osveži" in the same line, instead of a
 * full-width button under the name. Anything else draws nothing, never "undefined".
 */
export function ReputationLine({ state, onRetry }: { state: 'loading' | 'error' | unknown; onRetry: () => void }) {
  if (state === 'loading') return <View accessibilityRole="progressbar" accessibilityLabel="Učitavanje reputacije" style={s.bar} />;
  if (state === 'error') return <Press accessibilityRole="button" accessibilityLabel="Osveži ocene" accessibilityHint="Ocene trenutno nisu dostupne."
    haptic="select" scaleTo={0.99} onPress={onRetry} style={s.retry}>
    <T variant="note" tone="muted" style={s.shrink}>Ocene trenutno nisu dostupne.</T>
    <T variant="note" style={s.action}>Osveži</T>
  </Press>;
  if (!isReputation(state)) return null;
  if (state.reviewCount === 0) return <T variant="note" tone="muted">{accountReputationLabel(state)}</T>;
  return <View style={s.line}>
    <FactArt kind="star" size={18} />
    <T variant="note" style={s.value}>{accountReputationLabel(state)}</T>
  </View>;
}

const s = StyleSheet.create({
  bar: { width: 112, height: 16, borderRadius: sys.radius.control, backgroundColor: sys.color.skeleton, marginVertical: 2 },
  retry: { minHeight: 48, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8, alignSelf: 'flex-start' },
  shrink: { flexShrink: 1 },
  action: { color: sys.color.green, fontWeight: '600' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value: { color: sys.color.ink, fontWeight: '600' },
});
