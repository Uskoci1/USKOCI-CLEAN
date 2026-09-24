import { cloneElement, isValidElement, type ComponentProps, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretRight } from 'phosphor-react-native';
import { Press } from '../Press';
import { ProductHeader } from '../product/ProductDetails';
import { Avatar } from '../system/Avatar';
import { FactArt } from '../system/FactArt';
import { useTextScale } from '../system/textScale';
import { brandAction, card, sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';

/**
 * Shared settings system: every profile/account/support/legal surface is built
 * from these pieces, so restyling them here moves the whole family at once.
 * Exports, props and spoken labels are unchanged; native text stays scalable and
 * no row has a fixed height. White screen, one card per group, rows with a 40px
 * icon disc, a 16/600 label and a 14px detail; one green brand action per screen.
 *
 * One rhythm (step 11a, 2026-09-24): blocks are 24 apart and carry no margins of their own, every row is at least
 * 56 dp (12 over and under its words), a group's name is a quiet 13 px line and not a tracked capital label, and a
 * control that cannot be used now draws its words in muted ink instead of fading into a ghost. A destructive row is
 * the last row of the last group, in the danger colour.
 */
export function SettingsText({ variant = 'body', tone = 'ink', style, ...props }: ComponentProps<typeof T>) {
  const type = variant === 'display' ? styles.hero : variant === 'title' ? styles.title
    : variant === 'heading' ? styles.heading : variant === 'label' ? styles.label
      : variant === 'meta' ? styles.meta : variant === 'bodyStrong' ? styles.strong : variant === 'note' || variant === 'copy' ? sys.type[variant] : styles.body;
  return <T {...props} variant={variant} tone={tone} style={[type,
    { color: tone === 'muted' ? sys.color.muted : tone === 'danger' ? sys.color.danger : tone === 'success' ? sys.color.green : sys.color.ink }, style]} />;
}

export function SettingsScreen({ title, onBack, backLabel, disabled = false, children, footer }: {
  /** The bar names the screen; nothing explains where you are (no eyebrow, owner 2026-09-23). */
  title: string; onBack: () => void;
  /** What the arrow says when "Nazad" is not enough ("Nazad na profil"). */ backLabel?: string;
  disabled?: boolean; children: ReactNode; footer?: ReactNode;
}) {
  return <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
    <ProductHeader title={title} back={onBack} backLabel={backLabel} disabled={disabled} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>{children}</ScrollView>
    {footer ? <SettingsFooter>{footer}</SettingsFooter> : null}
  </SafeAreaView>;
}

/** The band under a settings screen that holds its one green action, above the system's own bottom edge. */
export function SettingsFooter({ children }: { children: ReactNode }) {
  return <View testID="settings-primary-footer" style={styles.footer}>{children}</View>;
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

/**
 * Rows that belong together, in one card. The name above it is optional and quiet (13 px, muted): it names the group
 * for a screen reader as a header, and it is not an eyebrow. The line under it, when given, says what the whole group
 * means once instead of on every row.
 */
export function SettingsGroup({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  return <View style={styles.group}>
    {title ? <SettingsText variant="meta" tone="muted" accessibilityRole="header" style={styles.groupTitle}>{title}</SettingsText> : null}
    <View style={styles.list}>{children}</View>
    {footer ? <SettingsText variant="note" tone="muted" style={styles.groupFooter}>{footer}</SettingsText> : null}
  </View>;
}

export function SettingsRow({ label, detail, icon, onPress, disabled = false, last = false, compact = false, tone = 'default', accessory }: {
  label: string; detail?: string; icon?: ReactNode; onPress: () => void; disabled?: boolean; last?: boolean;
  /** A row for something needed once in a long while (legal, export, the blocked list): no icon disc, so it does not
   *  compete with the rows a person opens every day (owner rule, 2026-09-23). It keeps the same 56 dp minimum. */
  compact?: boolean;
  /** `danger` for the one destructive row, which is the last row of the last group. */
  tone?: 'default' | 'danger';
  /** Drawn at the trailing edge instead of the chevron (a count, a state word). */
  accessory?: ReactNode;
}) {
  const danger = tone === 'danger';
  const ink = disabled ? sys.color.muted : danger ? sys.color.danger : sys.color.ink;
  // A row that cannot be opened now draws its picture in the muted set too, as V2Action does with its icon: a full-colour
  // picture beside muted words still looked usable.
  const drawn = disabled && isValidElement<{ muted?: boolean }>(icon) && icon.type === FactArt ? cloneElement(icon, { muted: true }) : icon;
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint={detail} disabled={disabled}
    accessibilityState={{ disabled }} onPress={onPress} haptic={disabled ? 'none' : 'select'} scaleTo={0.99}
    style={[styles.row, last && styles.last]}>
    {drawn && !compact ? <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>{drawn}</View> : null}
    <View style={styles.rowCopy}><SettingsText variant="bodyStrong" style={{ color: ink }}>{label}</SettingsText>
      {detail ? <SettingsText variant="note" tone="muted">{detail}</SettingsText> : null}</View>
    {accessory ?? <CaretRight size={18} color={sys.color.muted} />}
  </Press>;
}

/**
 * A choice that is on or off. The whole row is the switch (one focus stop, spoken as a switch with its state), so a
 * finger does not have to find the 51 × 31 control at the right edge; the drawn switch is hidden from a screen reader so
 * it is not heard twice. Green track and a white thumb when on, the strong hairline when off, never the platform's teal.
 * A switch that cannot be used now says why, under its help and in its hint.
 */
export function SettingsSwitchRow({ label, help, value, disabled = false, reason, onChange, last = false }: {
  label: string; help?: string; value: boolean; disabled?: boolean; reason?: string | null; onChange: (value: boolean) => void; last?: boolean;
}) {
  const why = disabled && reason ? reason : null;
  const hint = [help, why].filter(Boolean).join(' ') || undefined;
  return <Press accessibilityRole="switch" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ checked: value, disabled }}
    disabled={disabled} haptic={disabled ? 'none' : 'select'} scaleTo={1} onPress={() => onChange(!value)} style={[styles.row, last && styles.last]}>
    <View style={styles.rowCopy}>
      <SettingsText variant="bodyStrong" style={{ color: disabled ? sys.color.muted : sys.color.ink }}>{label}</SettingsText>
      {help ? <SettingsText variant="note" tone="muted">{help}</SettingsText> : null}
      {why ? <SettingsText variant="note" tone="muted">{why}</SettingsText> : null}
    </View>
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Switch value={value} disabled={disabled} onValueChange={onChange}
        trackColor={{ false: sys.color.lineStrong, true: sys.color.green }} thumbColor={sys.color.surface}
        ios_backgroundColor={sys.color.lineStrong} />
    </View>
  </Press>;
}

/**
 * A person with one action beside them (the blocked list). Two focus stops, side by side: the person, which opens
 * them, and the action. At a large text size the action moves under the name, so neither is squeezed. The person's
 * part ends in the settings chevron, so it reads as a way onward and not as a label beside a button.
 */
export function SettingsPersonRow({ name, initials, onOpen, openHint, action, last = false }: {
  name: string; initials: string | null; onOpen: () => void; openHint?: string;
  action: { label: string; accessibilityLabel?: string; onPress: () => void; disabled?: boolean; loading?: boolean };
  last?: boolean;
}) {
  const large = useTextScale() >= 1.3;
  return <View style={[styles.person, large && styles.personLarge, last && styles.last]}>
    <Press accessibilityRole="button" accessibilityLabel={name} accessibilityHint={openHint} haptic="select" scaleTo={0.99}
      onPress={onOpen} style={styles.personOpen}>
      <Avatar initials={initials} size={40} />
      <SettingsText variant="bodyStrong" numberOfLines={2} style={styles.personName}>{name}</SettingsText>
      <CaretRight size={18} color={sys.color.muted} />
    </Press>
    <View style={large ? styles.personActionLarge : undefined}>
      <V2Action label={action.label} accessibilityLabel={action.accessibilityLabel} onPress={action.onPress}
        disabled={action.disabled} loading={action.loading} kind="secondary" compact />
    </View>
  </View>;
}

export function SettingsPanel({ children, soft = false, style }: { children: ReactNode; soft?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[soft ? styles.soft : styles.flat, style]}>{children}</View>;
}

export function SettingsInfo({ title, children, icon, last = false }: { title: string; children: ReactNode; icon?: ReactNode; last?: boolean }) {
  return <View style={[styles.info, last && styles.last]}>{icon ? <View style={styles.rowIcon}>{icon}</View> : null}<View style={styles.rowCopy}>
    <SettingsText variant="bodyStrong">{title}</SettingsText><SettingsText variant="note" tone="muted">{children}</SettingsText>
  </View></View>;
}

/**
 * `primary` is the screen's one brand action (green surface, white label); other kinds map onto V2Action. `loading` is
 * this action's own write in flight (it keeps its colour and words, with a spinner); `reason` says why a disabled one
 * cannot be pressed now.
 */
export function SettingsAction({ label, onPress, disabled = false, loading = false, reason, kind = 'primary', icon, compact = false }: {
  label: string; onPress: () => void; disabled?: boolean; loading?: boolean; reason?: string | null;
  kind?: 'primary' | 'secondary' | 'quiet' | 'destructive'; icon?: ReactNode;
  /** A small control beside content (under a photo tile), never for the screen's one brand action. */
  compact?: boolean;
}) {
  if (kind !== 'primary') return <V2Action label={label} onPress={onPress} disabled={disabled} loading={loading} reason={reason} kind={kind} icon={icon} compact={compact} />;
  return <V2Action label={label} onPress={onPress} disabled={disabled} loading={loading} reason={reason} icon={icon} style={brandAction} />;
}

export const settingsStyles = StyleSheet.create({
  /** Identity block of the profile hub: no card, centred, breathing (V5 profile head). */
  identity: { gap: 12, paddingTop: 8, paddingBottom: 22 },
  // V41 identity row: photo left, name and city beside it, one quiet "Uredi" on the right.
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  identityCopy: { flex: 1, minWidth: 0, gap: 4 },
  identityCity: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: sys.radius.control,
    borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
  editText: { color: sys.color.green, fontWeight: '600' },
  avatar: { width: 80, height: 80, borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft, borderWidth: 1, borderColor: sys.color.line, alignItems: 'center', justifyContent: 'center' },
  avatarBadge: { position: 'absolute', right: -4, bottom: -4, width: 30, height: 30, borderRadius: sys.radius.chip, backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.cardLine, alignItems: 'center', justifyContent: 'center' },
  name: { ...sys.type.pageTitle },
  /** A status badge within the shared account, never a global role switch. */
  intent: { backgroundColor: sys.color.greenSoft, borderRadius: sys.radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginTop: 6 },
  logout: { paddingTop: 18, borderTopWidth: 1, borderTopColor: sys.color.line, marginTop: 6, marginBottom: 12, alignItems: 'flex-start' },
  notice: { padding: 14, borderRadius: sys.radius.control, backgroundColor: sys.color.greenSoft, flexDirection: 'row', gap: 10 },
  gap: { gap: 12 },
  step: { padding: 12, gap: 4, borderRadius: sys.radius.control },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, flexGrow: 1, gap: 24 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: sys.color.line, backgroundColor: sys.color.surface, gap: 8 },
  body: { ...sys.type.body },
  strong: { ...sys.type.bodyStrong },
  meta: { ...sys.type.meta, fontWeight: '500' },
  label: { ...sys.type.label },
  title: { ...sys.type.title },
  heading: { ...sys.type.heading },
  hero: { ...sys.type.pageTitle },
  intro: { paddingTop: 0, gap: 6 },
  lead: { marginTop: 0 },
  group: { gap: 8 },
  groupTitle: { fontWeight: '600', paddingHorizontal: 4 },
  groupFooter: { paddingHorizontal: 4 },
  list: { ...card, padding: 0, paddingHorizontal: 16 },
  row: { minHeight: 56, paddingVertical: 12, flexDirection: 'row', gap: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: sys.color.line },
  rowIcon: { width: 40, height: 40, borderRadius: sys.radius.chip, backgroundColor: sys.color.iconWell, alignItems: 'center', justifyContent: 'center' },
  rowIconDanger: { backgroundColor: sys.color.dangerSoft },
  rowCopy: { flex: 1, gap: 2, minWidth: 0 },
  person: { minHeight: 56, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: sys.color.line },
  personLarge: { flexWrap: 'wrap' },
  personOpen: { flex: 1, minWidth: 0, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  personName: { flex: 1, minWidth: 0 },
  // At a large text size the action takes its own line under the name, starting where the name starts.
  personActionLarge: { width: '100%', paddingLeft: 52, paddingBottom: 4, alignItems: 'flex-start' },
  flat: { ...card, gap: 12 },
  soft: { backgroundColor: sys.color.greenSoft, borderRadius: sys.radius.card, padding: 20, gap: 12 },
  info: { minHeight: 56, paddingVertical: 12, flexDirection: 'row', gap: 12, borderBottomWidth: 1, borderBottomColor: sys.color.line },
  last: { borderBottomWidth: 0 },
});
