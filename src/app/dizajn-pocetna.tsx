import { StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { useLocalSearchParams } from 'expo-router';
import { Bell } from 'phosphor-react-native';
import type { HomeRow, HomeSnapshot } from '../data/homeSnapshot';
import { HomePresentation } from '../ui/home/HomePresentation';
import { ChromeIconButton, ScreenChrome } from '../ui/system/ScreenChrome';
import { T } from '../ui/Text';
import { sys } from '../ui/system/tokens';

/**
 * Internal Home fixtures for native layout checks: uskociapp://dizajn-pocetna?scene=upcoming.
 * These are static examples, never account data. The existing internal-build boundary is retained;
 * no auth state changes, data services or live inbox mount, and every action is inert.
 * Home owns the complete viewport, SafeArea and scroll geometry, without gallery controls above it.
 */
const noop = () => undefined;
const SCENES = ['upcoming', 'flexible', 'untimed', 'empty', 'unavailable'] as const;
type Scene = typeof SCENES[number];

const EMPTY: HomeSnapshot = {
  attention: [], attentionMore: 0, attentionState: 'known',
  agreements: { kind: 'known', value: { rows: [], more: 0 } },
  mine: {
    tasks: { kind: 'known', value: { total: 0, active: 0, waiting: 0, drafts: 0, history: 0 } },
    applications: { kind: 'known', value: { total: 0, attention: 0, active: 0, finished: 0 } },
  },
  partial: false, firstRun: true, ratingsDue: 0, ratingDueAgreementId: null,
};

function appointment(id: string, title: string, facts: NonNullable<HomeRow['appointment']>): HomeSnapshot {
  return {
    ...EMPTY, firstRun: false,
    agreements: { kind: 'known', value: { more: 0, rows: [{ id: `gallery:${id}`, title,
      detail: [facts.roleLabel, facts.counterpartName, facts.timeText].filter(Boolean).join(' · '),
      target: { kind: 'AGREEMENT', agreementId: `gallery-${id}` }, appointment: facts }] } },
    mine: {
      tasks: { kind: 'known', value: { total: 3, active: 2, waiting: 0, drafts: 1, history: 0 } },
      applications: { kind: 'known', value: { total: 1, attention: 0, active: 1, finished: 0 } },
    },
  };
}

const FIXTURES: Record<Scene, HomeSnapshot> = {
  upcoming: { ...appointment('upcoming', 'Montaža police u hodniku', {
    timeText: '26. sep · 17:00–19:00', counterpartName: 'Jelena Nikolić', roleLabel: 'Tvoj zadatak',
  }), attention: [{ id: 'gallery:choice', title: '2 prijave', detail: 'Pomoć pri selidbi · čeka tvoj izbor',
    target: { kind: 'CANDIDATES', needId: 'gallery-choice' } }],
    mine: {
      tasks: { kind: 'known', value: { total: 3, active: 2, waiting: 1, drafts: 1, history: 0 } },
      applications: { kind: 'known', value: { total: 1, attention: 0, active: 1, finished: 0 } },
    } },
  flexible: appointment('flexible', 'Prenos troseda i dve fotelje sa trećeg sprata zgrade bez lifta do kombija ispred ulaza', {
    timeText: 'Fleksibilno · tokom sledeće nedelje', counterpartName: 'Aleksandra Konstantinović-Radovanović', roleLabel: 'Uskačeš',
  }),
  untimed: appointment('untimed', 'Prevod uputstva na engleski', {
    timeText: '', counterpartName: 'Druga strana', roleLabel: null,
  }),
  empty: EMPTY,
  unavailable: { ...EMPTY, partial: true, firstRun: false, attentionState: 'unavailable',
    agreements: { kind: 'unavailable' }, mine: { tasks: { kind: 'unavailable' }, applications: { kind: 'unavailable' } } },
};

const STILL_HEADER = <ScreenChrome variant="root" title="Početna · interna galerija" onProfile={noop}
  bell={<ChromeIconButton label="Obaveštenja · primer" icon={Bell} tone="green" onPress={noop} />} />;

export default function DizajnPocetna() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  const params = useLocalSearchParams<{ scene?: string | string[] }>();
  const scene = SCENES.find(value => value === params.scene) ?? 'upcoming';
  if (!internal) return <View style={s.screen}><T>Nije dostupno.</T></View>;
  return <HomePresentation key={scene} home={FIXTURES[scene]} header={STILL_HEADER} loading={false} refreshing={false} error={false}
    onPublish={noop} onEarn={noop} onProfile={noop} onOpen={noop} onRatings={noop}
    onMyTasks={noop} onMyApplications={noop} onRefresh={noop} />;
}

const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: sys.color.surface } });
