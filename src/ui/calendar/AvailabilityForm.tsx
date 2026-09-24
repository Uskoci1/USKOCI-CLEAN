import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, RefreshControl, ScrollView, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import { CaretDown, Check, Plus, Trash } from 'phosphor-react-native';
import type { AvailabilityRule, AvailabilityWindow, WorkerAvailabilityInput } from '../../contracts/workerAvailability';
import { calendarInstant } from '../../lib/calendarTime';
import { normalizeWorkerAvailability, sameWorkerAvailability } from '../../lib/workerAvailability';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { raspon, zonaTelefona } from '../../lib/vreme';
import { brandAction, card, sys } from '../system/tokens';
import { Press } from '../Press';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { Disclosure } from '../system/Disclosure';
import { ProductSheet } from '../product/ProductSheet';
import { useConfirmSheet } from '../system/ConfirmSheet';
import { useReducedMotion } from '../system/motion';
import { useTextScale } from '../system/textScale';
import { CalendarField, CivilField, calendarStyles } from './CalendarControls';
import { civilClock, civilDay, civilInstant, scheduleZone, shiftDate, showScheduleZone, weekdays, zonedParts } from './calendarPresentation';
import { copyDay } from './weekCopy';

type Weekday = (typeof weekdays)[number];
const WORKDAYS = [1, 2, 3, 4, 5];

/** A slot as a person reads it: minutes only ("09:00", never "09:00:00.123456"); the stored value stays exact. */
const clocks = (rule: AvailabilityRule) => `${civilClock(rule.startTime)}–${civilClock(rule.endTime)}`;
const range = (rule: AvailabilityRule) => `${clocks(rule)}${!rule.active ? ' · Pauzirano' : ''}`;
const validity = (rule: Pick<AvailabilityRule, 'startsOn' | 'endsOn'>) =>
  `Od ${civilDay(rule.startsOn)}${rule.endsOn ? ` do ${civilDay(rule.endsOn)}` : ' · bez završnog datuma'}`;
/** "Utorak", "Utorak i Sreda", "Utorak, Sreda i Četvrtak". */
const names = (days: readonly Weekday[]) => days.length < 2 ? days[0]?.name ?? ''
  : `${days.slice(0, -1).map(day => day.name).join(', ')} i ${days[days.length - 1].name}`;
const dayOf = (value: number) => weekdays.find(day => day.day === value) ?? weekdays[0];
function seconds(value: string) {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}(?:\.\d{1,6})?))?$/.exec(value);
  return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0) : NaN;
}
/** The four fields the form edits, without the account, profile and revision a saved value carries. */
const fields = (value: WorkerAvailabilityInput): WorkerAvailabilityInput =>
  ({ timezone: value.timezone, availableNow: value.availableNow, rules: value.rules, windows: value.windows });

/** The one switch look: green track when on, the strong hairline when off, and a white thumb in both (B19: not teal). */
function FormSwitch({ label, hint, value, change, disabled }: {
  label: string; hint?: string; value: boolean; change: (value: boolean) => void; disabled?: boolean;
}) {
  return <Switch accessibilityLabel={label} accessibilityHint={hint} value={value} onValueChange={change} disabled={disabled}
    trackColor={{ true: sys.color.green, false: sys.color.lineStrong }} thumbColor={sys.color.surface} ios_backgroundColor={sys.color.lineStrong} />;
}
function ToggleRow({ label, value, change, disabled }: { label: string; value: boolean; change: (value: boolean) => void; disabled?: boolean }) {
  return <View style={s.toggleRow}><T style={s.grow}>{label}</T><FormSwitch label={label} value={value} change={change} disabled={disabled} /></View>;
}
/** Two fields side by side where they fit, one under the other on a narrow screen or at a large text size. */
function Pair({ children }: { children: [ReactNode, ReactNode] }) {
  const { width } = useWindowDimensions(), scale = useTextScale();
  const side = width >= 360 && scale < 1.3;
  return <View style={side ? s.pair : s.stack}>{children.map((child, index) => <View key={index} style={side ? s.grow : null}>{child}</View>)}</View>;
}
/** The footer of a sheet: its error said where the command is, the one primary, and a quiet way out that discards. */
function SheetFooter({ error, primary, onPrimary, cancel, onCancel, disabled, reason }: {
  error?: string | null; primary: string; onPrimary: () => void; cancel: string; onCancel: () => void; disabled?: boolean; reason?: string | null;
}) {
  return <>
    {error ? <T variant="note" tone="danger" accessibilityRole="alert">{error}</T> : null}
    <V2Action label={primary} style={brandAction} onPress={onPrimary} disabled={disabled} reason={reason} />
    <V2Action label={cancel} kind="quiet" onPress={onCancel} />
  </>;
}

/** Down when closed, up when open. The shared turning caret lives in Disclosure and is not exported yet. */
function Caret({ open }: { open: boolean }) {
  return <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}><CaretDown size={20} color={sys.color.muted} /></View>;
}

/**
 * Novi / Izmeni termin: the days, the two times, and the rarely changed dates, name and pause behind "Više podešavanja".
 * Nothing is saved here: "Primeni termin" changes the draft, and the screen's Save writes it. An end before the start is
 * work over midnight, stored as two intervals on adjacent days.
 */
export function RuleSheet({ rule, isNew, timezone, phoneZone, close, accept }: {
  rule: AvailabilityRule; isNew: boolean; timezone: string; phoneZone: string | undefined;
  close: () => void; accept: (rules: readonly AvailabilityRule[]) => void;
}) {
  const reduced = useReducedMotion();
  const [draft, setDraft] = useState(rule);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof AvailabilityRule>(key: K, value: AvailabilityRule[K]) => { setError(null); setDraft(current => ({ ...current, [key]: value })); };
  const submit = (dismiss: () => void) => {
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
    accept(valid.rules); dismiss();
  };
  const startSeconds = seconds(draft.startTime), endSeconds = seconds(draft.endTime);
  const overnight = Number.isFinite(startSeconds) && Number.isFinite(endSeconds) && endSeconds < startSeconds;
  const toggleDay = (day: number) => set('weekdays', draft.weekdays.includes(day) ? draft.weekdays.filter(value => value !== day) : [...draft.weekdays, day]);
  const circle = (day: Weekday) => {
    const on = draft.weekdays.includes(day.day);
    return <Press key={day.day} accessibilityRole="checkbox" accessibilityLabel={day.name} accessibilityState={{ checked: on }}
      haptic="select" onPress={() => toggleDay(day.day)} style={[s.circle, on ? s.circleOn : s.circleOff]}>
      <T variant="tab" style={{ color: on ? sys.color.onDark : sys.color.ink }}>{day.short}</T>
    </Press>;
  };
  return <ProductSheet title={isNew ? 'Novi termin' : 'Izmeni termin'} closeButton={false} reduced={reduced} dirty={draft !== rule} onClose={close}
    footer={dismiss => <SheetFooter error={error} primary="Primeni termin" onPrimary={() => submit(dismiss)} cancel="Odustani od termina" onCancel={dismiss} />}>
    {() => <>
      <View style={s.days}>
        <T variant="meta" tone="muted">Dani</T>
        <View style={s.circles}>{weekdays.slice(0, 5).map(circle)}</View>
        <View style={s.circles}>{weekdays.slice(5).map(circle)}</View>
      </View>
      <Pair>{[<CivilField key="start" label="Početak termina" mode="time" value={draft.startTime} onChange={value => set('startTime', value)} />,
        <CivilField key="end" label="Kraj termina" mode="time" value={draft.endTime} onChange={value => set('endTime', value)} />]}</Pair>
      {overnight ? <T variant="note" tone="muted">Kraj pre početka znači rad preko ponoći. Čuva se kao dva intervala u susednim danima.</T> : null}
      {showScheduleZone(timezone, phoneZone) ? <T variant="note" tone="muted">{`${scheduleZone(timezone)}.`}</T> : null}
      <Disclosure label="Više podešavanja" hint={`${validity(draft)}${draft.active ? '' : ' · Pauzirano'}`} divider>
        <CivilField label="Važi od" mode="date" value={draft.startsOn} onChange={value => set('startsOn', value)} />
        <ToggleRow label="Bez završnog datuma" value={draft.endsOn === null} change={value => set('endsOn', value ? null : draft.startsOn)} />
        {draft.endsOn !== null ? <CivilField label="Važi do, uključujući datum" mode="date" value={draft.endsOn} onChange={value => set('endsOn', value)} /> : null}
        <CalendarField label="Naziv termina (opciono)" value={draft.label} onChange={value => set('label', value)} />
        <ToggleRow label="Termin je aktivan" value={draft.active} change={value => set('active', value)} />
      </Disclosure>
    </>}
  </ProductSheet>;
}

/**
 * Poseban datum: busy or free for a stretch of time, which takes precedence over the regular week. Editing one end keeps
 * the other end's exact saved instant (fractional seconds, and which of two repeated clock times it was).
 */
export function WindowSheet({ window, timezone, phoneZone, close, accept }: {
  window: AvailabilityWindow | null; timezone: string; phoneZone: string | undefined;
  close: () => void; accept: (value: AvailabilityWindow) => void;
}) {
  const reduced = useReducedMotion();
  const initialStart = window ? zonedParts(new Date(window.startsAt), timezone) : { date: '', time: '' };
  const initialEnd = window ? zonedParts(new Date(window.endsAt), timezone) : { date: '', time: '' };
  const [start, setStart] = useState(initialStart), [end, setEnd] = useState(initialEnd);
  const [changedStart, setChangedStart] = useState(false);
  const [changedEnd, setChangedEnd] = useState(false);
  const [state, setState] = useState<AvailabilityWindow['state']>(window?.state ?? 'UNAVAILABLE');
  const [label, setLabel] = useState(window?.label ?? '');
  const [error, setError] = useState<string | null>(null);
  const dirty = changedStart || changedEnd || state !== (window?.state ?? 'UNAVAILABLE') || label !== (window?.label ?? '');
  const submit = (dismiss: () => void) => {
    // Editing one endpoint must preserve the other endpoint's exact saved instant,
    // including fractional seconds and its chosen occurrence of a repeated DST time.
    const from = window && !changedStart ? { value: window.startsAt, error: null } : civilInstant(start.date, start.time, timezone);
    const to = window && !changedEnd ? { value: window.endsAt, error: null } : civilInstant(end.date, end.time, timezone);
    if (!from.value || !to.value) { setError(from.error ?? to.error); return; }
    const item = { id: window?.id ?? noviUuidZahtevId(), startsAt: from.value, endsAt: to.value, state, label };
    const valid = normalizeWorkerAvailability({ timezone, availableNow: false, rules: [], windows: [item] });
    if (!valid) { setError('Kraj posebnog termina mora biti posle početka.'); return; }
    accept(valid.windows[0]); dismiss();
  };
  const startDate = (value: string) => {
    setError(null); setStart(current => ({ ...current, date: value })); setChangedStart(true);
    // A new special date usually ends the day it starts: the end date takes the same day while it is still empty.
    if (!window) setEnd(current => current.date ? current : { ...current, date: value });
  };
  const option = (value: AvailabilityWindow['state']) => {
    const chosen = state === value, text = value === 'AVAILABLE' ? 'Slobodno za rad' : 'Zauzeto';
    return <Press key={value} accessibilityRole="radio" accessibilityLabel={text} accessibilityState={{ selected: chosen }} haptic="select"
      onPress={() => { setError(null); setState(value); }} style={[calendarStyles.option, s.grow, chosen && s.optionOn]}>
      <T variant={chosen ? 'bodyStrong' : 'body'} style={{ color: chosen ? sys.color.green : sys.color.ink }}>{text}</T>
    </Press>;
  };
  return <ProductSheet title="Poseban datum" closeButton={false} reduced={reduced} dirty={dirty} onClose={close}
    footer={dismiss => <SheetFooter error={error} primary="Primeni izuzetak" onPrimary={() => submit(dismiss)} cancel="Odustani od izuzetka" onCancel={dismiss} />}>
    {() => <>
      <View style={s.options}>{option('UNAVAILABLE')}{option('AVAILABLE')}</View>
      <Pair>{[<CivilField key="date" label="Početni datum izuzetka" mode="date" value={start.date} onChange={startDate} />,
        <CivilField key="time" label="Početak izuzetka" mode="time" value={start.time}
          onChange={value => { setError(null); setStart(current => ({ ...current, time: value })); setChangedStart(true); }} />]}</Pair>
      <Pair>{[<CivilField key="date" label="Završni datum izuzetka" mode="date" value={end.date}
        onChange={value => { setError(null); setEnd(current => ({ ...current, date: value })); setChangedEnd(true); }} />,
        <CivilField key="time" label="Kraj izuzetka" mode="time" value={end.time}
          onChange={value => { setError(null); setEnd(current => ({ ...current, time: value })); setChangedEnd(true); }} />]}</Pair>
      <CalendarField label="Naziv izuzetka (opciono)" value={label} onChange={value => { setError(null); setLabel(value); }} />
      <T variant="note" tone="muted">{`Redovni termini ostaju sačuvani.${showScheduleZone(timezone, phoneZone) ? ` ${scheduleZone(timezone)}.` : ''}`}</T>
      <T variant="note" tone="muted">Poseban datum ima prednost nad redovnom nedeljom i ne otkazuje postojeće Dogovore. Potvrđen termin ostaje obaveza.</T>
    </>}
  </ProductSheet>;
}

/** Kopiraj termine: one day's slots onto the chosen days, which lose their own. Nothing is saved here either. */
export function CopySheet({ source, rules, close, apply }: {
  source: Weekday; rules: readonly AvailabilityRule[]; close: () => void; apply: (targets: number[]) => void;
}) {
  const reduced = useReducedMotion();
  const [chosen, setChosen] = useState<number[]>([]);
  const summary = rules.filter(rule => rule.weekdays.includes(source.day)).map(range).join(' · ');
  const replacing = chosen.some(day => rules.some(rule => rule.weekdays.includes(day) && !rule.weekdays.includes(source.day)));
  const toggle = (day: number) => setChosen(list => list.includes(day) ? list.filter(value => value !== day) : [...list, day]);
  return <ProductSheet title="Kopiraj termine" closeButton={false} reduced={reduced} dirty={chosen.length > 0} onClose={close}
    footer={dismiss => <SheetFooter primary="Kopiraj" disabled={!chosen.length} reason={chosen.length ? null : 'Izaberi bar jedan dan.'}
      onPrimary={() => { if (!chosen.length) return; apply(chosen); dismiss(); }} cancel="Odustani" onCancel={dismiss} />}>
    {() => <>
      <T variant="note" tone="muted">{`${source.name}: ${summary}`}</T>
      <View>{weekdays.filter(day => day.day !== source.day).map(day => {
        const on = chosen.includes(day.day);
        return <Press key={day.day} accessibilityRole="checkbox" accessibilityLabel={day.name} accessibilityState={{ checked: on }}
          haptic="select" onPress={() => toggle(day.day)} style={s.check}>
          <View style={[s.box, on && s.boxOn]}>{on ? <Check size={16} weight="bold" color={sys.color.onDark} /> : null}</View>
          <T style={s.grow}>{day.name}</T>
        </Press>;
      })}</View>
      {replacing ? <T variant="note" tone="muted">Postojeći termini izabranih dana se zamenjuju.</T> : null}
    </>}
  </ProductSheet>;
}

/** The footer arrives with a short rise on a real change of state, and at once under reduced motion; it leaves at once. */
function FooterIn({ reduced, children }: { reduced: boolean; children: ReactNode }) {
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { progress.setValue(1); return; }
    const run = Animated.timing(progress, { toValue: 1, duration: sys.motion.enter, easing: Easing.bezier(...sys.motion.easeOut), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [progress, reduced]);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  return <Animated.View style={[calendarStyles.footer, { opacity: progress, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/**
 * Dostupnost za rad: the manual "Mogu odmah" status, the regular week and the special dates, saved as ONE whole
 * document with the expected revision. The screen's one primary is Save, and it exists only while something has
 * changed: the footer appears with the first change and goes when the change is undone. Nothing is written by a
 * switch or a sheet; they change the draft.
 */
export function AvailabilityForm({ availability, busy, uncertain, onSave, candidateMode = false, profileDraft = false, refreshing = false,
  onRefresh, problem = null, onReconcile, saved = false, onDirtyChange, phoneZone = zonaTelefona() }: {
  availability: WorkerAvailabilityInput; busy: boolean; uncertain: boolean; onSave: (value: WorkerAvailabilityInput) => void;
  candidateMode?: boolean;
  /** The work profile is still a draft, so nothing here changes what is offered yet. */
  profileDraft?: boolean;
  /** Pull to read the saved state again (it replaced a standing "Osveži dostupnost" button). Edits wait while it reads. */
  refreshing?: boolean; onRefresh?: () => void;
  /** What went wrong with the last read or write, in the owner's words (the route's editor error). */
  problem?: string | null;
  /** Read the saved state after an unconfirmed outcome; without it the form only says that it must be read first. */
  onReconcile?: () => void;
  /** The last write was confirmed by its receipt: the footer says so for a moment. */
  saved?: boolean;
  /** Told whether there are unsaved changes, so the screen can ask before they are dropped. */
  onDirtyChange?: (dirty: boolean) => void;
  /** The phone's zone; the schedule's zone is said only when it or the phone is outside Serbian time. */
  phoneZone?: string;
}) {
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions(), scale = useTextScale();
  const stacked = width < 360 || scale >= 1.3;
  const baseline = useMemo(() => fields(availability), [availability]);
  const [draft, setDraft] = useState<WorkerAvailabilityInput>(baseline);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ rule: AvailabilityRule; isNew: boolean; day: number | null } | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [windowEditor, setWindowEditor] = useState<{ value: AvailabilityWindow | null } | null>(null);
  const [copySource, setCopySource] = useState<Weekday | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const confirmation = useConfirmSheet({ reduced });
  useEffect(() => {
    // An idempotent accepted receipt can keep the same revision while ending this edit.
    setDraft(fields(availability));
    setError(null); setEditing(null); setWindowEditor(null); setCopySource(null);
  }, [availability]);
  // Derived, not a sticky flag: a change that is undone is no change, and the footer goes with it. Both sides are
  // compared in their normal form (rules and windows sorted by id), as the save would send them.
  const dirty = useMemo(() => !sameWorkerAvailability(normalizeWorkerAvailability(draft) ?? draft,
    normalizeWorkerAvailability(baseline) ?? baseline), [draft, baseline]);
  const report = useRef(onDirtyChange); report.current = onDirtyChange;
  useEffect(() => { report.current?.(dirty); }, [dirty]);
  useEffect(() => () => report.current?.(false), []);
  useEffect(() => {
    if (!saved) { setShowSaved(false); return; }
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [saved]);
  const blocked = busy || uncertain || refreshing;
  const sheetOpen = !!editing || !!windowEditor || !!copySource;
  const update = (value: Partial<WorkerAvailabilityInput>) => {
    if (blocked) return;
    setDraft(current => ({ ...current, ...value })); setError(null);
  };
  const deleteItem = (kind: 'rules' | 'windows', id: string) => {
    if (blocked) return;
    confirmation.ask({ title: 'Ukloniti termin?', message: 'Promena će se sačuvati tek kada sačuvaš dostupnost. Dogovori ostaju nepromenjeni.',
      cancelLabel: 'Odustani', confirmLabel: 'Ukloni', tone: 'danger', onConfirm: () => update({ [kind]: draft[kind].filter(item => item.id !== id) }) });
  };
  const save = () => {
    if (blocked || !dirty || sheetOpen) return;
    const normalized = normalizeWorkerAvailability(draft);
    if (!normalized) { setError('Proveri unetu vremensku zonu i raspored.'); return; }
    onSave(normalized);
  };
  const discard = () => { if (blocked) return; setDraft(baseline); setError(null); };
  const editRule = (rule?: AvailabilityRule, day?: number) => {
    if (blocked) return;
    setEditing(rule ? { rule, isNew: false, day: null } : { isNew: true, day: day ?? null, rule: { id: noviUuidZahtevId(),
      weekdays: day === undefined ? [] : [day], startTime: '', endTime: '', startsOn: zonedParts(new Date(), draft.timezone).date,
      endsOn: null, label: '', active: true } });
  };
  const copy = (source: Weekday, targets: readonly number[], announce: string) => {
    update({ rules: copyDay(draft.rules, source.day, targets) });
    AccessibilityInfo.announceForAccessibility(announce);
  };
  const sameForWorkdays = (source: Weekday) => {
    if (blocked) return;
    const targets = WORKDAYS.filter(day => day !== source.day);
    const replaces = targets.some(day => draft.rules.some(rule => rule.weekdays.includes(day) && !rule.weekdays.includes(source.day)));
    const apply = () => copy(source, targets, 'Termini su kopirani na radne dane.');
    if (!replaces) { apply(); return; }
    confirmation.ask({ title: 'Zameniti termine?', confirmLabel: 'Zameni', cancelLabel: 'Odustani', onConfirm: apply,
      message: `${names(targets.map(dayOf))} ${targets.length === 1 ? 'dobija' : 'dobijaju'} termine kao ${source.name}. Promena će se sačuvati tek kada sačuvaš dostupnost.` });
  };
  // A pull reads the saved state again, and the new value resets the form (the effect above). With unsaved edits, a
  // pull made while scrolling up would throw them away unasked, so it does nothing until they are saved or discarded.
  // The control stays mounted (removing it re-creates the Android scroll view and loses the position): `enabled`
  // stops the Android gesture, the check in reload() stops an iOS pull. A screen reader reaches the same read as an
  // action on the list, since the standing refresh button is gone.
  const reload = () => { if (!dirty) onRefresh?.(); };
  const hint = profileDraft
    ? 'Radni profil je nacrt, pa ovaj status još nikome ništa ne govori. Aktiviraj profil da počne da važi.'
    : 'Ručni status: važi dok ga ne promeniš. Ne uključuje HITNO i ne potvrđuje novi Dogovor.';
  const now = BigInt(Date.now()) * 1000n;
  const past = (window: AvailabilityWindow) => (calendarInstant(window.endsAt) ?? 0n) <= now;
  const start = (window: AvailabilityWindow) => calendarInstant(window.startsAt) ?? 0n;
  // Current and coming dates first, soonest first; then the past ones, latest first. Presentation only.
  const windows = [...draft.windows].sort((a, b) => past(a) !== past(b) ? (past(a) ? 1 : -1)
    : past(a) ? (start(a) < start(b) ? 1 : start(a) > start(b) ? -1 : 0) : (start(a) < start(b) ? -1 : start(a) > start(b) ? 1 : 0));
  const saveLabel = candidateMode ? 'Primeni na pregled profila' : 'Sačuvaj dostupnost';
  const footer = uncertain && onReconcile ? <FooterIn key="reconcile" reduced={reduced}>
    <T variant="note" tone="danger" accessibilityRole="alert">{problem ?? 'Ishod izmene još nije potvrđen.'}</T>
    {/* The explicit read bypasses the unsaved-changes gate on purpose: until it answers, nothing here can be trusted. */}
    <V2Action label="Učitaj sačuvano stanje" kind="secondary" disabled={busy || refreshing} onPress={onReconcile} />
  </FooterIn> : uncertain ? <FooterIn key="uncertain" reduced={reduced}>
    <V2Action label={saveLabel} style={brandAction} disabled reason="Prvo učitaj sačuvano stanje. Ishod izmene još nije potvrđen." onPress={save} />
  </FooterIn> : dirty || busy ? <FooterIn key="form" reduced={reduced}>
    {dirty ? <T variant="note" tone="muted" accessibilityLiveRegion="polite">Imaš nesačuvane izmene.</T> : null}
    <V2Action label={saveLabel} style={brandAction} loading={busy} disabled={blocked || sheetOpen} error={error} onPress={save} />
    <V2Action label="Odustani od izmena" kind="quiet" disabled={blocked} onPress={discard} />
  </FooterIn> : showSaved ? <FooterIn key="saved" reduced={reduced}>
    <View style={s.saved}><Check size={20} weight="bold" color={sys.color.green} />
      <T variant="bodyStrong" accessibilityRole="alert" style={{ color: sys.color.green }}>Dostupnost je sačuvana.</T></View>
  </FooterIn> : null;
  return <View style={s.fill}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}
      accessibilityActions={onRefresh && !dirty ? [{ name: 'activate', label: 'Učitaj sačuvano stanje' }] : undefined}
      onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'activate') reload(); }}
      refreshControl={onRefresh ? <RefreshControl enabled={!dirty} refreshing={refreshing} onRefresh={reload} tintColor={sys.color.green} colors={[sys.color.green]} /> : undefined}>
      <View style={s.group}>
        {candidateMode ? <T variant="note" tone="muted">Promene ulaze u pregled profila. Profil čuvaš jednim završnim korakom.</T> : null}
        {problem && !uncertain ? <T variant="note" tone="danger" accessibilityRole="alert">{problem}</T> : null}
        {/* A flat row, not a box (B19): the status, what it means, and the switch. It changes the draft only. */}
        <View style={s.status}>
          <View style={s.statusCopy}>
            <T variant="bodyStrong">Mogu odmah</T>
            <T variant="note" tone="muted">{hint}</T>
          </View>
          <FormSwitch label="Mogu odmah" hint={hint} value={draft.availableNow} disabled={blocked} change={value => update({ availableNow: value })} />
        </View>
      </View>
      <View style={s.section}>
        <View style={s.sectionHead}>
          <T variant="heading" accessibilityRole="header">Redovna nedelja</T>
          {showScheduleZone(draft.timezone, phoneZone) ? <T variant="note" tone="muted">{`${scheduleZone(draft.timezone)}.`}</T> : null}
        </View>
        <View style={s.list}>{weekdays.map((day, index) => {
          const rules = draft.rules.filter(rule => rule.weekdays.includes(day.day));
          const expanded = expandedDay === day.day && rules.length > 0;
          const summary = rules.map(range).join(' · ');
          return <View key={day.day} style={index ? s.divided : null}>
            {rules.length ? <Press accessibilityRole="button" accessibilityLabel={`Prikaži termine — ${day.name}`} accessibilityHint={summary}
              accessibilityState={{ expanded }} haptic="select" scaleTo={0.99} onPress={() => setExpandedDay(expanded ? null : day.day)} style={s.dayRow}>
              <View style={stacked ? s.dayStack : s.dayLine}>
                <T variant="bodyStrong" style={s.dayName}>{day.name}</T>
                <T variant="note" numberOfLines={expanded ? undefined : 2} style={[s.summary, stacked && s.summaryStacked]}>{summary}</T>
              </View>
              <Caret open={expanded} />
            </Press> : <Press accessibilityRole="button" accessibilityLabel={`Dodaj — ${day.name}`} accessibilityState={{ disabled: blocked }}
              disabled={blocked} haptic="select" scaleTo={0.99} onPress={() => editRule(undefined, day.day)} style={s.dayRow}>
              <View style={stacked ? s.dayStack : s.dayLine}>
                <T variant="bodyStrong" style={s.dayName}>{day.name}</T>
                <View style={[s.add, stacked && s.addStacked]}><Plus size={18} color={blocked ? sys.color.muted : sys.color.green} />
                  <T variant="bodyStrong" style={{ color: blocked ? sys.color.muted : sys.color.green }}>Dodaj</T></View>
              </View>
            </Press>}
            {expanded ? <View style={s.expanded}>
              {rules.map(rule => <View key={rule.id} style={s.ruleRow}>
                <Press accessibilityRole="button" accessibilityLabel={`Uredi ${day.name} ${civilClock(rule.startTime)}`} accessibilityState={{ disabled: blocked }}
                  disabled={blocked} haptic="select" scaleTo={0.99} onPress={() => editRule(rule)} style={s.ruleBody}>
                  <T variant="bodyStrong" tone={rule.active ? 'ink' : 'muted'}>{clocks(rule)}</T>
                  {rule.label ? <T variant="note" tone="muted">{rule.label}</T> : null}
                  <T variant="note" tone="muted">{validity(rule)}</T>
                  {rule.weekdays.length > 1 ? <T variant="note" tone="muted">{`Zajednički termin: ${weekdays.filter(item => rule.weekdays.includes(item.day)).map(item => item.short).join(', ')}`}</T> : null}
                  {!rule.active ? <T variant="note" tone="muted">Pauzirano</T> : null}
                </Press>
                <Press accessibilityRole="button" accessibilityLabel={`Ukloni ${day.name} ${civilClock(rule.startTime)}`} accessibilityState={{ disabled: blocked }}
                  disabled={blocked} haptic="select" onPress={() => deleteItem('rules', rule.id)} style={calendarStyles.icon}>
                  <Trash size={20} color={blocked ? sys.color.muted : sys.color.danger} /></Press>
              </View>)}
              <View style={s.dayActions}>
                <V2Action label="Dodaj termin" accessibilityLabel={`Dodaj — ${day.name}`} kind="quiet" disabled={blocked}
                  onPress={() => editRule(undefined, day.day)} />
                <V2Action label="Isto za sve radne dane" accessibilityLabel={`Isto za sve radne dane kao ${day.name}`} kind="quiet" disabled={blocked}
                  onPress={() => sameForWorkdays(day)} />
                <V2Action label="Kopiraj na…" accessibilityLabel={`Kopiraj ${day.name} na druge dane`} kind="quiet" disabled={blocked}
                  onPress={() => { if (!blocked) setCopySource(day); }} />
              </View>
            </View> : null}
          </View>;
        })}</View>
      </View>
      <View style={s.section}>
        <T variant="heading" accessibilityRole="header">Posebni datumi</T>
        {windows.length ? <View style={s.list}>{windows.map((window, index) => {
          // In the schedule's own zone, written the one way the app writes a moment ("11. sep · 09:30–12:00").
          const day = civilDay(zonedParts(new Date(window.startsAt), draft.timezone).date);
          const over = past(window);
          const line = [over ? 'Prošlo' : null, window.state === 'AVAILABLE' ? 'Slobodno za rad' : 'Zauzeto', window.label || null]
            .filter((part): part is string => !!part).join(' · ');
          return <View key={window.id} style={[s.windowRow, index ? s.divided : null]}>
            <Press accessibilityRole="button" accessibilityLabel={`Uredi izuzetak ${day}`} accessibilityState={{ disabled: blocked }} disabled={blocked}
              haptic="select" scaleTo={0.99} onPress={() => { if (!blocked) setWindowEditor({ value: window }); }} style={s.windowBody}>
              <T variant="bodyStrong" tone={over ? 'muted' : 'ink'}>{raspon(window.startsAt, window.endsAt, { zona: draft.timezone })}</T>
              <T variant="note" tone="muted">{line}</T>
            </Press>
            <Press accessibilityRole="button" accessibilityLabel={`Ukloni izuzetak ${day}`} accessibilityState={{ disabled: blocked }} disabled={blocked}
              haptic="select" onPress={() => deleteItem('windows', window.id)} style={calendarStyles.icon}>
              <Trash size={20} color={blocked ? sys.color.muted : sys.color.danger} /></Press>
          </View>;
        })}</View> : <T variant="note" tone="muted">Nema posebnih datuma.</T>}
        <V2Action label="Dodaj izuzetak" kind="secondary" disabled={blocked} onPress={() => { if (!blocked) setWindowEditor({ value: null }); }} />
      </View>
    </ScrollView>
    {footer}
    {editing && !blocked ? <RuleSheet rule={editing.rule} isNew={editing.isNew} timezone={draft.timezone} phoneZone={phoneZone}
      close={() => setEditing(null)} accept={rules => {
        update({ rules: [...draft.rules.filter(rule => rule.id !== editing.rule.id), ...rules] });
        // The day just filled stays open, so "Isto za sve radne dane" is one tap away.
        const first = rules[0]?.weekdays ?? [];
        const open = editing.day !== null && first.includes(editing.day) ? editing.day : weekdays.find(day => first.includes(day.day))?.day;
        if (open !== undefined) setExpandedDay(open);
      }} /> : null}
    {windowEditor && !blocked ? <WindowSheet window={windowEditor.value} timezone={draft.timezone} phoneZone={phoneZone}
      close={() => setWindowEditor(null)} accept={window => update({ windows: [...draft.windows.filter(item => item.id !== window.id), window] })} /> : null}
    {copySource && !blocked ? <CopySheet source={copySource} rules={draft.rules} close={() => setCopySource(null)}
      apply={targets => copy(copySource, targets, 'Termini su kopirani.')} /> : null}
    {confirmation.sheet}
  </View>;
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1, minWidth: 0 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 32 },
  group: { gap: 12 },
  status: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusCopy: { flex: 1, minWidth: 0, gap: 2 },
  section: { gap: 12 },
  sectionHead: { gap: 2 },
  // One card for the list, rows divided by a hairline; every inset is 16 (B19: the uneven bottom gap).
  list: { ...card, padding: 0, overflow: 'hidden' },
  divided: { borderTopWidth: 1, borderTopColor: sys.color.line },
  dayRow: { minHeight: 56, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayLine: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayStack: { flex: 1, minWidth: 0, gap: 2 },
  dayName: { flexShrink: 0 },
  summary: { flex: 1, minWidth: 0, textAlign: 'right', color: sys.color.fact },
  summaryStacked: { flex: 0, textAlign: 'left' },
  add: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  addStacked: { flex: 0, justifyContent: 'flex-start' },
  expanded: { paddingHorizontal: 16, paddingBottom: 12 },
  ruleRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleBody: { flex: 1, minWidth: 0, paddingVertical: 8, gap: 2 },
  dayActions: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: -16, marginTop: 4 },
  windowRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 4 },
  windowBody: { flex: 1, minWidth: 0, paddingVertical: 12, gap: 2 },
  saved: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pair: { flexDirection: 'row', gap: 12 },
  stack: { gap: 12 },
  days: { gap: 8 },
  circles: { flexDirection: 'row', gap: 8 },
  circle: { width: 48, height: 48, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  circleOn: { backgroundColor: sys.color.green, borderColor: sys.color.green },
  circleOff: { backgroundColor: sys.color.surface, borderColor: sys.color.lineStrong },
  options: { flexDirection: 'row', gap: 8 },
  optionOn: { borderColor: sys.color.green, backgroundColor: sys.color.greenSoft },
  check: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  box: { width: 24, height: 24, borderRadius: sys.radius.check, borderWidth: 1.5, borderColor: sys.color.lineStrong, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: sys.color.green, borderColor: sys.color.green },
});
