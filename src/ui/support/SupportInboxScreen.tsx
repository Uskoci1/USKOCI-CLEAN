import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import type { SupportMode } from '../../data/supportCaseTypes';
import { SettingsAction, SettingsGroup, SettingsIntro, SettingsRow } from '../settings/SettingsPresentation';
import { SupportFrame, SupportEmpty, SupportLoading, SupportNotice, SupportPrivacy, supportLabel, supportTime } from './SupportPresentation';
import { SupportRecoveryPanel } from './SupportRecoveryPanel';
import { useSupportController } from './useSupportController';

export function SupportInboxScreen({ mode = 'OWN', onMode }: { mode?: SupportMode; onMode?: (mode: 'OPERATOR' | 'SAFETY') => void }) {
  const model = useSupportController({ type: 'INBOX', mode }), { state, controller, current, navigate } = model;
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  useEffect(() => { setCursors([null]); }, [model.incarnation]);
  const busy = state.phase === 'LOADING' || state.phase === 'SENDING', inbox = state.inbox;
  const page = (cursor: string | null, back = false) => {
    if (!current() || busy) return;
    setCursors(previous => back ? previous.slice(0, -1) : [...previous, cursor]);
    void controller?.page(cursor, state);
  };
  return <SupportFrame title={mode === 'OWN' ? 'Podrška' : mode === 'SAFETY' ? 'Bezbednosni predmeti' : 'Operaterski inbox'}
    onBack={() => navigate(() => router.canGoBack() ? router.back() : router.replace('/profil'))}
    footer={mode === 'OWN' && state.capabilities?.canCreate && !state.pending ?
      <SettingsAction label="Novi privatni zahtev" disabled={busy} onPress={() => navigate(() => router.push('/podrska/novi'))} /> : undefined}>
    {/* The bar already names the screen; a second line ("Prati svaki odgovor.") only restated it. */}
    <SettingsIntro>
      {mode === 'OWN' ? 'Zahtev, dopune i odgovor ostaju zajedno. Prijem zahteva vidiš čim ga server potvrdi.'
        : 'Otvaranje predmeta ne znači da je obrada preuzeta. Preuzmi ga iz detalja kada započneš pregled.'}
    </SettingsIntro>
    <SupportPrivacy safety={mode === 'SAFETY'} />
    <SupportRecoveryPanel model={model} />
    {state.phase === 'LOADING' ? <SupportLoading /> : null}
    {state.message && !state.pending ? <SupportNotice error={state.phase === 'ERROR'}>{state.message}</SupportNotice> : null}
    {state.capabilities?.operatorAvailable && mode === 'OWN' ? <SettingsGroup title="Ovlašćena obrada">
      <SettingsRow label="Otvori operaterski inbox" detail="Pristup odobren ovom nalogu." disabled={busy} last
        onPress={() => navigate(() => router.push('/podrska/operator'))} />
    </SettingsGroup> : null}
    {mode !== 'OWN' && inbox?.operatorAvailable && onMode ? <SettingsAction kind="quiet" disabled={busy}
      label={mode === 'SAFETY' ? 'Svi operaterski predmeti' : 'Bezbednosni predmeti'}
      onPress={() => { if (current()) onMode(mode === 'SAFETY' ? 'OPERATOR' : 'SAFETY'); }} /> : null}
    {inbox ? inbox.cases.length ? <SettingsGroup title={mode === 'OWN' ? 'Primljeni zahtevi' : 'Predmeti'}>
      {/* A list of "Zahtev #14" tells a person nothing about their own requests. What it was about
          is the name; the number is how support refers to it, so it goes in the detail. */}
      {inbox.cases.map((item, index) => <SettingsRow key={item.id} label={`${supportLabel(item.topic)}${item.unread ? ' · Novo' : ''}`}
        detail={`${supportLabel(item.status)} · ${supportTime(item.updatedAt)} · #${item.caseNumber}`}
        last={index === inbox.cases.length - 1} disabled={busy}
        onPress={() => navigate(() => router.push({ pathname: '/podrska/[id]', params: { id: item.id } }))} />)}
    </SettingsGroup> : <SupportEmpty>{mode === 'OWN' ? 'Još nema primljenih zahteva. Novi zahtev možeš da pošalješ odavde.'
      : 'Nema predmeta na ovoj stranici.'}</SupportEmpty> : null}
    {inbox?.nextBeforeCaseNumber ? <SettingsAction label="Stariji zahtevi" kind="quiet" disabled={busy}
      onPress={() => page(inbox.nextBeforeCaseNumber)} /> : null}
    {cursors.length > 1 ? <SettingsAction label="Prethodna stranica" kind="quiet" disabled={busy}
      onPress={() => page(cursors[cursors.length - 2], true)} /> : null}
    {state.phase !== 'LOADING' ? <SettingsAction label="Osveži zahteve" kind="quiet" disabled={busy}
      onPress={() => { if (current()) void controller?.load(); }} /> : null}
    {mode === 'OWN' ? <SettingsGroup title="Bezbednost i podaci">
      <SettingsRow label="Privatne prijave i blokiranja" detail="Postojeće prijave i blokirani korisnici." disabled={busy}
        onPress={() => navigate(() => router.push('/profil/blokirani'))} />
      <SettingsRow label="Izvoz i zatvaranje naloga" detail="Zasebne radnje nad tvojim podacima." disabled={busy} last
        onPress={() => navigate(() => router.push('/profil/privatnost'))} />
    </SettingsGroup> : null}
  </SupportFrame>;
}
