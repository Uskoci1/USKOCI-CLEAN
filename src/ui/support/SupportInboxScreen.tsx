import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { SupportMode } from '../../data/supportCaseTypes';
import { SettingsAction, SettingsGroup, SettingsIntro, SettingsRow } from '../settings/SettingsPresentation';
import { Segmented } from '../system/Segmented';
import { StateView } from '../system/StateView';
import { sys } from '../system/tokens';
import { SupportCaseRow, SupportFrame, SupportLoading, SupportNote, SupportPrivacy, supportLabel, supportStyles, supportTime } from './SupportPresentation';
import { SupportRecoveryPanel } from './SupportRecoveryPanel';
import { supportMessageTone } from './supportCopy';
import { useSupportController } from './useSupportController';

export function SupportInboxScreen({ mode = 'OWN', onMode }: { mode?: SupportMode; onMode?: (mode: 'OPERATOR' | 'SAFETY') => void }) {
  const model = useSupportController({ type: 'INBOX', mode });
  return <SupportInboxView model={model} mode={mode} onMode={onMode} />;
}

/**
 * Podrška (round 5, owner step 11b): the person's private requests as a list that says what each is about, its state
 * and when it last moved, with news as an orange dot; one way to start a new request (the footer); and, apart, the two
 * places for blocking and data rights. Authorised staff get the same list with a switch between their two inboxes.
 * Presentation over the controller's state: every command is the controller's, fenced by `current()` / `navigate()`.
 */
export function SupportInboxView({ model, mode, onMode }: {
  model: ReturnType<typeof useSupportController>; mode: SupportMode; onMode?: (mode: 'OPERATOR' | 'SAFETY') => void;
}) {
  const { state, controller, current, navigate } = model;
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  useEffect(() => { setCursors([null]); }, [model.incarnation]);
  const busy = state.phase === 'LOADING' || state.phase === 'SENDING', inbox = state.inbox;
  const page = (cursor: string | null, back = false) => {
    if (!current() || busy) return;
    setCursors(previous => back ? previous.slice(0, -1) : [...previous, cursor]);
    void controller?.page(cursor, state);
  };
  const reload = () => { if (current()) void controller?.load(); };
  const messageTone = supportMessageTone(state);
  return <SupportFrame title={mode === 'OWN' ? 'Podrška' : mode === 'SAFETY' ? 'Bezbednosni predmeti' : 'Operaterski inbox'}
    onBack={() => navigate(() => router.canGoBack() ? router.back() : router.replace('/profil'))}
    // A failed list read has its own green retry in the error state; the footer's green action waits for the list, so the
    // screen never shows two primaries (round 5 review).
    footer={mode === 'OWN' && state.capabilities?.canCreate && !state.pending && state.phase !== 'ERROR' ?
      <SettingsAction label="Novi privatni zahtev" disabled={busy} onPress={() => navigate(() => router.push('/podrska/novi'))} /> : undefined}>
    {mode !== 'OWN' && inbox?.operatorAvailable && onMode ? <Segmented appearance="underline" value={mode === 'SAFETY' ? 'SAFETY' : 'OPERATOR'}
      options={[{ key: 'OPERATOR', label: 'Svi operaterski predmeti' }, { key: 'SAFETY', label: 'Bezbednosni predmeti' }]}
      onChange={next => { if (current() && !busy) onMode(next); }} /> : null}
    {/* Staff need the rule of the list; a person's own list explains itself. */}
    {mode !== 'OWN' ? <SettingsIntro>Otvaranje predmeta ne znači da je obrada preuzeta. Preuzmi ga iz detalja kada započneš pregled.</SettingsIntro> : null}
    <SupportRecoveryPanel model={model} />
    {state.message && !state.pending && state.phase !== 'ERROR' ? <SupportNote tone={messageTone === 'success' ? 'info' : messageTone}>{state.message}</SupportNote> : null}
    {state.phase === 'LOADING' ? <SupportLoading />
      : state.phase === 'ERROR' ? <StateView kind="error" art="chat" title="Zahtevi nisu učitani" body={state.message ?? undefined}
        primary={{ label: 'Osveži zahteve', onPress: reload, disabled: busy }} />
      : inbox ? inbox.cases.length ? <SettingsGroup title={mode === 'OWN' ? 'Primljeni zahtevi' : 'Predmeti'}>
        {inbox.cases.map((item, index) => <SupportCaseRow key={item.id} topic={supportLabel(item.topic)} status={item.status}
          channel={item.channel} time={supportTime(item.updatedAt)} caseNumber={item.caseNumber} unread={item.unread}
          last={index === inbox.cases.length - 1} disabled={busy}
          onPress={() => navigate(() => router.push({ pathname: '/podrska/[id]', params: { id: item.id } }))} />)}
      </SettingsGroup> : mode === 'OWN'
        ? <StateView kind="empty" art="chat" title="Još nema primljenih zahteva"
          body="Zahtev, dopune i odgovor ostaju zajedno. Prijem zahteva vidiš čim bude potvrđen." />
        : <StateView kind="empty" art="chat" title="Nema predmeta na ovoj stranici." /> : null}
    {cursors.length > 1 || inbox?.nextBeforeCaseNumber ? <View style={supportStyles.pager}>
      {cursors.length > 1 ? <SettingsAction label="Prethodna stranica" kind="quiet" disabled={busy}
        onPress={() => page(cursors[cursors.length - 2], true)} /> : <View />}
      {inbox?.nextBeforeCaseNumber ? <SettingsAction label="Stariji zahtevi" kind="quiet" disabled={busy}
        onPress={() => page(inbox.nextBeforeCaseNumber)} /> : null}
    </View> : null}
    {state.phase !== 'LOADING' && state.phase !== 'ERROR' ? <SettingsAction label="Osveži zahteve" kind="quiet" disabled={busy} onPress={reload} /> : null}
    <View style={s.privacy}><SupportPrivacy safety={mode === 'SAFETY'} /></View>
    {state.capabilities?.operatorAvailable && mode === 'OWN' ? <SettingsGroup title="Ovlašćena obrada">
      <SettingsRow label="Otvori operaterski inbox" detail="Pristup odobren ovom nalogu." disabled={busy} last
        onPress={() => navigate(() => router.push('/podrska/operator'))} />
    </SettingsGroup> : null}
    {mode === 'OWN' ? <SettingsGroup title="Bezbednost i podaci">
      <SettingsRow compact label="Privatne prijave i blokiranja" detail="Postojeće prijave i blokirani korisnici." disabled={busy}
        onPress={() => navigate(() => router.push('/profil/blokirani'))} />
      <SettingsRow compact label="Izvoz i zatvaranje naloga" detail="Zasebne radnje nad tvojim podacima." disabled={busy} last
        onPress={() => navigate(() => router.push('/profil/privatnost'))} />
    </SettingsGroup> : null}
  </SupportFrame>;
}

const s = StyleSheet.create({ privacy: { marginTop: sys.space.sm, marginBottom: sys.space.sm } });
