import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T } from '../../ui/Text';
import { palette, space } from '../../theme/tokens';

/** W06 — moje prijave. Još nije preneto. */
export default function MojePrijave() {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.ground }}>
      <View style={{ padding: space.base, gap: space.sm }}>
        <T variant="display">Prijave</T>
        <T variant="body" tone="muted">Ovaj ekran jos nije prenet.</T>
      </View>
    </SafeAreaView>
  );
}
