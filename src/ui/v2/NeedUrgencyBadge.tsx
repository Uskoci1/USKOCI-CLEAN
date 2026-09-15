import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Lightning } from 'phosphor-react-native';
import type { NeedUrgencyProjection } from '../../contracts/projections';
import { displaysUrgent } from '../../lib/needUrgency';
import { T } from '../Text';
import { v2 } from './tokens';

export function useUrgencyClock(values: readonly (NeedUrgencyProjection | undefined)[]): number {
  const [now, setNow] = useState(Date.now);
  const deadlines = values.flatMap(value => value?.level === 'HITNO' ? [Date.parse(value.expiresAt)] : []);
  const next = Math.min(...deadlines.filter(time => time > now));
  useEffect(() => {
    if (!Number.isFinite(next)) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(2_147_483_647, Math.max(1, next - Date.now() + 1)));
    return () => clearTimeout(timer);
  }, [next, now]);
  return Math.max(now, Date.now());
}

export function NeedUrgencyBadge({ urgency }: { urgency?: NeedUrgencyProjection }) {
  const now = useUrgencyClock([urgency]);
  if (!displaysUrgent(urgency, now)) return null;
  return <View accessible accessibilityLabel="HITNO" style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4,
    borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: v2.color.warm }}>
    <Lightning size={14} weight="fill" color={v2.color.danger} />
    <T style={{ ...v2.text.label, fontWeight: '700', color: v2.color.danger }}>HITNO</T>
  </View>;
}
