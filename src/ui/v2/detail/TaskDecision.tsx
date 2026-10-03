import type { ReactNode } from 'react';
import type { PrilikaProjekcija } from '../../../contracts/projections';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { CaretRight } from 'phosphor-react-native';
import { T } from '../../Text';
import { Press } from '../../Press';
import { Avatar } from '../../system/Avatar';
import { FactArt, type FactArtKind } from '../../system/FactArt';
import { CalendarArt } from '../../system/CalendarArt';
import { sys } from '../../system/tokens';
import { useLayoutClass } from '../../system/textScale';
import { osoba } from '../../system/plural';
import { placesText, taskPlace } from '../TaskFace';
import type { productPriceParts } from '../../product/ProductDetails';

/** An open page title: its layout still belongs to the screen's measured chrome handoff. */
export function TaskDecisionTitle({ children, onLayout }: { children: ReactNode; onLayout: (event: LayoutChangeEvent) => void }) {
  return <T accessibilityRole="header" onLayout={onLayout} style={s.title}>{children}</T>;
}

/** The work itself reads as open sections; only changes of context need a separating rule. */
export function TaskDecisionSection({ title, children }: { title: string; children: ReactNode }) {
  return <View style={s.section}>
    <T accessibilityRole="header" variant="heading" style={s.ink}>{title}</T>
    {children}
  </View>;
}

/** The same truthful price helper, with a different visual weight for amounts and statements about a price. */
export function TaskDecisionPrice({ price, offers = false, compact = false }: { price: ReturnType<typeof productPriceParts>; offers?: boolean; compact?: boolean }) {
  return <View accessible accessibilityLabel={`Budžet: ${price.value}${price.note ? `, ${price.note}` : ''}`} style={[s.price, compact && s.priceCompact]}>
    {price.isAmount || offers ? <View style={s.priceArt}><FactArt kind={offers ? 'offers' : 'money'} size={compact ? 28 : 32} cut="art" role={offers ? 'people' : 'confirmed'} /></View> : null}
    <View style={s.priceCopy}>
      <T style={price.isAmount ? [s.amount, compact && s.amountCompact] : s.priceWords}>{price.value}</T>
      {price.note ? <T variant="note" tone="muted">{price.note}</T> : null}
    </View>
  </View>;
}

/**
 * Three aligned facts read as one group. The complete time and capacity wrap naturally rather than becoming
 * separate illustrated tiles. No date, place, or count is parsed, shortened or guessed.
 */
export function TaskDecisionLogistics({ remote, place, time, people, filled, spokenFilled, showCapacity = true }: {
  remote: boolean; place: string; time: string; people: string; filled?: string; spokenFilled?: string; showCapacity?: boolean;
}) {
  return <View style={s.logistics}>
    <View accessible accessibilityLabel={`${remote ? 'Način rada' : 'Lokacija'}: ${remote ? 'Na daljinu' : place}`} style={s.place}>
      <FactArt kind={remote ? 'remote' : 'pin'} size={28} cut="art" role="location" />
      <View style={s.copy}><T style={s.factValue}>{remote ? 'Na daljinu' : place}</T></View>
    </View>
    <View accessible accessibilityLabel={`Termin: ${time}`} style={s.planningFact}>
      <CalendarArt size={28} />
      <View style={s.copy}><T style={s.factValue}>{time}</T></View>
    </View>
    {showCapacity ? <View accessible accessibilityLabel={`Potrebno: ${people}${spokenFilled || filled ? `, ${spokenFilled ?? filled}` : ''}`} style={s.planningFact}>
      <FactArt kind="users" size={28} cut="art" role="people" />
      <View style={s.capacityCopy}><T style={[s.factValue, s.capacityValue]}>{filled ?? people}</T></View>
    </View> : null}
  </View>;
}

/** Public terms lead, then place/time. Values are the existing price and public geography projections only. */
export function TaskDecisionSummary({ need, price }: {
  need: Pick<PrilikaProjekcija, 'detalji' | 'podrucjeTekst' | 'vremeTekst' | 'pokrivenost' | 'rezimCene'>;
  price: ReturnType<typeof productPriceParts> | null;
}) {
  const { stacked } = useLayoutClass();
  // Full price-basis explanations and nonamount statements keep the whole row.
  const stackTerms = stacked || !price?.isAmount || !!price.note;
  const place = taskPlace(need);
  const capacity = placesText(need.pokrivenost, 'worker', 'fraction');
  const people = osoba(need.pokrivenost.ukupno);
  return <View style={s.summary}>
    <View style={[s.terms, stackTerms && s.termsStacked]}>
      {price ? <View style={[s.priceSlot, stackTerms && s.termStacked]}>
        <TaskDecisionPrice price={price} offers={need.rezimCene === 'OFFERS'} compact />
      </View> : null}
      <View accessible accessibilityLabel={`Potrebno: ${people}, ${capacity.spoken}`}
        style={[s.capacityTerm, stackTerms && s.termStacked]}>
        <FactArt kind="users" size={24} cut="art" role="people" />
        <View style={[s.copy, s.capacityInline]}>
          <T style={s.capacityCount}>{people}</T>
          <T variant="meta" tone="muted" style={s.capacityFilled}>{capacity.text} popunjeno</T>
        </View>
      </View>
    </View>
    <TaskDecisionLogistics remote={place.remote} place={place.text} time={need.vremeTekst}
      people={people} showCapacity={false} />
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
  return <TaskDecisionSection title="Važno za ovaj zadatak">
    <View style={s.requirements}>{rows.map((row, index) => {
      const lines = row.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      const bullets = lines.length > 0 && lines.every(line => /^[•\-–]\s*/.test(line));
      const values = bullets ? lines.map(line => line.replace(/^[•\-–]\s*/, '')).filter(Boolean) : [row.value];
      return <View key={`${row.label}:${index}`} style={s.requirement}>
        <View style={s.requirementArt}><FactArt kind={REQUIREMENT_ART[row.label] ?? 'document'} size={24} cut="art" /></View>
        <View style={s.copy}><T variant="meta" tone="muted">{row.label}</T>
          {values.map((value, at) => <T key={`${at}:${value}`} selectable variant="body" style={s.ink}>{value}</T>)}
        </View>
      </View>;
    })}</View>
  </TaskDecisionSection>;
}

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  title: { ...sys.type.pageTitle, color: sys.color.ink },
  section: { gap: sys.space.md },
  price: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md, paddingTop: sys.space.base,
    borderTopWidth: 1, borderColor: sys.color.line },
  priceCompact: { paddingTop: 0, borderTopWidth: 0, gap: sys.space.sm },
  priceCopy: { flex: 1, minWidth: 0, gap: 4 },
  priceArt: { paddingTop: 2 },
  amount: { ...sys.type.priceLarge, color: sys.color.money },
  amountCompact: { ...sys.type.priceSmall },
  priceWords: { ...sys.type.bodyStrong, color: sys.color.ink },
  summary: { gap: sys.space.base },
  terms: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: sys.space.md, rowGap: sys.space.md },
  termsStacked: { flexDirection: 'column' },
  priceSlot: { flexBasis: 176, flexGrow: 1, flexShrink: 1, minWidth: 0, maxWidth: '100%' },
  capacityTerm: { flexBasis: 100, flexGrow: 0, flexShrink: 1, maxWidth: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.sm },
  termStacked: { flexBasis: 'auto', flexGrow: 0, width: '100%' },
  capacityInline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: sys.space.sm, rowGap: 2 },
  capacityCount: { ...sys.type.bodyStrong, color: sys.color.ink, fontVariant: ['tabular-nums'], maxWidth: '100%', flexShrink: 1 },
  capacityFilled: { maxWidth: '100%', flexShrink: 1 },
  logistics: { gap: sys.space.sm },
  place: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  planningFact: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  capacityCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: sys.space.md, rowGap: sys.space.xs },
  capacityValue: { maxWidth: '100%', flexShrink: 1 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  value: { ...sys.type.bodyStrong, color: sys.color.ink },
  factValue: { ...sys.type.copy, color: sys.color.fact },
  person: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, minHeight: 56, paddingVertical: 4 },
  portrait: { width: 56, height: 56, flexShrink: 0, borderRadius: sys.radius.pill, overflow: 'hidden' },
  personCopy: { flex: 1, minWidth: 0, gap: 4, paddingTop: 4 },
  caret: { alignSelf: 'center' },
  requirements: { gap: sys.space.base },
  requirement: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  requirementArt: { paddingTop: 2 },
});
