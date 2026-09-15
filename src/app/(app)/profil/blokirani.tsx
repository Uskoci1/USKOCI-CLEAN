import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { safetyClientService } from '../../../data/safetyClientService';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { useSesija } from '../../../store/sesija';
import { useUloga } from '../../../store/uloga';
import { SettingsText as T, SettingsScreen, SettingsGroup, SettingsRow, SettingsAction } from '../../../ui/settings/SettingsPresentation';

export default function BlockedAccounts() {
  const { user, accountRevision } = useSesija(), intent = useUloga();
  return <OwnedBlocks key={`${user?.id}:${accountRevision}:${intent}`} />;
}
function OwnedBlocks() {
  const [cursor, setCursor] = useState<string | null>(null);
  const read = useCallback(() => safetyClientService.listMyBlocks(cursor), [cursor]), editor = useOwnedEditor(read);
  return <SettingsScreen title="Blokirani korisnici" onBack={() => router.canGoBack() ? router.back() : router.replace('/profil')}>
    <T tone="muted">Ovde su korisnici koje si blokirao. Otvori korisnika da promeniš blokiranje ili pošalješ privatnu prijavu.</T>
    {editor.loading ? <T>Učitavam listu…</T> : editor.data?.items.length === 0 ? <T>Na ovoj listi nema blokiranih korisnika.</T> : null}
    {editor.data?.items.length ? <SettingsGroup title="Tvoja blokiranja">{editor.data.items.map((item, i, all) =>
      <SettingsRow key={item.targetAccountId} label={item.displayName ?? 'USKOČI korisnik'} detail="Blokiran kontakt" last={i === all.length - 1}
        onPress={() => router.navigate({ pathname: '/bezbednost', params: { targetAccountId: item.targetAccountId } })} />)}</SettingsGroup> : null}
    {editor.error ? <><T accessibilityRole="alert" tone="danger">{editor.error}</T><SettingsAction label="Pokušaj ponovo" onPress={() => { void editor.refresh(); }} /></> : null}
    {editor.data?.nextCursor ? <SettingsAction label="Sledeći korisnici" kind="secondary" onPress={() => setCursor(editor.data!.nextCursor)} /> : null}
    {cursor ? <SettingsAction label="Početak liste" kind="quiet" onPress={() => setCursor(null)} /> : null}
  </SettingsScreen>;
}
