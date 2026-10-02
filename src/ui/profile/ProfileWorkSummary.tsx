import { useCallback } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { publicProfileClientService } from '../../data/publicProfileClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { T } from '../Text';
import { Press } from '../Press';
import { FactArt } from '../system/FactArt';
import { sys } from '../system/tokens';
import { useTextScale } from '../system/textScale';

type Role = 'narucilac' | 'uskocer';
type Fact = { role: Role; count: number | null };

/** Existing public projection counts COMPLETED Agreements per role, never tasks or payments.
 * Reads are independent of identity/reputation and fenced by useFocusedResource's account/revision/focus owner.
 */
export function ProfileWorkSummary({ requesterProfileId, workerProfileId }: {
  requesterProfileId: string | null; workerProfileId: string | null;
}) {
  const { width } = useWindowDimensions();
  const textScale = useTextScale();
  const stacked = width < 360 || textScale >= 1.3;
  const load = useCallback(async (signal: AbortSignal): Promise<Fact[]> => {
    const targets: { id: string; role: Role }[] = [];
    if (workerProfileId) targets.push({ id: workerProfileId, role: 'uskocer' });
    if (requesterProfileId && requesterProfileId !== workerProfileId) targets.push({ id: requesterProfileId, role: 'narucilac' });
    return Promise.all(targets.map(async ({ id, role }) => {
      try {
        const profile = await publicProfileClientService.javniProfil(id, signal);
        const count = profile?.poverenje?.zavrseniBroj;
        return { role, count: profile?.profilId === id && profile.uloga === role &&
          typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? count : null };
      } catch { return { role, count: null }; }
    }));
  }, [requesterProfileId, workerProfileId]);
  const resource = useFocusedResource(load);
  if (!requesterProfileId && !workerProfileId) return null;
  const unavailable = resource.error || resource.data?.some(fact => fact.count === null);
  return <View testID="profile-work-summary" style={s.section}>
    <View style={s.heading}>
      <FactArt kind="check" size={24} cut="art" />
      <T variant="bodyStrong" accessibilityRole="header" style={s.title}>Završeni Dogovori</T>
    </View>
    {resource.loading ? <T variant="note" tone="muted" accessibilityRole="progressbar"
      accessibilityLabel="Učitavanje završenih Dogovora">Učitavamo pregled…</T>
      : <View style={[s.facts, stacked && s.stacked]}>
        {resource.data?.map(fact => <View key={fact.role} style={[s.fact, stacked && s.factStacked]} accessible
          accessibilityLabel={`${fact.role === 'uskocer' ? 'Kad ti radiš' : 'Kad ti objavljuješ'}, završeni Dogovori: ${fact.count === null ? 'broj nije dostupan' : fact.count}`}>
          <T variant="note" tone="muted">{fact.role === 'uskocer' ? 'Kad ti radiš' : 'Kad ti objavljuješ'}</T>
          <T variant={fact.count === null ? 'note' : 'heading'} tone={fact.count === null ? 'muted' : 'ink'}>
            {fact.count === null ? 'Broj nije dostupan' : fact.count.toLocaleString('sr-Latn-RS')}
          </T>
        </View>)}
      </View>}
    {!resource.loading && unavailable ? <Press accessibilityRole="button" accessibilityLabel="Osveži pregled završenih Dogovora"
      onPress={() => { void resource.refresh(); }} haptic="select" style={s.retry}>
      <T variant="note" style={s.retryText}>Osveži pregled</T>
    </Press> : null}
  </View>;
}

const s = StyleSheet.create({
  section: { gap: 14, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: sys.color.line },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, color: sys.color.ink },
  facts: { flexDirection: 'row', gap: 20 },
  stacked: { flexDirection: 'column', gap: 12 },
  fact: { flexGrow: 1, flexBasis: 0, minWidth: 0, gap: 4 },
  factStacked: { flexGrow: 0, flexBasis: 'auto' },
  retry: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  retryText: { color: sys.color.ink, fontWeight: '600' },
});
