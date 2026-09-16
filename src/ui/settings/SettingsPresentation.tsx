import type { ComponentProps, ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CaretRight } from 'phosphor-react-native';
import { Press } from '../Press';
import { brandAction, sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';

/**
 * Shared settings system (PKG-011): every profile/account/support/legal surface is
 * built from these pieces, so restyling them here moves the whole family at once.
 * Exports, props and spoken labels are unchanged; native text stays scalable and
 * no row has a fixed height. Colors: ground, white lists, green orientation,
 * one orange brand action per screen.
 */
export function SettingsText({ variant = 'body', tone = 'ink', style, ...props }: ComponentProps<typeof T>) {
  const type = variant === 'display' ? styles.hero : variant === 'title' ? styles.title
    : variant === 'heading' ? styles.heading : variant === 'label' ? styles.label
      : variant === 'meta' ? styles.meta : variant === 'bodyStrong' ? styles.strong : styles.body;
  return <T {...props} variant={variant} tone={tone} style={[type,
    { color: tone === 'muted' ? sys.color.muted : tone === 'danger' ? sys.color.danger : tone === 'success' ? sys.color.green : sys.color.ink }, style]} />;
}

export function SettingsScreen({ title, onBack, disabled = false, children, footer }: {
  title: string; onBack: () => void; disabled?: boolean; children: ReactNode; footer?: ReactNode;
}) {
  return <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
    <View style={styles.header}>
      <Press accessibilityRole="button" accessibilityLabel="Nazad" disabled={disabled} accessibilityState={{ disabled }}
        onPress={onBack} haptic="select" style={styles.back}><ArrowLeft size={22} color={sys.color.ink} /></Press>
      <SettingsText variant="title" accessibilityRole="header" style={{ flex: 1 }}>{title}</SettingsText>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>{children}</ScrollView>
    {footer ? <View testID="settings-primary-footer" style={styles.footer}>{footer}</View> : null}
  </SafeAreaView>;
}

export function SettingsIntro({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return <View style={styles.intro}>
    <SettingsText variant="meta" style={styles.kicker}>{kicker}</SettingsText>
    <SettingsText variant="display" accessibilityRole="header">{title}</SettingsText>
    <SettingsText variant="body" tone="muted" style={styles.lead}>{children}</SettingsText>
  </View>;
}

export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.group}>
    <SettingsText variant="meta" accessibilityRole="header" style={styles.groupTitle}>{title}</SettingsText>
    <View style={styles.list}>{children}</View>
  </View>;
}

export function SettingsRow({ label, detail, icon, onPress, disabled = false, last = false }: {
  label: string; detail?: string; icon?: ReactNode; onPress: () => void; disabled?: boolean; last?: boolean;
}) {
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint={detail} disabled={disabled}
    accessibilityState={{ disabled }} onPress={onPress} haptic={disabled ? 'none' : 'select'} scaleTo={0.99}
    style={[styles.row, last && styles.last, disabled && styles.disabled]}>
    {icon ? <View style={styles.rowIcon}>{icon}</View> : null}<View style={styles.rowCopy}><SettingsText variant="bodyStrong" style={styles.rowTitle}>{label}</SettingsText>
      {detail ? <SettingsText variant="meta" tone="muted">{detail}</SettingsText> : null}</View>
    <CaretRight size={18} color={sys.color.muted} />
  </Press>;
}

export function SettingsPanel({ children, soft = false, style }: { children: ReactNode; soft?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[soft ? styles.soft : styles.flat, style]}>{children}</View>;
}

export function SettingsInfo({ title, children, icon, last = false }: { title: string; children: ReactNode; icon?: ReactNode; last?: boolean }) {
  return <View style={[styles.info, last && styles.last]}>{icon ? <View style={styles.rowIcon}>{icon}</View> : null}<View style={styles.rowCopy}>
    <SettingsText variant="bodyStrong">{title}</SettingsText><SettingsText variant="meta" tone="muted">{children}</SettingsText>
  </View></View>;
}

/** `primary` is the screen's one brand action (orange surface, ink text); other kinds map onto V2Action. */
export function SettingsAction({ label, onPress, disabled = false, kind = 'primary', icon }: {
  label: string; onPress: () => void; disabled?: boolean; kind?: 'primary' | 'secondary' | 'quiet' | 'destructive'; icon?: ReactNode;
}) {
  if (kind !== 'primary') return <V2Action label={label} onPress={onPress} disabled={disabled} kind={kind} icon={icon} />;
  return <V2Action label={label} onPress={onPress} disabled={disabled} icon={icon} style={brandAction} />;
}

export const settingsStyles = StyleSheet.create({
  identity: { padding: 20, backgroundColor: sys.color.surface, borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.line, alignItems: 'center', gap: 6, marginBottom: 16 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  intent: { backgroundColor: sys.color.greenSoft, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, marginTop: 6 },
  logout: { paddingTop: 18, borderTopWidth: 1, borderTopColor: sys.color.line, marginTop: 6, marginBottom: 12, alignItems: 'flex-start' },
  notice: { padding: 14, borderRadius: sys.radius.control, backgroundColor: sys.color.greenSoft, flexDirection: 'row', gap: 10 },
  gap: { gap: 12 },
  step: { padding: 12, gap: 4, borderRadius: sys.radius.control },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  header: { minHeight: 60, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', gap: 10, alignItems: 'center' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28, flexGrow: 1 },
  footer: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14, borderTopWidth: 1, borderTopColor: sys.color.line, backgroundColor: sys.color.surface, gap: 8 },
  body: { ...sys.type.body },
  strong: { ...sys.type.bodyStrong },
  meta: { ...sys.type.meta, fontWeight: '500' },
  label: { ...sys.type.label },
  title: { ...sys.type.title },
  heading: { ...sys.type.heading },
  hero: { ...sys.type.display, fontSize: 26, lineHeight: 31 },
  intro: { paddingTop: 4, marginBottom: 16, gap: 6 },
  kicker: { color: sys.color.green, fontWeight: '600' },
  lead: { marginTop: 2 },
  group: { marginBottom: 16, gap: 8 },
  groupTitle: { color: sys.color.muted, fontWeight: '600', paddingHorizontal: 2 },
  list: { backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.line, borderRadius: sys.radius.card, paddingHorizontal: 16 },
  row: { minHeight: 60, paddingVertical: 12, flexDirection: 'row', gap: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: sys.color.line },
  rowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { color: sys.color.ink },
  flat: { backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.line, borderRadius: sys.radius.card, padding: 16, marginBottom: 14, gap: 12 },
  soft: { backgroundColor: sys.color.greenSoft, borderRadius: sys.radius.card, padding: 16, marginTop: 12, marginBottom: 12, gap: 12 },
  info: { paddingVertical: 12, flexDirection: 'row', gap: 12, borderBottomWidth: 1, borderBottomColor: sys.color.line },
  last: { borderBottomWidth: 0 },
  disabled: { opacity: .45 },
});
