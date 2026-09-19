import { useState } from 'react';
import { View } from 'react-native';
import { CivilField } from '../calendar/CalendarControls';
import { civilInstant, zonedParts } from '../calendar/calendarPresentation';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { aiFirst as a } from './tokens';

export function ResponseDeadlineEditor(p: { value: string | null; timezone: string; disabled: boolean; apply: (value: string | null) => void; cancel: () => void }) {
  const initial = p.value ? zonedParts(new Date(p.value), p.timezone) : { date: '', time: '' };
  const [date, setDate] = useState(initial.date), [time, setTime] = useState(initial.time), [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const apply = () => {
    if (p.disabled) return;
    const parsed = p.value && !changed ? { value: p.value, error: null } : civilInstant(date, time, p.timezone);
    if (!parsed.value) { setError(parsed.error); return; }
    if (Date.parse(parsed.value) <= Date.now()) { setError('Rok mora biti u budućnosti.'); return; }
    p.apply(parsed.value);
  };
  return <View style={{ gap: 12 }}>
    <T style={{ ...a.text.meta, color: a.color.muted }}>Vremenska zona: {p.timezone}</T>
    <CivilField label="Datum roka za prijave" mode="date" value={date} disabled={p.disabled} onChange={v => { setChanged(true); setError(null); setDate(v); }} />
    <CivilField label="Vreme roka za prijave" mode="time" value={time} disabled={p.disabled} onChange={v => { setChanged(true); setError(null); setTime(v); }} />
    {error ? <T accessibilityRole="alert" style={{ ...a.text.meta, color: a.color.danger }}>{error}</T> : null}
    <V2Action label="Primeni rok na pregled" disabled={p.disabled || !date || !time} onPress={apply} />
    <V2Action label="Bez posebnog roka" kind="quiet" disabled={p.disabled} onPress={() => { if (!p.disabled) p.apply(null); }} />
    <V2Action label="Odustani od izmene roka" kind="quiet" disabled={p.disabled} onPress={p.cancel} />
  </View>;
}
