import { useCallback } from 'react';
import { View } from 'react-native';
import { marketClientService } from '../../data/marketClientService';
import type { MarketConfig } from '../../contracts/market';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { Button } from '../Button';
import { T } from '../Text';
import { LocationChoice, locationStyles as s } from './LocationControls';

const NAMES: Readonly<Record<string, string>> = {
  RS: 'Srbija', BA: 'Bosna i Hercegovina', HR: 'Hrvatska', ME: 'Crna Gora',
  MK: 'Severna Makedonija', SI: 'Slovenija', AL: 'Albanija', BG: 'Bugarska', RO: 'Rumunija', GR: 'Grčka',
};
export function useCountryOptions() {
  const load = useCallback(() => marketClientService.list(), []);
  const state = useFocusedResource(load);
  const countries = state.data?.ok ? state.data.podatak : [];
  return { countries, loading: state.loading,
    error: state.error ? 'Države trenutno nisu učitane.' : state.data && !state.data.ok ? state.data.poruka : null,
    refresh: state.refresh };
}
export const selectableCountry = (countries: readonly MarketConfig[], code: string | null) =>
  countries.some(country => country.countryCode === code && ['BUILDING', 'LIVE'].includes(country.productStatus));

export function CountryField({ label, value, disabled, onChange, options }: {
  label: string; value: string | null; disabled: boolean; onChange: (code: string) => void;
  options: ReturnType<typeof useCountryOptions>;
}) {
  return <View style={s.section}>
    <LocationChoice label={label} value={value} disabled={disabled || options.loading || !options.countries.length}
      onChange={onChange} options={options.countries.map(country => ({ value: country.countryCode,
        label: NAMES[country.countryCode] ?? country.countryCode, disabled: !selectableCountry(options.countries, country.countryCode) }))} />
    {options.loading ? <T>Učitavamo države…</T> : null}
    {value && !options.countries.some(country => country.countryCode === value) ? <T>Sačuvana država: {NAMES[value] ?? value}. Izaberite dostupnu državu pre čuvanja.</T> : null}
    {options.error || (!options.loading && !options.countries.length) ? <View style={s.notice}>
      <T accessibilityRole="alert">{options.error ?? 'Izbor država trenutno nije dostupan.'}</T>
      <Button kind="secondary" label="Ponovo učitaj države" onPress={() => { void options.refresh(); }} />
    </View> : null}
  </View>;
}
