import type { ComponentProps, ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CaretRight } from 'phosphor-react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { v2 } from '../v2/tokens';

// Executable SPOJ V2: final lineage fp-stage/flat rules and S07 settings groups.
// Native text remains scalable; no fixed-height rows or synthetic account actions.
export function SettingsText({ variant = 'body', tone = 'ink', style, ...props }: ComponentProps<typeof T>) {
  const type = variant === 'display' ? styles.hero : variant === 'title' ? styles.title
    : variant === 'heading' ? styles.heading : variant === 'label' ? styles.label
      : variant === 'meta' ? styles.meta : variant === 'bodyStrong' ? styles.strong : styles.body;
  return <T {...props} variant={variant} tone={tone} style={[type,
    { color: tone === 'muted' ? v2.color.muted : tone === 'danger' ? v2.color.danger : v2.color.ink }, style]} />;
}

export function SettingsScreen({ title, onBack, disabled = false, children, footer }: {
  title: string; onBack: () => void; disabled?: boolean; children: ReactNode; footer?: ReactNode;
}) {
  return <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
    <View style={styles.header}>
      <Press accessibilityRole="button" accessibilityLabel="Nazad" disabled={disabled} accessibilityState={{ disabled }}
        onPress={onBack} haptic="select" style={styles.back}><ArrowLeft size={22} color={v2.color.ink} /></Press>
      <SettingsText variant="title" accessibilityRole="header" style={{ flex: 1 }}>{title}</SettingsText>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>{children}</ScrollView>
    {footer ? <View testID="settings-primary-footer" style={styles.footer}>{footer}</View> : null}
  </SafeAreaView>;
}

export function SettingsIntro({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return <View style={styles.intro}>
    <SettingsText variant="label" style={styles.kicker}>{kicker}</SettingsText>
    <SettingsText variant="display" accessibilityRole="header">{title}</SettingsText>
    <SettingsText style={styles.lead}>{children}</SettingsText>
  </View>;
}

export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.group}>
    <SettingsText variant="label" accessibilityRole="header" style={styles.groupTitle}>{title}</SettingsText>
    <View style={styles.list}>{children}</View>
  </View>;
}

export function SettingsRow({ label, detail, icon, onPress, disabled = false, last = false }: {
  label: string; detail?: string; icon?: ReactNode; onPress: () => void; disabled?: boolean; last?: boolean;
}) {
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint={detail} disabled={disabled}
    accessibilityState={{ disabled }} onPress={onPress} haptic={disabled ? 'none' : 'select'}
    style={[styles.row, last && styles.last, disabled && styles.disabled]}>
    {icon}<View style={styles.rowCopy}><SettingsText style={styles.rowTitle}>{label}</SettingsText>
      {detail ? <SettingsText variant="meta" tone="muted" style={styles.rowDetail}>{detail}</SettingsText> : null}</View>
    <CaretRight size={18} color={v2.color.teal} />
  </Press>;
}

export function SettingsPanel({ children, soft = false, style }: { children: ReactNode; soft?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[soft ? styles.soft : styles.flat, style]}>{children}</View>;
}

export function SettingsInfo({ title, children, icon, last = false }: { title: string; children: ReactNode; icon?: ReactNode; last?: boolean }) {
  return <View style={[styles.info, last && styles.last]}>{icon}<View style={styles.rowCopy}>
    <SettingsText variant="bodyStrong">{title}</SettingsText><SettingsText variant="meta" tone="muted">{children}</SettingsText>
  </View></View>;
}

export function SettingsAction({ label, onPress, disabled = false, kind = 'primary', icon }: {
  label: string; onPress: () => void; disabled?: boolean; kind?: 'primary' | 'secondary' | 'quiet' | 'destructive'; icon?: ReactNode;
}) {
  if (kind !== 'primary') return <V2Action label={label} onPress={onPress} disabled={disabled} kind={kind} icon={icon} />;
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} haptic={disabled ? 'none' : 'light'} style={[styles.primary, disabled && styles.disabled]}>
    {icon}<SettingsText variant="bodyStrong" style={{ textAlign: 'center', flexShrink: 1 }}>{label}</SettingsText>
  </Press>;
}

export const settingsStyles = StyleSheet.create({
  identity: { padding: 20, backgroundColor: v2.color.context, borderRadius: 24, alignItems: 'center', gap: 6, marginBottom: 20 },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: v2.color.soft, borderWidth: 3,
    borderColor: v2.color.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  intent: { backgroundColor: v2.color.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, marginTop: 7 },
  logout: { paddingTop: 18, borderTopWidth: 1, borderTopColor: '#E4C8C3', marginTop: 6, marginBottom: 12 },
  notice: { padding: 14, borderRadius: 16, backgroundColor: v2.color.context, flexDirection: 'row', gap: 10 },
  gap: { gap: 12 },
  step: { padding: 12, gap: 4, borderRadius: 14 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: v2.color.canvas },
  header: { minHeight: 64, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: v2.color.header },
  back: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28, flexGrow: 1 },
  footer: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14, borderTopWidth: 1, borderTopColor: v2.color.line, backgroundColor: v2.color.surface, gap: 10 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  strong: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
  meta: { fontSize: 13, lineHeight: 19, fontWeight: '400' },
  label: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -.3 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -.35 },
  hero: { fontSize: 27, lineHeight: 30.51, fontWeight: '700', letterSpacing: -.75 },
  intro: { paddingTop: 2, paddingBottom: 4, marginTop: 8, marginBottom: 25 },
  kicker: { color: v2.color.teal, letterSpacing: 1, marginBottom: 7 },
  lead: { color: '#63766F', fontSize: 14, lineHeight: 23.1, marginTop: 10, marginBottom: 20 },
  group: { marginBottom: 18 },
  groupTitle: { color: '#61776D', textTransform: 'uppercase', letterSpacing: .9, marginBottom: 7 },
  list: { backgroundColor: v2.color.surface, borderWidth: 1, borderColor: '#DCE6E0', borderRadius: 20, paddingHorizontal: 16 },
  row: { minHeight: 64, paddingVertical: 13, flexDirection: 'row', gap: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: v2.color.line },
  rowCopy: { flex: 1, gap: 3, minWidth: 0 },
  rowTitle: { fontSize: 15, lineHeight: 21 },
  rowDetail: { fontSize: 13, lineHeight: 18 },
  flat: { paddingTop: 5, paddingBottom: 17, marginBottom: 17, borderBottomWidth: 1, borderBottomColor: v2.color.line, gap: 12 },
  soft: { backgroundColor: '#EFF6F1', borderRadius: 18, padding: 16, marginTop: 12, marginBottom: 12, gap: 12 },
  info: { paddingVertical: 13, flexDirection: 'row', gap: 12, borderBottomWidth: 1, borderBottomColor: '#E7EEEA' },
  last: { borderBottomWidth: 0 },
  primary: { minHeight: 52, paddingHorizontal: 18, paddingVertical: 14, backgroundColor: v2.color.orange, borderRadius: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  disabled: { opacity: .45 },
});
