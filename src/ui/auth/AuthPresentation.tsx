import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { BrandMark } from '../entry/BrandAssets';

/** Executable SPOJ V2, including final .lineage/.v2 overrides; route supplies real owned Auth state. */
export function AuthIntro({ title, copy, eyebrow = 'JEDAN NALOG · OBE MOGUĆNOSTI', composition = 'hero' }: {
  title: string; copy: string; eyebrow?: string; composition?: 'hero' | 'stage';
}) {
  const stage = composition === 'stage';
  return <View>
    <View style={styles.badge}>
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={58} height={58}><Defs><LinearGradient id="auth-badge" x1="25%" y1="6.7%" x2="75%" y2="93.3%"><Stop offset="0" stopColor="#EDF6F1" /><Stop offset="1" stopColor="#E4F1E9" /></LinearGradient></Defs><Rect width={58} height={58} rx={19} fill="url(#auth-badge)" stroke="#D4E6DC" /></Svg>
      <BrandMark size={35} />
    </View>
    <View style={stage ? styles.stage : styles.hero}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text accessibilityRole="header" style={[styles.title, stage && styles.stageTitle]}>{title}</Text>
      <Text style={[styles.copy, stage && styles.stageCopy]}>{copy}</Text>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  hero: { paddingTop: 8, paddingBottom: 16 },
  // .lineage .fp-stage is more specific than the later generic .v2 .fp-title.
  stage: { marginTop: 8, paddingTop: 2, paddingBottom: 4, marginBottom: 25 },
  stageTitle: { fontSize: 27, lineHeight: 30.51, letterSpacing: -.75, marginBottom: 10 },
  stageCopy: { color: '#63766F', fontSize: 14, lineHeight: 23.1, marginBottom: 20 },
  badge: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 21 },
  eyebrow: { color: '#2E7A6A', fontSize: 10, lineHeight: 15, fontWeight: '700', letterSpacing: 1, marginBottom: 7 },
  title: { color: '#143D35', fontSize: 31, lineHeight: 34.72, letterSpacing: -1, fontWeight: '700', marginBottom: 9 },
  copy: { color: '#5D7067', fontSize: 15, lineHeight: 22.5 },
});

/** Exact final .lineage .fp-panel.flat composition; fields keep their native controls. */
export const authStageForm = StyleSheet.create({
  form: { backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0,
    borderBottomWidth: 1, borderColor: '#DFE9E3', paddingHorizontal: 0, paddingTop: 5,
    paddingBottom: 17, marginTop: 0, marginBottom: 17 },
}).form;
