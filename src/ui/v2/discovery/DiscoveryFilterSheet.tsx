import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Check } from 'phosphor-react-native';
import { discoveryItems, saysWorkMode, type MarketplaceItem, type MarketplaceView, type PlacesFilter, type WhenFilter, type WhereFilter }
  from '../../../data/marketplaceView';
import { ProductSheet } from '../../product/ProductSheet';
import { Press } from '../../Press';
import { T } from '../../Text';
import { zadataka } from '../../system/plural';
import { brandAction, sys } from '../../system/tokens';
import { V2Action } from '../V2Action';

export type FilterDraft = { price: MarketplaceView['price']; when: WhenFilter; where: WhereFilter; places: PlacesFilter };
export const NO_FILTERS: FilterDraft = { price: 'all', when: 'any', where: 'any', places: 'any' };
export const draftOf = (view: MarketplaceView): FilterDraft =>
  ({ price: view.price, when: view.when ?? 'any', where: view.where ?? 'any', places: view.places ?? 'any' });

/**
 * The words a filter says, on its chip in the sheet and on the chip that removes it under the list's count. Every section
 * starts with its "everything" choice, so the default always sits in the same place.
 */
export const WHEN: readonly (readonly [WhenFilter, string])[] = [['any', 'Bilo kada'], ['today', 'Danas'], ['tomorrow', 'Sutra'], ['week', 'Ove nedelje']];
export const WHERE: readonly (readonly [WhereFilter, string])[] = [['any', 'Bilo gde'], ['onsite', 'Na licu mesta'], ['remote', 'Na daljinu']];
export const PRICE: readonly (readonly [MarketplaceView['price'], string])[] = [['all', 'Sve'], ['MY_PRICE', 'Navedena cena'], ['OFFERS', 'Tražim ponude']];
export const PLACES: readonly (readonly [PlacesFilter, string])[] = [['any', 'Bilo koliko'], ['two', '2 ili više']];

/** One section: its name and a row of pill chips, one of which is chosen (a radio group to a screen reader). */
function Choice<K extends string>({ label, options, value, onChange }: {
  label: string; options: readonly (readonly [K, string])[]; value: K; onChange: (value: K) => void;
}) {
  return <View style={s.section}>
    <T variant="bodyStrong" accessibilityRole="header" style={s.sectionLabel}>{label}</T>
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={s.chips}>
      {options.map(([key, words]) => {
        const checked = key === value;
        return <Press key={key} accessibilityRole="radio" accessibilityLabel={words} accessibilityState={{ checked }} aria-checked={checked}
          haptic="select" scaleTo={0.97} hitSlop={{ top: 2, bottom: 2 }} onPress={() => onChange(key)} style={[s.chip, checked && s.chipOn]}>
          {checked ? <Check size={16} weight="bold" color={sys.color.onGreen} /> : null}
          <T style={[s.chipText, checked && s.chipTextOn]}>{words}</T>
        </Press>;
      })}
    </View>
  </View>;
}

/**
 * Filteri (Zadaci, 2026-09-24): Kada · Gde se radi · Cena · Slobodna mesta, each a row of pill chips, only from facts the
 * tasks already carry ("Gde se radi" is left out when no task says how it is done). The choices are a draft inside the
 * sheet: "Prikaži N zadataka" applies them all at once and says how many the list will then show, "Poništi" empties
 * the draft, and closing the sheet any other way leaves the list exactly as it was.
 */
export function DiscoveryFilterSheet({ items, view, mine, now, onApply, onClose }: {
  items: readonly MarketplaceItem[]; view: MarketplaceView; mine: ReadonlySet<string> | undefined; now: Date;
  onApply: (draft: FilterDraft) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<FilterDraft>(() => draftOf(view));
  const set = <K extends keyof FilterDraft>(key: K) => (value: FilterDraft[K]) => setDraft(current => ({ ...current, [key]: value }));
  const count = useMemo(() => discoveryItems(items, { ...view, ...draft }, mine, now).length, [items, view, draft, mine, now]);
  // Offered only when some task says how it is done, or when this filter is already on and must be removable.
  const where = useMemo(() => draft.where !== 'any' || (view.where ?? 'any') !== 'any'
    || saysWorkMode(mine?.size ? items.filter(item => !mine.has(item.id)) : items), [draft.where, view.where, items, mine]);
  return <ProductSheet title="Filteri" closeLabel="Zatvori filtere" onClose={onClose}
    footer={dismiss => <>
      <V2Action label={`Prikaži ${zadataka(count)}`} onPress={() => { onApply(draft); dismiss(); }} style={brandAction} />
      <V2Action label="Poništi" accessibilityLabel="Poništi izbor filtera" kind="quiet" onPress={() => setDraft(NO_FILTERS)} />
    </>}>
    {() => <View style={s.stack}>
      <Choice label="Kada" options={WHEN} value={draft.when} onChange={set('when')} />
      {where ? <Choice label="Gde se radi" options={WHERE} value={draft.where} onChange={set('where')} /> : null}
      <Choice label="Cena" options={PRICE} value={draft.price} onChange={set('price')} />
      <Choice label="Slobodna mesta" options={PLACES} value={draft.places} onChange={set('places')} />
    </View>}
  </ProductSheet>;
}

const s = StyleSheet.create({
  stack: { gap: sys.space.xl },
  section: { gap: sys.space.md },
  sectionLabel: { color: sys.color.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm },
  // A pill chip: the hairline when free, the green fill with a tick when chosen (shape and colour together).
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: sys.space.base, borderRadius: sys.radius.pill,
    borderWidth: 1, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface },
  chipOn: { backgroundColor: sys.color.green, borderColor: sys.color.green },
  chipText: { ...sys.type.copy, fontWeight: '500', color: sys.color.ink },
  chipTextOn: { color: sys.color.onGreen, fontWeight: '600' },
});
