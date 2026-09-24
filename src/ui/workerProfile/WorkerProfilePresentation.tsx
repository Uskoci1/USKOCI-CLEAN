import { createContext, isValidElement, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Minus, Plus, X } from 'phosphor-react-native';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StanjeProfila } from '../../contracts/projections';
import { T } from '../Text';
import { Press } from '../Press';
import { DetailTopBar } from '../system/DetailTopBar';
import { ChromeIconButton } from '../system/ScreenChrome';
import { Disclosure } from '../system/Disclosure';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { PickerGrid, PickerTile } from '../system/PickerTile';
import { pictogramCatalog, type PictogramGroup } from '../system/Pictogram';
import { StateView } from '../system/StateView';
import { plural } from '../system/plural';
import { card, sys, field } from '../system/tokens';
import { SettingsRow } from '../settings/SettingsPresentation';
import { V2Action } from '../v2/V2Action';
import { hasTerm, toggleTerm, type WorkerDraft } from './workerProfileDraft';

/**
 * Frame of the worker profile: back, title, keyboard-safe body, sticky footer. `/profil/razgovor` and `/profil/lokacija`
 * draw it too, so the title can be theirs; the back says only "Nazad", because the screen is also opened from an
 * application (prijava) and Back returns there, not to the profile.
 *
 * While the software keyboard is up the sticky footer steps aside (review of step 9, 2026-09-24): on a 320 × 640 phone
 * the footer (status lines, a 54 dp primary, a quiet action or the area confirmation) rose with the keyboard and left
 * under 100 dp for the field being typed. It is hidden, not removed, so a button keeps its state and nothing is announced
 * again; it comes back as soon as the keyboard closes (Back, the return key, a drag of the body, or a tap outside the
 * field). The body keeps what the person needs while typing: the activation checklist and every field's own hint.
 *
 * A `WorkerProfileFooter` keeps its answer on screen while typing and steps aside only with its actions (round 5c): a tap
 * on a row that refuses because the draft is not saved, or a "Dopuni osnovne podatke" that focuses a field, writes its
 * sentence there, and hiding the whole footer made the tap look dead. Any other footer (the area confirmation, the AI
 * review) steps aside whole, because nothing in it answers a tap made while typing.
 */
export function WorkerProfileFrame({ back, children, footer, title = 'Veštine, alat i tim', backLabel = 'Nazad' }: {
  back: () => void; children: ReactNode; footer?: ReactNode; title?: string; backLabel?: string;
}) {
  const typing = useKeyboardShown();
  const keepsStatus = isValidElement(footer) && footer.type === WorkerProfileFooter;
  const aside = typing && !keepsStatus;
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <DetailTopBar backLabel={backLabel} title={title} onBack={back} />
    <KeyboardAvoidingView style={s.grow} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* The iOS number pad has no return key and iOS has no Back: dragging the body closes the keyboard (review 5b). */}
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentContainerStyle={s.content}>{children}</ScrollView>
      {footer ? <FooterTyping.Provider value={typing}>
        <View testID="worker-profile-footer" style={[s.footer, typing && (keepsStatus ? s.footerTyping : s.footerAside)]}
          accessibilityElementsHidden={aside} importantForAccessibility={aside ? 'no-hide-descendants' : 'auto'}>{footer}</View>
      </FooterTyping.Provider> : null}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

/** Whether the frame's footer is drawn while the keyboard is up; only `WorkerProfileFooter` reads it. */
const FooterTyping = createContext(false);

/**
 * Whether the software keyboard is up, from the keyboard's own events (iOS says it before the animation, Android after).
 * It starts false: a footer is never hidden without an event saying the keyboard is there.
 */
function useKeyboardShown() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setShown(true));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setShown(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return shown;
}

/** Reading the profile, or why it could not be read: the one state look (StateView). No draft is built from defaults. */
export function WorkerProfileStatus({ loading, error, retry }: { loading: boolean; error?: string | null; retry: () => void }) {
  if (loading) return <StateView kind="loading" title="Učitavamo radni profil…" skeleton={{ count: 3, rows: 2 }} />;
  return <StateView kind="error" title="Radni profil nije dostupan" body={error ?? undefined}
    primary={{ label: 'Ponovo učitaj profil', onPress: retry }} />;
}

/**
 * The answer to the last save, right above the button that made it: Save sits in this footer, often far below the top
 * of a long form, so a line at the top of the scroll was never seen. It is said only once the saved profile has been
 * read back (the route decides that); the button's own check confirms it for a moment.
 *
 * While the keyboard is up only the answer stays (the message and the error, with room of their own); the actions and
 * the held line step aside, mounted, so a button keeps its state and nothing is announced again (round 5c).
 */
export function WorkerProfileFooter({ message, error, held = false, children }: {
  message?: string | null; error?: string | null;
  /** An unconfirmed save is kept and only what is really saved is shown. */ held?: boolean; children: ReactNode;
}) {
  const typing = useContext(FooterTyping);
  return <>
    {message || error ? <View testID="worker-profile-answer" style={[s.answer, typing && s.answerTyping]}>
      {message ? <View style={s.statusLine}><FactArt kind="check" size={20} />
        <T accessibilityRole="alert" variant="body" style={[s.grow, s.green]}>{message}</T></View> : null}
      {error ? <T accessibilityRole="alert" variant="body" style={s.danger}>{error}</T> : null}
    </View> : null}
    <View testID="worker-profile-actions" style={[s.answer, typing && s.footerAside]} accessibilityElementsHidden={typing}
      importantForAccessibility={typing ? 'no-hide-descendants' : 'auto'}>
      {held ? <T variant="meta" tone="muted">Tvoj unos je zadržan. Prikazujemo samo ono što je stvarno sačuvano.</T> : null}
      {children}
    </View>
  </>;
}

function Field({ label, value, change, disabled, multiline = false, inputRef }: {
  label: string; value: string; change: (text: string) => void; disabled: boolean; multiline?: boolean;
  inputRef?: RefObject<TextInput | null>;
}) {
  return <View style={s.field}><T variant="meta" tone="muted">{label}</T><TextInput ref={inputRef} accessibilityLabel={label} value={value}
    editable={!disabled} onChangeText={text => { if (!disabled) change(text); }} multiline={multiline}
    maxLength={multiline ? 4000 : 160} style={[s.input, multiline && s.multiline, disabled && s.inputLocked]} /></View>;
}

function SectionHead({ art, title }: { art: FactArtKind; title: string }) {
  return <View style={s.head}><FactArt kind={art} size={24} /><T variant="heading" accessibilityRole="header" style={[s.grow, s.ink]}>{title}</T></View>;
}

/** The most a list may hold (`capabilityTerms`). */
const MAX_TERMS = 50;

/**
 * A list the person owns, three ways to fill it: the chips already on it (a tap removes one), a field to type a new one,
 * and the pictures of the catalog behind "Brzi izbor". A picture inserts its catalog label as the same free text the
 * person could type ("Kombi", "Transportna kolica"); nothing new is stored and matching is unchanged. Tapping a chosen
 * picture again removes that term in any spelling of its case.
 */
function TermsPicker({ label, art, group, placeholder, quickLabel, quickOpen, values, pending, setPending, change, disabled, inputRef }: {
  label: string; art: FactArtKind; group: PictogramGroup; placeholder: string; quickLabel: string; quickOpen: boolean;
  values: string[]; pending: string; setPending: (text: string) => void; change: (terms: string[], clearPending?: boolean) => void;
  disabled: boolean; inputRef?: RefObject<TextInput | null>;
}) {
  const full = values.length >= MAX_TERMS;
  const add = () => { const term = pending.replace(/^ +| +$/g, '');
    if (disabled || !term || Array.from(term).length > 500 || full) return;
    change([...values, term], true); };
  const tiles = pictogramCatalog.filter(p => p.group === group && p.kind !== 'ostalo');
  return <View style={s.section}>
    <SectionHead art={art} title={label} />
    {values.length ? <View style={s.chips}>
      {values.map((value, index) => <Press key={index} accessibilityRole="button" accessibilityLabel={`Ukloni ${label.toLowerCase()}: ${value}`}
        accessibilityState={{ disabled }} disabled={disabled} haptic="select" hitSlop={{ top: 4, bottom: 4 }}
        onPress={() => { if (!disabled) change(values.filter((_, i) => i !== index)); }} style={s.chip}>
        <T variant="note" style={s.chipText}>{value}</T><X size={16} color={sys.color.green} weight="bold" />
      </Press>)}
    </View> : null}
    <View style={s.addRow}>
      <TextInput ref={inputRef} accessibilityLabel={`Nova stavka: ${label}`} placeholder={placeholder} placeholderTextColor={sys.color.muted}
        value={pending} editable={!disabled && !full} onChangeText={text => { if (!disabled) setPending(text); }}
        onSubmitEditing={add} maxLength={500} style={[s.input, s.grow, (disabled || full) && s.inputLocked]} />
      <V2Action label="Dodaj" accessibilityLabel={`Dodaj: ${label}`} kind="secondary" compact onPress={add}
        disabled={disabled || !pending.trim() || full} style={s.add} />
    </View>
    {full ? <T variant="note" tone="muted">Najviše 50 stavki.</T> : null}
    <Disclosure label={quickLabel} defaultExpanded={quickOpen}>
      <PickerGrid>{tiles.map(tile => {
        const selected = hasTerm(values, tile.label), blocked = !selected && full;
        return <PickerTile key={tile.kind} kind={tile.kind} label={tile.label} size="medium" mode="multiple" selected={selected}
          disabled={disabled || blocked} reason={blocked ? 'Najviše 50 stavki' : undefined}
          onPress={() => { if (!disabled && !blocked) change(toggleTerm(values, tile.label)); }} />;
      })}</PickerGrid>
    </Disclosure>
  </View>;
}

/**
 * How many people the person can bring, 1 to 50, with a minus and a plus beside the number. Every press goes through the
 * same change as typing, so the route's guards decide it exactly as they decide a typed number; nothing fills the field
 * by itself, and an empty field stays empty until the person presses or types. A typed number above 50 (the field takes
 * three digits) is still read as that number: minus brings it back to 50 and plus stays grey.
 */
function CountStepper({ value, revision, saved, change, disabled, inputRef }: {
  value: string; revision: string | null; /** The profile exists (it has been saved once). */ saved: boolean;
  change: (capacity: string) => void; disabled: boolean; inputRef?: RefObject<TextInput | null>;
}) {
  const locked = disabled || revision === null;
  const n = /^[0-9]{1,3}$/.test(value) ? Number(value) : null;
  const unit = n === null ? 'osoba' : plural(n, 'osoba', 'osobe', 'osoba').replace(/^\S+ /, '');
  return <View style={s.section}>
    <SectionHead art="users" title="Koliko ljudi možeš da obezbediš" />
    <View style={s.stepper}>
      <ChromeIconButton label="Manje ljudi" icon={Minus} disabled={locked || n === null || n <= 1}
        onPress={() => { if (!locked && n !== null && n > 1) change(String(Math.min(n - 1, 50))); }} />
      <TextInput ref={inputRef} accessibilityLabel="Koliko ljudi možeš da obezbediš" value={value} editable={!locked}
        onChangeText={text => { if (!locked) change(text); }} keyboardType="number-pad" maxLength={3}
        style={[s.input, s.count, locked && s.inputLocked]} />
      <ChromeIconButton label="Više ljudi" icon={Plus} disabled={locked || (n !== null && n >= 50)}
        onPress={() => { if (!locked && (n === null || n < 50)) change(n === null || n < 1 ? '1' : String(n + 1)); }} />
      <T variant="copy" tone="muted" style={s.shrink}>{unit}</T>
    </View>
    {/* A saved profile without a capacity revision is loaded, not saved, first: the note says what the primary does. */}
    <T variant="note" tone="muted">{revision === null ? saved ? 'Kapacitet profila još nije učitan.' : 'Sačuvaj profil da bi se broj ljudi potvrdio.'
      : 'Ukupan broj ljudi, uključujući tebe. Od 1 do 50; nije kapacitet vozila.'}</T>
  </View>;
}

/** The three checks that gate activation, in the words the checklist says. */
export type WorkerActivationChecks = { basics: boolean; area: boolean; capacity: boolean };
const CHECKS: [keyof WorkerActivationChecks, string][] = [['basics', 'Ime i bar jedna veština'], ['area', 'Područje rada'], ['capacity', 'Kapacitet tima']];
type WorkerNavigation = '/profil/lokacija' | '/profil/dostupnost' | '/podrska';

/**
 * Whether tasks can be offered to you, first. Active is one green line. A draft (or no profile yet) is a flat note with
 * the three things activation waits for, each marked ready or missing; they are not buttons, because the footer's
 * primary already leads to the first missing one. "Ready" is said only when the route's primary really is the
 * activation (the three checks can pass while the capacity revision still has to be loaded or a change saved). A
 * suspension says so and offers support.
 */
function ActivationStatus({ status, checks, readyToActivate, disabled, navigate }: {
  status: StanjeProfila | null; checks?: WorkerActivationChecks; readyToActivate: boolean; disabled: boolean;
  navigate: (path: WorkerNavigation) => void;
}) {
  if (status === 'ACTIVE') return <View style={s.activeLine}>
    <FactArt kind="check" size={20} /><T variant="bodyStrong" style={[s.grow, s.green]}>Profil je aktivan</T>
  </View>;
  // Moderation wording stays the owner's until one word is chosen ("suspendovan" here, "obustavljen" on the hub).
  if (status === 'SUSPENDED') return <View style={[s.status, s.suspended]}>
    <T variant="bodyStrong" style={s.danger}>Profil je trenutno suspendovan</T>
    <T variant="note" style={s.ink}>Dok traje suspenzija, zadaci ti se ne nude.</T>
    <V2Action label="Piši podršci" kind="quiet" compact disabled={disabled} onPress={() => navigate('/podrska')} style={s.start} />
  </View>;
  const draft = status === 'DRAFT';
  return <View style={s.status}>
    <View style={s.titleLine}><View style={s.dot} />
      <T variant="bodyStrong" style={[s.grow, s.ink]}>{draft ? 'Radni profil je još nacrt' : 'Radni profil još nije podešen'}</T></View>
    <T variant="note" tone="muted">{draft ? 'Dok je nacrt, zadaci ti se ne nude.' : 'Bez njega ne možeš da se prijaviš na zadatak.'}</T>
    {checks ? <View style={s.checklist}>{CHECKS.map(([key, label]) => <View key={key} accessible
      accessibilityLabel={`${label}: ${checks[key] ? 'spremno' : 'nedostaje'}`} style={s.checkItem}>
      {checks[key] ? <FactArt kind="check" size={20} /> : <View style={s.emptyCheck} />}
      <T variant="note" style={[s.grow, s.ink]}>{label}</T>
    </View>)}</View> : null}
    {draft && readyToActivate ? <T variant="note" tone="muted">Sve je spremno za aktivaciju.</T> : null}
  </View>;
}

export type WorkerProfileFocusRequest = { target: 'name' | 'skill' | 'capacity'; token: number };
/**
 * The worker's profile, recomposed 2026-09-24 (owner step 9): whether tasks are offered to you → the name → skills →
 * how many people → where and when (rows to their own editors) → tools → vehicles → an optional introduction → the
 * conversation as another way to fill it in. Skills, tools and vehicles take chips, typing or pictures. Every field
 * keeps its label as the input's spoken name; the route owns saving and every guard.
 */
export function WorkerProfileForm({ draft, change, disabled, status, navigate, focusRequest, checks, readyToActivate = false, openConversation,
  profileExists = status !== null }: {
  draft: WorkerDraft; change: (value: WorkerDraft) => void; disabled: boolean; status: StanjeProfila | null; navigate: (path: WorkerNavigation) => void;
  focusRequest?: WorkerProfileFocusRequest | null;
  /** What activation is actually waiting for, from the same checks that gate it. */
  checks?: WorkerActivationChecks;
  /** The route's primary action is the activation itself: only then does the note say everything is ready. */
  readyToActivate?: boolean;
  /** The AI conversation, behind the route's own guards. */
  openConversation?: () => void;
  /** A profile has been saved and read, whatever its state (a saved profile's state can be unknown). */
  profileExists?: boolean }) {
  // Where the lists stood when the screen opened decides only which quick pick starts open: an empty skill list opens its
  // pictures, because that is where a first profile begins.
  const skillsOpen = useRef(draft.vestine.length === 0).current;
  const nameRef = useRef<TextInput>(null), skillRef = useRef<TextInput>(null), capacityRef = useRef<TextInput>(null);
  useEffect(() => {
    if (!focusRequest || disabled) return;
    const selected = focusRequest.target === 'name' ? nameRef.current : focusRequest.target === 'skill' ? skillRef.current : capacityRef.current;
    (selected as { focus?: () => void } | null)?.focus?.();
  }, [focusRequest, disabled]);
  const patch = (value: Partial<WorkerDraft>) => { if (!disabled) change({ ...draft, ...value }); };
  const grad = draft.grad.trim();
  const area = grad ? (draft.radius ? `${grad} · ${draft.radius} km` : grad) : 'Nije podešeno';
  return <View style={s.form}>
    <ActivationStatus status={status} checks={checks} readyToActivate={readyToActivate} disabled={disabled} navigate={navigate} />
    <Field label="Ime na radnom profilu" value={draft.ime} change={ime => patch({ ime })} disabled={disabled} inputRef={nameRef} />
    <TermsPicker label="Veštine i usluge" art="tasks" group="usluge" placeholder="Dodaj veštinu" quickLabel="Brzi izbor veština" quickOpen={skillsOpen}
      values={draft.vestine} pending={draft.newSkill} setPending={newSkill => patch({ newSkill })}
      change={(vestine, clear) => patch({ vestine, ...(clear ? { newSkill: '' } : {}) })} disabled={disabled} inputRef={skillRef} />
    <CountStepper value={draft.capacity} revision={draft.capacityRevision} saved={profileExists} change={capacity => patch({ capacity })}
      disabled={disabled} inputRef={capacityRef} />
    {/* Where and when are set in their own editors, each with its own save; here they are read and opened. */}
    <View style={s.rows}>
      <SettingsRow label="Područje rada" detail={area} icon={<FactArt kind="pin" size={26} />} disabled={disabled}
        onPress={() => navigate('/profil/lokacija')} />
      <SettingsRow label="Dostupnost" icon={<FactArt kind="clock" size={26} />} disabled={disabled} last onPress={() => navigate('/profil/dostupnost')}
        detail={`Status „Mogu odmah“ je ${draft.dostupanOdmah ? 'uključen' : 'isključen'}. Nije oznaka HITNO niti dozvola za push obaveštenja.`} />
    </View>
    <TermsPicker label="Alat i oprema" art="tool" group="alat" placeholder="Dodaj alat" quickLabel="Brzi izbor alata" quickOpen={false}
      values={draft.alati} pending={draft.newTool} setPending={newTool => patch({ newTool })}
      change={(alati, clear) => patch({ alati, ...(clear ? { newTool: '' } : {}) })} disabled={disabled} />
    {/* No picture is refused for a licence: the profile holds no licence data. */}
    <TermsPicker label="Vozila" art="vehicle" group="vozila" placeholder="Dodaj vozilo" quickLabel="Brzi izbor vozila" quickOpen={false}
      values={draft.vozila} pending={draft.newVehicle} setPending={newVehicle => patch({ newVehicle })}
      change={(vozila, clear) => patch({ vozila, ...(clear ? { newVehicle: '' } : {}) })} disabled={disabled} />
    <Disclosure label="Kratko predstavljanje" hint="Opciono" defaultExpanded={!!draft.biografija}>
      <Field label="O tvom iskustvu" value={draft.biografija} change={biografija => patch({ biografija })} disabled={disabled} multiline />
    </Disclosure>
    {openConversation ? <View style={s.rows}>
      <SettingsRow label="Uredi profil kroz razgovor" icon={<FactArt kind="chat" size={26} />} disabled={disabled} last onPress={openConversation} />
    </View> : null}
    <T variant="note" tone="muted" style={s.center}>Veštine, alat i vozila navodiš ti. Izmena profila ne prepisuje već poslate Prijave.</T>
  </View>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground }, grow: { flex: 1, minWidth: 0 }, shrink: { flexShrink: 1 },
  ink: { color: sys.color.ink }, green: { color: sys.color.green }, danger: { color: sys.color.danger }, center: { textAlign: 'center' },
  start: { alignSelf: 'flex-start' },
  content: { padding: 20, paddingTop: 6, gap: 16, paddingBottom: 28 },
  footer: { paddingHorizontal: 20, paddingVertical: 12, gap: 8, borderTopWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
  footerAside: { display: 'none' },
  // While typing, a footer that keeps its answer draws no strip of its own: an empty one would sit on the keyboard.
  footerTyping: { paddingVertical: 0, borderTopWidth: 0, gap: 0 },
  answer: { gap: 8 }, answerTyping: { paddingVertical: 12 },
  form: { gap: sys.space.xxl },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // A note inside the screen is a flat tint, never a card (the one card rule): wash for a draft, danger-soft for a suspension.
  status: { backgroundColor: sys.color.wash, borderRadius: sys.radius.control, padding: sys.space.base, gap: sys.space.md },
  suspended: { backgroundColor: sys.color.dangerSoft },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  dot: { width: 8, height: 8, borderRadius: sys.radius.pill, backgroundColor: sys.color.orange },
  checklist: { gap: 4 },
  checkItem: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  emptyCheck: { width: 20, height: 20, borderRadius: sys.radius.pill, borderWidth: 1.5, borderColor: sys.color.lineStrong },
  section: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  field: { gap: 6 },
  input: { ...field },
  multiline: { minHeight: 96, textAlignVertical: 'top' }, inputLocked: { backgroundColor: sys.color.wash, color: sys.color.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40, maxWidth: '100%', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft },
  chipText: { color: sys.color.ink, fontWeight: '600', flexShrink: 1 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  add: { minWidth: 72 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: { width: 88, textAlign: 'center', fontSize: 20, lineHeight: 26, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rows: { ...card, paddingVertical: 0, paddingHorizontal: 18 },
});
