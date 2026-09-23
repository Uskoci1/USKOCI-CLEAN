import type { ComponentProps, ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretRight } from 'phosphor-react-native';
import { Press } from '../Press';
import { ProductHeader } from '../product/ProductDetails';
import { brandAction, card, iconButton, sys } from '../system/tokens';
import { nested } from '../../theme/tokens';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';

/**
 * Shared settings system: every profile/account/support/legal surface is built
 * from these pieces, so restyling them here moves the whole family at once.
 * Exports, props and spoken labels are unchanged; native text stays scalable and
 * no row has a fixed height. White screen, one card per group, rows with a 40px
 * icon disc, a 16/600 label and a 14px detail; one orange brand action per screen.
 */
export function SettingsText({ variant = 'body', tone = 'ink', style, ...props }: ComponentProps<typeof T>) {
  const type = variant === 'display' ? styles.hero : variant === 'title' ? styles.title
    : variant === 'heading' ? styles.heading : variant === 'label' ? styles.label
      : variant === 'meta' ? styles.meta : variant === 'bodyStrong' ? styles.strong : variant === 'note' || variant === 'copy' ? sys.type[variant] : styles.body;
  return <T {...props} variant={variant} tone={tone} style={[type,
    { color: tone === 'muted' ? sys.color.muted : tone === 'danger' ? sys.color.danger : tone === 'success' ? sys.color.green : sys.color.ink }, style]} />;
}

export function SettingsScreen({ title, onBack, disabled = false, children, footer }: {
  /** `eyebrow` is kept for callers and not drawn: the bar names the screen, nothing explains where you are. */
  title: string; eyebrow?: string; onBack: () => void; disabled?: boolean; children: ReactNode; footer?: ReactNode;
}) {
  return <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
    <ProductHeader title={title} back={onBack} disabled={disabled} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>{children}</ScrollView>
    {footer ? <View testID="settings-primary-footer" style={styles.footer}>{footer}</View> : null}
  </SafeAreaView>;
}

/**
 * The sentence under the bar. It used to carry an uppercase kicker and a second, 28 px title; the bar
 * already names the screen, so here only a title that ADDS information (a state, a case) is drawn,
 * as a heading, and a tagline is not passed at all.
 */
export function SettingsIntro({ title, children }: { kicker?: string; title?: string; children: ReactNode }) {
  return <View style={styles.intro}>
    {title ? <SettingsText variant="heading" accessibilityRole="header">{title}</SettingsText> : null}
    <SettingsText variant="copy" tone="muted" style={styles.lead}>{children}</SettingsText>
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
    accessibilityState={{ disabled }} onPress={onPress} haptic={disabled ? 'none' : 'select'} scaleTo={0.99}
    style={[styles.row, last && styles.last, disabled && styles.disabled]}>
    {icon ? <View style={styles.rowIcon}>{icon}</View> : null}<View style={styles.rowCopy}><SettingsText variant="bodyStrong" style={styles.rowTitle}>{label}</SettingsText>
      {detail ? <SettingsText variant="note" tone="muted">{detail}</SettingsText> : null}</View>
    <CaretRight size={18} color={sys.color.muted} />
  </Press>;
}

export function SettingsPanel({ children, soft = false, style }: { children: ReactNode; soft?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[soft ? styles.soft : styles.flat, style]}>{children}</View>;
}

export function SettingsInfo({ title, children, icon, last = false }: { title: string; children: ReactNode; icon?: ReactNode; last?: boolean }) {
  return <View style={[styles.info, last && styles.last]}>{icon ? <View style={styles.rowIcon}>{icon}</View> : null}<View style={styles.rowCopy}>
    <SettingsText variant="bodyStrong">{title}</SettingsText><SettingsText variant="note" tone="muted">{children}</SettingsText>
  </View></View>;
}

/** `primary` is the screen's one brand action (orange surface, ink text); other kinds map onto V2Action. */
export function SettingsAction({ label, onPress, disabled = false, kind = 'primary', icon, compact = false }: {
  label: string; onPress: () => void; disabled?: boolean; kind?: 'primary' | 'secondary' | 'quiet' | 'destructive'; icon?: ReactNode;
  /** A small control beside content (under a photo tile), never for the screen's one brand action. */
  compact?: boolean;
}) {
  if (kind !== 'primary') return <V2Action label={label} onPress={onPress} disabled={disabled} kind={kind} icon={icon} compact={compact} />;
  return <V2Action label={label} onPress={onPress} disabled={disabled} icon={icon} style={brandAction} />;
}

export const settingsStyles = StyleSheet.create({
  /** Identity block of the profile hub: no card, centred, breathing (V5 profile head). */
  identity: { alignItems: 'center', gap: 6, paddingTop: 8, paddingBottom: 22 },
  avatar: { width: 96, height: 96, borderRadius: sys.radius.sheet, backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10, ...sys.elevation.soft },
  avatarBadge: { position: 'absolute', right: -4, bottom: -4, width: 30, height: 30, borderRadius: sys.radius.chip, backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.cardLine, alignItems: 'center', justifyContent: 'center' },
  name: { ...sys.type.pageTitle, textAlign: 'center' },
  /** A status badge within the shared account, never a global role switch. */
  intent: { backgroundColor: sys.color.greenSoft, borderRadius: sys.radius.chip, paddingHorizontal: 12, paddingVertical: 6, marginTop: 6 },
  logout: { paddingTop: 18, borderTopWidth: 1, borderTopColor: sys.color.line, marginTop: 6, marginBottom: 12, alignItems: 'flex-start' },
  notice: { padding: 14, borderRadius: sys.radius.control, backgroundColor: sys.color.greenSoft, flexDirection: 'row', gap: 10 },
  gap: { gap: 12 },
  step: { padding: 12, gap: 4, borderRadius: sys.radius.control },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  header: { minHeight: 62, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8, flexDirection: 'row', gap: 10, alignItems: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, flexGrow: 1, gap: 16 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, borderTopWidth: 1, borderTopColor: sys.color.line, backgroundColor: sys.color.surface, gap: 8 },
  body: { ...sys.type.body },
  strong: { ...sys.type.bodyStrong },
  meta: { ...sys.type.meta, fontWeight: '500' },
  label: { ...sys.type.label },
  title: { ...sys.type.title },
  heading: { ...sys.type.heading },
  hero: { ...sys.type.pageTitle },
  intro: { paddingTop: 0, gap: 6 },
  lead: { marginTop: 0 },
  group: { marginBottom: 20, gap: 10 },
  groupTitle: { color: sys.color.muted, letterSpacing: 0.4, paddingHorizontal: 2 },
  list: { ...card, paddingVertical: 0, paddingHorizontal: 18 },
  row: { minHeight: 66, paddingVertical: 13, flexDirection: 'row', gap: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: sys.color.line },
  rowIcon: { width: 40, height: 40, borderRadius: sys.radius.chip, backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { color: sys.color.ink },
  flat: { ...card, padding: 18, marginBottom: 14, gap: 12 },
  soft: { backgroundColor: sys.color.greenSoft, borderRadius: sys.radius.card, padding: 18, marginTop: 12, marginBottom: 12, gap: 12 },
  info: { paddingVertical: 13, flexDirection: 'row', gap: 12, borderBottomWidth: 1, borderBottomColor: sys.color.line },
  last: { borderBottomWidth: 0 },
  disabled: { opacity: .45 },
});
