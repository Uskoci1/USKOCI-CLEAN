import { useCallback } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Star } from 'phosphor-react-native';
import { accountReputationLabel, reviewsClientService } from '../../data/reviewsClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { v2 } from '../v2/tokens';

/** One account reputation in both intents; an unavailable read is not zero reviews. */
export function AccountReputation({ accountId }: { accountId: string }) {
  const load = useCallback(async () => {
    const result = await reviewsClientService.reputation(accountId);
    if (!result.ok) throw new Error('REPUTATION_NOT_AVAILABLE');
    return result.podatak;
  }, [accountId]);
  const reputation = useFocusedResource(load);
  return <View style={{ alignItems: 'center', gap: 8 }}>
    {reputation.loading ? <ActivityIndicator accessibilityLabel="Učitavanje reputacije" color={v2.color.teal} />
      : reputation.error ? <>
        <T style={{ ...v2.text.label, color: v2.color.muted }}>Ocene trenutno nisu dostupne.</T>
        <V2Action label="Osveži ocene" kind="quiet" onPress={() => { void reputation.refresh(); }} />
      </> : reputation.data ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {reputation.data.reviewCount > 0 ? <Star size={18} weight="fill" color={v2.color.orange} /> : null}
        <T style={{ ...v2.text.body, color: v2.color.ink }}>{accountReputationLabel(reputation.data)}</T>
      </View> : null}
  </View>;
}
