import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { BrandMark } from '../entry/BrandAssets';
import { authTheme as c } from './authTheme';
import { radius, type } from '../../theme/tokens';

/** V5 premium auth presentation; route supplies real owned Auth state. */
export function AuthIntro({ title, copy, eyebrow = 'JEDAN NALOG · OBE MOGUĆNOSTI', composition = 'hero' }: {
  title: string; copy: string; eyebrow?: string; composition?: 'hero' | 'stage';
}) {
  const stage = composition === 'stage';
  return <View>
    {stage ? <>
    <View style={styles.badge} accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={58} height={58}><Defs><LinearGradient id="auth-badge" x1="25%" y1="6.7%" x2="75%" y2="93.3%"><Stop offset="0" stopColor="#EDF6F1" /><Stop offset="1" stopColor="#E4F1E9" /></LinearGradient></Defs><Rect width={58} height={58} rx={radius.cardCompact} fill="url(#auth-badge)" stroke="#D4E6DC" /></Svg>
      <BrandMark size={35} />
    </View>
    </> : <View style={styles.identityRow}><BrandMark size={30} /><Text style={styles.inlineEyebrow}>{eyebrow}</Text></View>}
    <View style={stage ? styles.stage : styles.hero}>
      {stage ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text accessibilityRole="header" style={[styles.title, stage && styles.stageTitle]}>{title}</Text>
      <Text style={[styles.copy, stage && styles.stageCopy]}>{copy}</Text>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, minHeight: 36 },
  inlineEyebrow: { flex: 1, ...type.label, fontWeight: '600', letterSpacing: 0.4, color: c.accentLight },
  hero: { paddingTop: 4, paddingBottom: 20 },
  stage: { marginTop: 4, paddingTop: 2, paddingBottom: 4, marginBottom: 16 },
  stageTitle: { ...type.pageTitle, marginBottom: 10 },
  stageCopy: { ...type.copy, color: c.muted, marginBottom: 8 },
  badge: { width: 58, height: 58, borderRadius: radius.cardCompact, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  // 11px was under the 12px floor the scale sets for anything that carries meaning.
  eyebrow: { ...type.label, fontWeight: '600', letterSpacing: 0.4, color: c.accentLight, marginBottom: 8 },
  title: { ...type.hero, color: c.ink, marginBottom: 9 },
  copy: { ...type.copy, color: c.muted },
});

/** Forms stay open and readable against the sheet, including larger text. */
export const authStageForm = StyleSheet.create({
  form: { backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0,
    borderBottomWidth: 1, borderColor: '#345D50', paddingHorizontal: 0, paddingTop: 5,
    paddingBottom: 17, marginTop: 0, marginBottom: 17 },
}).form;
