import { useCallback } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { accountReputationLabel, reviewsClientService } from '../../data/reviewsClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { sys } from '../system/tokens';
import { FactArt } from '../system/FactArt';

/** One account reputation in both intents; an unavailable read is not zero reviews. */
export function AccountReputation({ accountId }: { accountId: string }) {
  const load = useCallback(async () => {
    const result = await reviewsClientService.reputation(accountId);
    if (!result.ok) throw new Error('REPUTATION_NOT_AVAILABLE');
    return result.podatak;
  }, [accountId]);
  const reputation = useFocusedResource(load);
  // Left-aligned under the V41 identity row of the profile (2026-09-23), with the star before the words.
  return <View style={{ alignItems: 'flex-start', gap: 8 }}>
    {reputation.loading ? <ActivityIndicator accessibilityLabel="Učitavanje reputacije" color={sys.color.green} />
      : reputation.error ? <>
        <T variant="meta" tone="muted">Ocene trenutno nisu dostupne.</T>
        <V2Action label="Osveži ocene" kind="quiet" onPress={() => { void reputation.refresh(); }} />
      </> : reputation.data ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {reputation.data.reviewCount > 0 ? <FactArt kind="star" size={20} /> : null}
        <T variant="bodyStrong" style={{ color: sys.color.ink }}>{accountReputationLabel(reputation.data)}</T>
      </View> : null}
  </View>;
}
