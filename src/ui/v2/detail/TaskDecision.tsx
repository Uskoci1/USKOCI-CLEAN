import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { CaretRight } from 'phosphor-react-native';
import { T } from '../../Text';
import { Press } from '../../Press';
import { Avatar } from '../../system/Avatar';
import { FactArt, type FactArtKind } from '../../system/FactArt';
import { sys } from '../../system/tokens';
import { DetailSection, type productPriceParts } from '../../product/ProductDetails';

/** An open page title: its layout still belongs to the screen's measured chrome handoff. */
export function TaskDecisionTitle({ children, onLayout }: { children: ReactNode; onLayout: (event: LayoutChangeEvent) => void }) {
  return <T accessibilityRole="header" onLayout={onLayout} style={s.title}>{children}</T>;
}

/** The same truthful price helper, with a different visual weight for amounts and statements about a price. */
export function TaskDecisionPrice({ price, offers = false }: { price: ReturnType<typeof productPriceParts>; offers?: boolean }) {
  return <View accessible accessibilityLabel={`Budžet: ${price.value}${price.note ? `, ${price.note}` : ''}`} style={s.price}>
    <View style={s.priceCopy}>
      <T style={price.isAmount ? s.amount : s.priceWords}>{price.value}</T>
      {price.note ? <T variant="note" tone="muted">{price.note}</T> : null}
    </View>
    <View style={s.priceArt}><FactArt kind={offers ? 'offers' : 'money'} size={40} muted={!price.isAmount && !offers} /></View>
  </View>;
}

/**
 * Place stays a complete reading row. Time and people share one band only when the text has room; no date is
 * parsed, shortened or guessed. Larger system text and narrow phones keep the same facts in one column.
 */
export function TaskDecisionLogistics({ remote, place, time, people, filled, spokenFilled }: {
  remote: boolean; place: string; time: string; people: string; filled?: string; spokenFilled?: string;
}) {
  const { width, fontScale } = useWindowDimensions();
  const paired = width >= 380 && fontScale <= 1.3;
  return <View style={s.logistics}>
    <View accessible accessibilityLabel={`${remote ? 'Način rada' : 'Lokacija'}: ${remote ? 'Na daljinu' : place}`} style={s.place}>
      <FactArt kind={remote ? 'remote' : 'pin'} size={32} />
      <View style={s.copy}><T style={s.value}>{remote ? 'Na daljinu' : place}</T></View>
    </View>
    <View style={[s.planning, paired && s.planningPaired]}>
      <View accessible accessibilityLabel={`Termin: ${time}`} style={[s.planningFact, paired && s.timeColumn]}>
        <FactArt kind="calendar" size={28} />
        <View style={s.copy}><T variant="meta" tone="muted">Termin</T><T style={s.value}>{time}</T></View>
      </View>
      <View accessible accessibilityLabel={`Potrebno: ${people}${spokenFilled || filled ? `, ${spokenFilled ?? filled}` : ''}`}
        style={[s.planningFact, paired && s.peopleColumn]}>
        <FactArt kind="users" size={28} />
        <View style={s.copy}><T variant="meta" tone="muted">Potrebno</T><T style={s.value}>{people}</T>
          {filled ? <T variant="note" tone="muted">{filled}</T> : null}</View>
      </View>
    </View>
  </View>;
}

/** The person is a trust fact, not decoration. The verified photo callback receives the larger portrait size. */
export function TaskDecisionPerson({ name, caption, photo, initials, onPress, disabled = false }: {
  name: string; caption: string; photo?: ReactNode; initials: string | null; onPress?: () => void; disabled?: boolean;
}) {
  const unavailable = disabled || !onPress;
  return <Press accessibilityRole="button" accessibilityLabel={`${name}, ${caption.split(' · ').join(', ')}`}
    accessibilityHint={onPress ? 'Otvara javni profil' : undefined} accessibilityState={{ disabled: unavailable }}
    disabled={unavailable} onPress={onPress} haptic="select" scaleTo={0.99} style={s.person}>
    <View style={s.portrait}>{photo ?? <Avatar initials={initials} size={56} />}</View>
    <View style={s.personCopy}><T style={s.value}>{name}</T><T variant="note" tone="muted">{caption}</T></View>
    {onPress ? <View style={s.caret}><CaretRight size={20} color={sys.color.muted} /></View> : null}
  </Press>;
}

const REQUIREMENT_ART: Record<string, FactArtKind> = {
  'Veštine': 'tool', 'Alat': 'tool', 'Vozilo': 'vehicle', 'Dozvole': 'document', 'Bitni uslovi': 'info',
  'Najmanje iskustva': 'star', 'Identitet': 'shield', 'Uslovi': 'document',
};

/** Requirement groups keep every supplied value visible; icons identify groups instead of decorating each chip. */
export function TaskDecisionRequirements({ rows }: { rows: { label: string; value: string }[] }) {
  if (!rows.length) return null;
  return <DetailSection title="Važno za ovaj zadatak">
    <View style={s.requirements}>{rows.map((row, index) => {
      const lines = row.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      const bullets = lines.length > 0 && lines.every(line => /^[•\-–]\s*/.test(line));
      const values = bullets ? lines.map(line => line.replace(/^[•\-–]\s*/, '')).filter(Boolean) : [row.value];
      return <View key={`${row.label}:${index}`} style={s.requirement}>
        <View style={s.requirementArt}><FactArt kind={REQUIREMENT_ART[row.label] ?? 'document'} size={28} /></View>
        <View style={s.copy}><T variant="meta" tone="muted">{row.label}</T>
          {values.map((value, at) => <T key={`${at}:${value}`} selectable variant="body" style={s.ink}>{value}</T>)}
        </View>
      </View>;
    })}</View>
  </DetailSection>;
}

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  title: { ...sys.type.hero, color: sys.color.ink, lineHeight: 36, letterSpacing: -0.8 },
  price: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingVertical: 4 },
  priceCopy: { flex: 1, minWidth: 0, gap: 4 },
  priceArt: { paddingTop: 4 },
  amount: { ...sys.type.priceLarge, fontSize: 32, lineHeight: 40, color: sys.color.money },
  priceWords: { ...sys.type.title, color: sys.color.ink },
  logistics: { paddingVertical: 20, gap: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: sys.color.line },
  place: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  planning: { gap: 20 },
  planningPaired: { flexDirection: 'row', gap: 20 },
  planningFact: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  timeColumn: { flex: 1.4, minWidth: 0, flexDirection: 'column', gap: 8 },
  peopleColumn: { flex: 1, minWidth: 0, flexDirection: 'column', gap: 8, borderLeftWidth: 1, borderLeftColor: sys.color.line, paddingLeft: 20 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  value: { ...sys.type.bodyStrong, color: sys.color.ink },
  person: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, minHeight: 56, paddingVertical: 4 },
  portrait: { width: 56, height: 56, flexShrink: 0, borderRadius: sys.radius.pill, overflow: 'hidden' },
  personCopy: { flex: 1, minWidth: 0, gap: 4, paddingTop: 4 },
  caret: { alignSelf: 'center' },
  requirements: { gap: 20 },
  requirement: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  requirementArt: { paddingTop: 2 },
});
