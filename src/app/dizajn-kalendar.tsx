import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { CaretRight } from 'phosphor-react-native';
import type { UcesnikProjekcija } from '../contracts/projections';
import type { WorkerCalendarEvent } from '../contracts/workerCalendar';
import type { AvailabilityRule, AvailabilityWindow, WorkerAvailabilityInput } from '../contracts/workerAvailability';
import { AgendaScreen, type AgendaList, type AgendaSchedule } from '../ui/calendar/AgendaScreen';
import type { AgendaAgreement } from '../ui/calendar/agenda';
import { AvailabilityForm, CopySheet, RuleSheet, WindowSheet } from '../ui/calendar/AvailabilityForm';
import { CalendarScreen } from '../ui/calendar/CalendarControls';
import { civilInstant, deviceDate, shiftDate, weekdays } from '../ui/calendar/calendarPresentation';
import { DetailTopBar } from '../ui/system/DetailTopBar';
import { StateView } from '../ui/system/StateView';
import { sys } from '../ui/system/tokens';
import { Press } from '../ui/Press';
import { T } from '../ui/Text';
import { V2Action } from '../ui/v2/V2Action';

/**
 * Kalendar obaveza and Dostupnost za rad in their main states, for the lead to photograph on the emulator (owner step 10,
 * 2026-09-24). Reached only by its address (uskociapp://dizajn-kalendar) in the internal build; the store package shows
 * nothing. It draws the real presentation (`AgendaScreen`, `AvailabilityForm`, its three sheets and `CalendarScreen`) with
 * fixture props: nothing here reads or writes data, no command is sent, and every press that would leave the screen or
 * save does nothing. Each scene is chosen from the list by its label; "Nazad" (the strip at the bottom, or the top bar's
 * arrow) returns to the list.
 */
type SceneKey = 'dan' | 'prazno' | 'ucitava' | 'greska' | 'delimicno' | 'dugi' | 'zona'
  | 'nedeljaPrazna' | 'nedelja' | 'dUcitava' | 'dGreska' | 'cuva' | 'nepoznato' | 'razlog' | 'sacuvano' | 'dZona'
  | 'termin' | 'poseban' | 'kopiraj';
const SCENES: { key: SceneKey; label: string }[] = [
  { key: 'dan', label: 'Kalendar · dan sa Dogovorima' }, { key: 'prazno', label: 'Kalendar · prazan dan' },
  { key: 'ucitava', label: 'Kalendar · učitava' }, { key: 'greska', label: 'Kalendar · greška' },
  { key: 'delimicno', label: 'Kalendar · samo termini u kojima uskačeš' }, { key: 'dugi', label: 'Kalendar · dugi nazivi' },
  { key: 'zona', label: 'Kalendar · telefon van Srbije' },
  { key: 'nedeljaPrazna', label: 'Dostupnost · prazna nedelja' }, { key: 'nedelja', label: 'Dostupnost · radna nedelja' },
  { key: 'dUcitava', label: 'Dostupnost · učitava' }, { key: 'dGreska', label: 'Dostupnost · greška' },
  { key: 'cuva', label: 'Dostupnost · čuva se' }, { key: 'nepoznato', label: 'Dostupnost · ishod nije potvrđen' },
  { key: 'razlog', label: 'Dostupnost · profil, dugme sa razlogom' }, { key: 'sacuvano', label: 'Dostupnost · sačuvano' },
  { key: 'dZona', label: 'Dostupnost · druga vremenska zona' },
  { key: 'termin', label: 'List · Novi termin' }, { key: 'poseban', label: 'List · Poseban datum' },
  { key: 'kopiraj', label: 'List · Kopiraj termine' },
];
const noop = () => {};

const today = deviceDate(new Date());
/** An instant of today (or a day around it) at a Serbian clock. */
const at = (time: string, days = 0) => civilInstant(shiftDate(today, days), time, 'Europe/Belgrade').value ?? new Date().toISOString();
const people = (me: 'narucilac' | 'uskocer', other: string): UcesnikProjekcija[] => [
  { id: 'me', profilId: null, ime: 'Ti', inicijali: '', uloga: me, mesta: me === 'uskocer' ? 1 : null, viSte: true, telefon: null },
  { id: 'other', profilId: null, ime: other, inicijali: other.charAt(0), uloga: me === 'uskocer' ? 'narucilac' as const : 'uskocer' as const, mesta: null,
    viSte: false, telefon: null }];
const agreement = (id: string, patch: Partial<AgendaAgreement>): AgendaAgreement => ({ id, verzija: 1, naslov: 'Pomoć oko krečenja stana',
  stanje: 'CONFIRMED', cena: { iznos: 4000, valuta: 'RSD', prikaz: '4.000 RSD' }, vremeTekst: '', putanjaTekst: 'Liman, Novi Sad',
  pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 }, ucesnici: people('narucilac', 'Marko'), rezim: 'FIZICKI',
  kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: true, tacnaLokacija: null, emailNijeDeljen: true },
  chatDostupan: true, rokPotvrdeIso: null, problemOtvoren: false, ocenaMoguca: false, hronologija: [], radnje: null, pocinje: null,
  izmenaCeka: null, izvor: { zadatakId: null, prijavaId: null }, tacanTermin: null, ...patch } as AgendaAgreement);
const event = (id: string, agreementId: string, start: string, end: string): WorkerCalendarEvent =>
  ({ eventId: id, agreementId, agreementVersion: 1, startsAt: start, endsAt: end, agreementStatus: 'CONFIRMED', source: 'AGREEMENT' });

const EVENTS = [event('e1', 'w1', at('08:00'), at('10:30')), event('e2', 'w2', at('18:00', 2), at('20:00', 2))];
const AGREEMENTS: AgendaAgreement[] = [
  agreement('w1', { naslov: 'Montaža police u hodniku', ucesnici: people('uskocer', 'Ana'), cena: { iznos: 2000, valuta: 'RSD', prikaz: '2.000 RSD' },
    putanjaTekst: 'Grbavica, Novi Sad' }),
  agreement('w2', { naslov: 'Prenos ormara do kombija', ucesnici: people('uskocer', 'Nikola'), cena: { iznos: 0, valuta: 'RSD', prikaz: '' } }),
  agreement('r1', { tacanTermin: { pocetak: at('12:00'), kraj: at('19:00') }, stanje: 'COMPLETED' }),
  agreement('r2', { naslov: 'Čišćenje stana posle krečenja', tacanTermin: { pocetak: at('11:00'), kraj: at('13:00') }, stanje: 'AWAITING_REQUESTER',
    ucesnici: people('narucilac', 'Jelena'), putanjaTekst: 'Detelinara, Novi Sad' }),
  agreement('r3', { naslov: 'Pomoć pri selidbi', tacanTermin: { pocetak: at('22:00', 1), kraj: at('02:00', 2) }, ucesnici: people('narucilac', 'Stefan') }),
  agreement('r4', { naslov: 'Lekcije iz matematike', rezim: 'DALJINSKI', tacanTermin: { pocetak: at('17:00', -1), kraj: at('18:00', -1) } }),
  agreement('f1', { naslov: 'Košenje trave', tacanTermin: null }),
];
const LONG: AgendaAgreement[] = [
  agreement('l1', { naslov: 'Prenos starog trokrilnog ormara iz stana na petom spratu bez lifta do kombija parkiranog u dvorištu zgrade',
    tacanTermin: { pocetak: at('09:00'), kraj: at('16:30') }, cena: { iznos: 125000, valuta: 'RSD', prikaz: '125.000 RSD' },
    putanjaTekst: 'Novo naselje, Bulevar Evrope, Novi Sad, blizu Ekonomske škole', ucesnici: people('narucilac', 'Aleksandra Petrović-Jovanović') }),
  agreement('l2', { naslov: 'Selidba kancelarije sa arhivom i nameštajem na drugi kraj grada', stanje: 'AWAITING_REQUESTER',
    tacanTermin: { pocetak: at('17:00'), kraj: at('23:30') }, ucesnici: people('narucilac', 'Konstantin Radosavljević') }),
];

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const rule = (n: number, days: number[], startTime: string, endTime: string, patch: Partial<AvailabilityRule> = {}): AvailabilityRule =>
  ({ id: id(n), weekdays: days, startTime, endTime, startsOn: '2026-09-01', endsOn: null, label: '', active: true, ...patch });
const windowAt = (n: number, days: number, from: string, to: string, state: AvailabilityWindow['state'], label = ''): AvailabilityWindow =>
  ({ id: id(n), startsAt: at(from, days), endsAt: at(to, days), state, label });
const EMPTY: WorkerAvailabilityInput = { timezone: 'Europe/Belgrade', availableNow: false, rules: [], windows: [] };
const WEEK: WorkerAvailabilityInput = { timezone: 'Europe/Belgrade', availableNow: true,
  rules: [rule(1, [1, 2, 3, 4, 5], '09:00:00', '17:00:00', { label: 'Radno vreme' }), rule(2, [6], '10:00:00', '14:00:00', { active: false }),
    rule(3, [5], '22:00:00', '24:00:00'), rule(4, [6], '00:00:00', '02:00:00')],
  windows: [windowAt(5, 3, '08:00', '20:00', 'UNAVAILABLE', 'Slava'), windowAt(6, 10, '09:00', '13:00', 'AVAILABLE'),
    windowAt(7, -20, '08:00', '12:00', 'UNAVAILABLE', 'Pregled kod lekara')] };

function Calendar({ schedule, list, phoneZone, back }: { schedule: AgendaSchedule; list: AgendaList; phoneZone?: string; back: () => void }) {
  const [selected, setSelected] = useState(today);
  return <AgendaScreen selected={selected} today={today} schedule={schedule} list={list} refreshing={false} onSelect={setSelected}
    onBack={back} onRefresh={noop} onRetry={noop} onRetryList={noop} onOpen={noop} onWithoutTerm={noop} onAvailability={noop}
    phoneZone={phoneZone ?? 'Europe/Belgrade'} />;
}
function Availability({ value, back, loading = false, error, ...form }: { value: WorkerAvailabilityInput; back: () => void; loading?: boolean;
  error?: string } & Partial<React.ComponentProps<typeof AvailabilityForm>>) {
  return <CalendarScreen title="Dostupnost za rad" back={back} loading={loading} scroll={false}>
    {error ? <View style={s.pad}><StateView kind="error" art="clock" title="Dostupnost nije učitana." body={error}
      primary={{ label: 'Učitaj sačuvano stanje', onPress: noop }} /></View>
      : <AvailabilityForm availability={value} busy={false} uncertain={false} onSave={noop} onRefresh={noop} phoneZone="Europe/Belgrade" {...form} />}
  </CalendarScreen>;
}

function Scene({ scene, back }: { scene: SceneKey; back: () => void }) {
  const ready = (events: readonly WorkerCalendarEvent[]): AgendaSchedule => ({ state: 'ready', events });
  switch (scene) {
    case 'dan': return <Calendar back={back} schedule={ready(EVENTS)} list={{ state: 'ready', agreements: AGREEMENTS }} />;
    case 'prazno': return <Calendar back={back} schedule={ready([])} list={{ state: 'ready', agreements: [] }} />;
    case 'ucitava': return <Calendar back={back} schedule={{ state: 'loading' }} list={{ state: 'loading' }} />;
    case 'greska': return <Calendar back={back} schedule={{ state: 'error', message: null }} list={{ state: 'ready', agreements: AGREEMENTS }} />;
    case 'delimicno': return <Calendar back={back} schedule={ready(EVENTS)} list={{ state: 'error' }} />;
    case 'dugi': return <Calendar back={back} schedule={ready([])} list={{ state: 'ready', agreements: LONG }} />;
    case 'zona': return <Calendar back={back} schedule={ready(EVENTS)} list={{ state: 'ready', agreements: AGREEMENTS }} phoneZone="America/New_York" />;
    case 'nedeljaPrazna': return <Availability back={back} value={EMPTY} />;
    case 'nedelja': return <Availability back={back} value={WEEK} />;
    case 'dUcitava': return <Availability back={back} value={EMPTY} loading />;
    case 'dGreska': return <Availability back={back} value={EMPTY} error="Podaci nisu učitani. Proveri vezu i pokušaj ponovo." />;
    case 'cuva': return <Availability back={back} value={WEEK} busy />;
    case 'nepoznato': return <Availability back={back} value={WEEK} uncertain onReconcile={noop}
      problem="Čuvanje nije potvrđeno. Proveri sačuvano stanje pre novog pokušaja." />;
    case 'razlog': return <Availability back={back} value={WEEK} uncertain candidateMode />;
    case 'sacuvano': return <Availability back={back} value={WEEK} saved />;
    case 'dZona': return <Availability back={back} value={{ ...WEEK, timezone: 'Asia/Kathmandu' }} />;
    case 'termin': return <><Availability back={back} value={EMPTY} />
      <RuleSheet isNew timezone="Europe/Belgrade" phoneZone="Europe/Belgrade" close={back} accept={noop}
        rule={rule(9, [2], '', '', { startsOn: today })} /></>;
    case 'poseban': return <><Availability back={back} value={WEEK} />
      <WindowSheet window={null} timezone="Europe/Belgrade" phoneZone="Europe/Belgrade" close={back} accept={noop} /></>;
    case 'kopiraj': return <><Availability back={back} value={WEEK} />
      <CopySheet source={weekdays[0]} rules={WEEK.rules} close={back} apply={noop} /></>;
  }
}

export default function DizajnKalendar() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  const [scene, setScene] = useState<SceneKey | null>(null);
  if (!internal) return <View style={s.screen}><T>Nije dostupno.</T></View>;
  if (!scene) return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <DetailTopBar title="Kalendar · galerija" onBack={() => router.back()} />
    <ScrollView contentContainerStyle={s.list}>
      {SCENES.map(option => <Press key={option.key} accessibilityRole="button" accessibilityLabel={option.label} haptic="select"
        onPress={() => setScene(option.key)} style={s.row}>
        <T variant="bodyStrong" style={s.grow}>{option.label}</T>
        <CaretRight size={18} color={sys.color.muted} />
      </Press>)}
    </ScrollView>
  </SafeAreaView>;
  const back = () => setScene(null);
  return <View style={s.screen}>
    {/* Each scene is mounted fresh, so its day, draft and open parts start where the scene says. */}
    <View key={scene} style={s.grow}><Scene scene={scene} back={back} /></View>
    <SafeAreaView edges={['bottom']} style={s.strip}>
      <V2Action label="Nazad" accessibilityLabel="Nazad na scene" kind="quiet" onPress={back} />
    </SafeAreaView>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  grow: { flex: 1, minWidth: 0 },
  pad: { paddingHorizontal: 20 },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: sys.color.line },
  strip: { paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: sys.color.line, backgroundColor: sys.color.surface },
});
