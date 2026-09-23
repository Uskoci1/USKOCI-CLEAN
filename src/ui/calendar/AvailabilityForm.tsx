import { useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Switch, View } from 'react-native';
import { CaretDown, CaretUp, PencilSimple, Plus, Trash } from 'phosphor-react-native';
import type { AvailabilityRule, AvailabilityWindow, WorkerAvailabilityInput } from '../../contracts/workerAvailability';
import { normalizeWorkerAvailability } from '../../lib/workerAvailability';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { sys } from '../system/tokens';
import { Press } from '../Press';
import { CalendarAction as Button, CalendarText as T, CalendarField, CivilField, EditorSheet, calendarStyles as s } from './CalendarControls';
import { civilClock, civilDay, civilInstant, scheduleZone, shiftDate, weekdays, zonedParts } from './calendarPresentation';
import { raspon } from '../../lib/vreme';
import { plural } from '../system/plural';

function Toggle({ label, value, change, disabled }: { label: string; value: boolean; change: (value: boolean) => void; disabled?: boolean }) {
  return <View style={s.row}><T style={{ flex: 1 }}>{label}</T><Switch accessibilityLabel={label} value={value}
    onValueChange={change} disabled={disabled} trackColor={{ true: sys.color.green, false: sys.color.lineStrong }} /></View>;
}
type RuleDraft = AvailabilityRule;

function RuleEditor({ rule, timezone, close, accept }: {
  rule: RuleDraft; timezone: string; close: () => void; accept: (rules: readonly AvailabilityRule[]) => void;
}) {
  const [draft, setDraft] = useState(rule);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof RuleDraft>(key: K, value: RuleDraft[K]) => { setError(null); setDraft(current => ({ ...current, [key]: value })); };
  const submit = () => {
    const seconds = (value: string) => {
      const match = /^(\d{2}):(\d{2})(?::(\d{2}(?:\.\d{1,6})?))?$/.exec(value);
      return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0) : NaN;
    };
    const startSeconds = seconds(draft.startTime), endSeconds = seconds(draft.endTime);
    if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || startSeconds === endSeconds) {
      setError('Izaberi različito vreme početka i kraja.'); return;
    }
    const overnight = endSeconds < startSeconds;
    let rules: AvailabilityRule[] = [draft];
    if (overnight) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.startsOn) || (draft.endsOn && !/^\d{4}-\d{2}-\d{2}$/.test(draft.endsOn))) {
        setError('Proveri početni i završni datum.'); return;
      }
      try {
        rules = [{ ...draft, endTime: '24:00' }];
        if (endSeconds !== 0) rules.push({ ...draft, id: noviUuidZahtevId(),
          weekdays: draft.weekdays.map(day => (day + 1) % 7), startTime: '00:00',
          startsOn: shiftDate(draft.startsOn, 1), endsOn: draft.endsOn ? shiftDate(draft.endsOn, 1) : null });
      } catch { setError('Proveri početni i završni datum.'); return; }
    }
    const valid = normalizeWorkerAvailability({ timezone, availableNow: false, rules, windows: [] });
    if (!valid) { setError('Izaberi dane, datume i vremenski interval sa različitim početkom i krajem.'); return; }
    accept(valid.rules);
  };
  return <EditorSheet title="Redovni termin" close={close} footer={<>{error ? <T accessibilityRole="alert" tone="danger">{error}</T> : null}<Button label="Primeni termin" onPress={submit} full /><Button label="Odustani od termina" kind="quiet" onPress={close} full /></>}>
    <T variant="heading">Kada obično možeš da radiš?</T><T tone="muted">{`${scheduleZone(timezone)}.`}</T>
    <View style={s.row}>{weekdays.map(day => <Press key={day.day} accessibilityRole="checkbox" accessibilityLabel={day.name}
      accessibilityState={{ checked: draft.weekdays.includes(day.day) }} onPress={() => set('weekdays', draft.weekdays.includes(day.day)
        ? draft.weekdays.filter(value => value !== day.day) : [...draft.weekdays, day.day])}
      style={[s.icon, { backgroundColor: draft.weekdays.includes(day.day) ? sys.color.green : sys.color.greenSoft }]}>
      <T tone={draft.weekdays.includes(day.day) ? 'onDark' : 'ink'}>{day.short}</T>
    </Press>)}</View>
    <CivilField label="Početak termina" mode="time" value={draft.startTime} onChange={value => set('startTime', value)} />
    <CivilField label="Kraj termina" mode="time" value={draft.endTime} onChange={value => set('endTime', value)} />
    <T variant="meta" tone="muted">Kraj pre početka znači rad preko ponoći. Čuva se kao dva intervala u susednim danima.</T>
    <CivilField label="Važi od" mode="date" value={draft.startsOn} onChange={value => set('startsOn', value)} />
    <Toggle label="Bez završnog datuma" value={draft.endsOn === null} change={value => set('endsOn', value ? null : draft.startsOn)} />
    {draft.endsOn !== null ? <CivilField label="Važi do, uključujući datum" mode="date" value={draft.endsOn} onChange={value => set('endsOn', value)} /> : null}
    <CalendarField label="Naziv termina (opciono)" value={draft.label} onChange={value => set('label', value)} />
    <Toggle label="Termin je aktivan" value={draft.active} change={value => set('active', value)} />
  </EditorSheet>;
}

function WindowEditor({ window, timezone, close, accept }: {
  window: AvailabilityWindow | null; timezone: string; close: () => void; accept: (value: AvailabilityWindow) => void;
}) {
  const initialStart = window ? zonedParts(new Date(window.startsAt), timezone) : { date: '', time: '' };
  const initialEnd = window ? zonedParts(new Date(window.endsAt), timezone) : { date: '', time: '' };
  const [start, setStart] = useState(initialStart), [end, setEnd] = useState(initialEnd);
  const [changedStart, setChangedStart] = useState(false);
  const [changedEnd, setChangedEnd] = useState(false);
  const [state, setState] = useState<AvailabilityWindow['state']>(window?.state ?? 'UNAVAILABLE');
  const [label, setLabel] = useState(window?.label ?? '');
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    // Editing one endpoint must preserve the other endpoint's exact saved instant,
    // including fractional seconds and its chosen occurrence of a repeated DST time.
    const from = window && !changedStart ? { value: window.startsAt, error: null } : civilInstant(start.date, start.time, timezone);
    const to = window && !changedEnd ? { value: window.endsAt, error: null } : civilInstant(end.date, end.time, timezone);
    if (!from.value || !to.value) { setError(from.error ?? to.error); return; }
    const item = { id: window?.id ?? noviUuidZahtevId(), startsAt: from.value, endsAt: to.value, state, label };
    const valid = normalizeWorkerAvailability({ timezone, availableNow: false, rules: [], windows: [item] });
    if (!valid) { setError('Kraj posebnog termina mora biti posle početka.'); return; }
    accept(valid.windows[0]);
  };
  return <EditorSheet title="Poseban datum" close={close} footer={<>{error ? <T accessibilityRole="alert" tone="danger">{error}</T> : null}<Button label="Primeni izuzetak" onPress={submit} full /><Button label="Odustani od izuzetka" kind="quiet" onPress={close} full /></>}>
    {/* The sheet is already titled "Poseban datum"; the eyebrow and a second title over it only said where you are. */}
    <T tone="muted">{`Redovni termini ostaju sačuvani. ${scheduleZone(timezone)}.`}</T>
    <CivilField label="Početni datum izuzetka" mode="date" value={start.date} onChange={value => { setStart(current => ({ ...current, date: value })); setChangedStart(true); }} />
    <CivilField label="Početak izuzetka" mode="time" value={start.time} onChange={value => { setStart(current => ({ ...current, time: value })); setChangedStart(true); }} />
    <CivilField label="Završni datum izuzetka" mode="date" value={end.date} onChange={value => { setEnd(current => ({ ...current, date: value })); setChangedEnd(true); }} />
    <CivilField label="Kraj izuzetka" mode="time" value={end.time} onChange={value => { setEnd(current => ({ ...current, time: value })); setChangedEnd(true); }} />
    <View style={s.row}>{(['UNAVAILABLE', 'AVAILABLE'] as const).map(option => <Press key={option} accessibilityRole="radio"
      accessibilityLabel={option === 'AVAILABLE' ? 'Slobodno za rad' : 'Zauzeto'} accessibilityState={{ selected: state === option }}
      onPress={() => setState(option)} style={[s.option, { flexGrow: 1, borderColor: state === option ? sys.color.green : sys.color.line, backgroundColor: state === option ? sys.color.greenSoft : sys.color.surface }]}>
      <T>{option === 'AVAILABLE' ? 'Slobodno za rad' : 'Zauzeto'}</T>
    </Press>)}</View>
    <CalendarField label="Naziv izuzetka (opciono)" value={label} onChange={setLabel} />
    <View style={[s.note, { backgroundColor: sys.color.warnSoft }]}><T variant="meta">Poseban datum ne otkazuje postojeće Dogovore. Potvrđen termin ostaje obaveza.</T></View>
  </EditorSheet>;
}

export function AvailabilityForm({ availability, busy, uncertain, onSave, candidateMode = false, profileDraft = false, refreshing = false, onRefresh }: {
  availability: WorkerAvailabilityInput; busy: boolean; uncertain: boolean; onSave: (value: WorkerAvailabilityInput) => void;
  candidateMode?: boolean;
  /** The work profile is still a draft, so nothing here changes what is offered yet. */
  profileDraft?: boolean;
  /** Pull to read the saved state again (it replaced a standing "Osveži dostupnost" button). Edits wait while it reads. */
  refreshing?: boolean; onRefresh?: () => void;
}) {
  const [draft, setDraft] = useState<WorkerAvailabilityInput>(() => ({ timezone: availability.timezone,
    availableNow: availability.availableNow, rules: availability.rules, windows: availability.windows }));
  const [dirty, setDirty] = useState(false), [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AvailabilityRule | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [showWindows, setShowWindows] = useState(false), [showStatusHelp, setShowStatusHelp] = useState(false);
  const [windowEditor, setWindowEditor] = useState<{ value: AvailabilityWindow | null } | null>(null);
  useEffect(() => {
    // An idempotent accepted receipt can keep the same revision while ending this edit.
    setDraft({ timezone: availability.timezone, availableNow: availability.availableNow,
      rules: availability.rules, windows: availability.windows });
    setDirty(false); setError(null); setEditing(null); setWindowEditor(null);
  }, [availability]);
  const blocked = busy || uncertain || refreshing;
  const update = (value: Partial<WorkerAvailabilityInput>) => {
    if (blocked) return;
    setDraft(current => ({ ...current, ...value })); setDirty(true); setError(null);
  };
  const deleteItem = (kind: 'rules' | 'windows', id: string) => {
    if (blocked) return;
    Alert.alert('Ukloniti termin?', 'Promena će se sačuvati tek kada sačuvaš dostupnost. Dogovori ostaju nepromenjeni.', [
      { text: 'Odustani', style: 'cancel' }, { text: 'Ukloni', style: 'destructive', onPress: () => update({ [kind]: draft[kind].filter(item => item.id !== id) }) },
    ]);
  };
  const save = () => {
    if (blocked || !dirty || editing || windowEditor) return;
    const normalized = normalizeWorkerAvailability(draft);
    if (!normalized) { setError('Proveri unetu vremensku zonu i raspored.'); return; }
    onSave(normalized);
  };
  const editRule = (rule?: AvailabilityRule, day?: number) => {
    if (blocked) return;
    setEditing(rule ?? { id: noviUuidZahtevId(), weekdays: day === undefined ? [] : [day], startTime: '', endTime: '',
      startsOn: zonedParts(new Date(), draft.timezone).date, endsOn: null, label: '', active: true });
  };
  return <View style={{ flex: 1 }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={sys.color.green} colors={[sys.color.green]} /> : undefined}>
      {/* The screen is already named at its top edge. Repeating the name here, with a second title
          under it, pushed the first weekday past halfway down the screen. */}
      <T tone="muted">{candidateMode ? 'Promene ulaze u pregled profila. Profil čuvaš jednim završnim korakom.' : 'Odredi kada možeš da uskočiš. Potvrđeni Dogovori ostaju obaveze.'}</T>
      <View style={s.note}>
        <Toggle label="Mogu odmah" value={draft.availableNow} disabled={blocked} change={value => update({ availableNow: value })} />
        <T variant="meta" tone="muted">{profileDraft
          ? 'Radni profil je nacrt, pa ovaj status još nikome ništa ne govori. Aktiviraj profil da počne da važi.'
          : 'Ručni status · menja se tek kada sačuvaš dostupnost.'}</T>
        <Press accessibilityRole="button" accessibilityLabel="O statusu Mogu odmah" accessibilityState={{ expanded: showStatusHelp }}
          onPress={() => setShowStatusHelp(value => !value)} style={[s.row, { minHeight: 44 }]}>
          <T variant="meta" style={{ flex: 1, fontWeight: '600' }}>Šta znači ovaj status?</T>
          {showStatusHelp ? <CaretUp size={18} color={sys.color.ink} /> : <CaretDown size={18} color={sys.color.ink} />}
        </Press>
        {showStatusHelp ? <T variant="meta">Ovaj izbor ostaje sačuvan dok ga ne promeniš. Ne uključuje HITNO i ne potvrđuje novi Dogovor.</T> : null}
      </View>
      <View style={{ gap: 12 }}><View style={{ gap: 4 }}><T variant="heading" accessibilityRole="header">Redovna nedelja</T>
        <T variant="meta" tone="muted">{`${scheduleZone(draft.timezone)}.`}</T></View>
        <View style={[s.card, { padding: 0, gap: 0, overflow: 'hidden' }]}>{weekdays.map((day, index) => {
          const rules = draft.rules.filter(rule => rule.weekdays.includes(day.day)), expanded = expandedDay === day.day;
          // Minutes only: the stored "09:00:00.123456" stays exact, the screen (and TalkBack) says "09:00".
          const range = (rule: AvailabilityRule) => `${civilClock(rule.startTime)}–${civilClock(rule.endTime)}${!rule.active ? ' · Pauzirano' : ''}`;
          return <View key={day.day} style={{ borderTopWidth: index ? 1 : 0, borderColor: sys.color.line }}>
            <View style={[s.row, { paddingHorizontal: 14, gap: 4 }]}>
              <Press accessibilityRole="button" accessibilityLabel={`Prikaži termine — ${day.name}`} accessibilityState={{ expanded }}
                onPress={() => setExpandedDay(expanded ? null : day.day)} style={{ flex: 1, minHeight: 70, paddingVertical: 12, gap: 4 }}>
                <T variant="bodyStrong">{day.name}</T>
                <T variant="meta" tone="muted" numberOfLines={expanded ? undefined : 2}>{rules.length
                  ? rules.map(range).join(' · ')
                  : 'Nema redovnih termina'}</T>
              </Press>
              <Press accessibilityRole="button" accessibilityLabel={`Dodaj — ${day.name}`} accessibilityState={{ disabled: blocked }}
                disabled={blocked} onPress={() => editRule(undefined, day.day)} style={s.icon}><Plus size={20} color={sys.color.green} /></Press>
            </View>
            {expanded ? <View style={{ paddingHorizontal: 14, paddingBottom: 12, gap: 12 }}>
              {rules.length ? rules.map(rule => <View key={rule.id} style={[s.note, { padding: 12, gap: 6 }]}>
                <T variant="bodyStrong">{range(rule)}</T>
                {rule.label ? <T variant="meta">{rule.label}</T> : null}
                <T variant="meta" tone="muted">{`Od ${civilDay(rule.startsOn)}${rule.endsOn ? ` do ${civilDay(rule.endsOn)}` : ' · bez završnog datuma'}`}</T>
                {rule.weekdays.length > 1 ? <T variant="meta" tone="muted">Zajednički termin: {weekdays.filter(item => rule.weekdays.includes(item.day)).map(item => item.short).join(', ')}</T> : null}
                <View style={[s.row, { justifyContent: 'flex-end' }]}>
                  <Press accessibilityRole="button" accessibilityLabel={`Uredi ${day.name} ${civilClock(rule.startTime)}`} disabled={blocked} onPress={() => editRule(rule)} style={s.icon}><PencilSimple size={21} color={sys.color.ink} /></Press>
                  <Press accessibilityRole="button" accessibilityLabel={`Ukloni ${day.name} ${civilClock(rule.startTime)}`} disabled={blocked} onPress={() => deleteItem('rules', rule.id)} style={s.icon}><Trash size={21} color={sys.color.danger} /></Press>
                </View>
              </View>) : <T variant="meta" tone="muted">Dodaj jedan ili više termina za ovaj dan.</T>}
            </View> : null}
          </View>;
        })}</View>
      </View>
      <View style={{ gap: 12 }}>
        <Press accessibilityRole="button" accessibilityLabel="Prikaži posebne datume" accessibilityState={{ expanded: showWindows }}
          onPress={() => setShowWindows(value => !value)} style={[s.row, { minHeight: 48 }]}>
          <View style={{ flex: 1, gap: 4 }}><T variant="heading" accessibilityRole="header">Posebni datumi</T>
            <T variant="meta" tone="muted">{draft.windows.length ? plural(draft.windows.length, 'poseban datum', 'posebna datuma', 'posebnih datuma') : 'Nema posebnih datuma.'}</T></View>
          {showWindows ? <CaretUp size={20} color={sys.color.ink} /> : <CaretDown size={20} color={sys.color.ink} />}
        </Press>
        {showWindows ? [...draft.windows].sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map(window => {
          // In the schedule's own zone, written the one way the app writes a moment ("11. sep · 09:30–12:00").
          const day = civilDay(zonedParts(new Date(window.startsAt), draft.timezone).date);
          return <View key={window.id} style={s.item}><T variant="bodyStrong">{window.state === 'AVAILABLE' ? 'Slobodno za rad' : 'Zauzeto'}</T>
            <T>{raspon(window.startsAt, window.endsAt, { zona: draft.timezone })}</T>{window.label ? <T variant="meta" tone="muted">{window.label}</T> : null}
            <View style={s.row}><Button label={`Uredi izuzetak ${day}`} kind="quiet" disabled={blocked} onPress={() => { if (!blocked) setWindowEditor({ value: window }); }} />
              <Button label={`Ukloni izuzetak ${day}`} kind="destructive" disabled={blocked} onPress={() => deleteItem('windows', window.id)} /></View>
          </View>;
        }) : null}
        <Button label="Dodaj izuzetak" kind="secondary" disabled={blocked} onPress={() => { if (!blocked) setWindowEditor({ value: null }); }} />
        <T variant="meta" tone="muted">Posebni datumi imaju prednost nad nedeljom. Ne otkazuju postojeće Dogovore.</T>
      </View>
    </ScrollView>
    <View style={s.footer}>
      {error ? <T accessibilityRole="alert" tone="danger">{error}</T> : null}
      {/* A disabled Save says enough by itself; the line that explained the button is gone (owner rule, 2026-09-23). */}
      {dirty ? <T variant="meta" tone="muted" accessibilityLiveRegion="polite">Imaš nesačuvane izmene.</T> : null}
      {uncertain ? <T variant="meta" tone="muted">Prvo učitaj sačuvano stanje. Ishod izmene još nije potvrđen.</T> : null}
      <Button label={busy ? 'Čuvamo unos…' : candidateMode ? 'Primeni na pregled profila' : 'Sačuvaj dostupnost'} disabled={blocked || !dirty || !!editing || !!windowEditor} onPress={save} full />
      {dirty ? <Button label="Odustani od izmena" kind="quiet" disabled={blocked} onPress={() => {
        if (blocked) return;
        setDraft({ timezone: availability.timezone, availableNow: availability.availableNow, rules: availability.rules, windows: availability.windows }); setDirty(false); setError(null);
      }} full /> : null}
    </View>
    {editing && !blocked ? <RuleEditor rule={editing} timezone={draft.timezone} close={() => setEditing(null)} accept={rules => {
      update({ rules: [...draft.rules.filter(rule => rule.id !== editing.id), ...rules] }); setEditing(null);
    }} /> : null}
    {windowEditor && !blocked ? <WindowEditor window={windowEditor.value} timezone={draft.timezone} close={() => setWindowEditor(null)} accept={window => {
      update({ windows: [...draft.windows.filter(item => item.id !== window.id), window] }); setWindowEditor(null);
    }} /> : null}
  </View>;
}
