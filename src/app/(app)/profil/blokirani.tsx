import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { safetyClientService } from '../../../data/safetyClientService';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { useSesija } from '../../../store/sesija';

import { SettingsText as T, SettingsScreen, SettingsGroup, SettingsRow, SettingsAction } from '../../../ui/settings/SettingsPresentation';

export default function BlockedAccounts() {
  const { user, accountRevision } = useSesija();
  return <OwnedBlocks key={`${user?.id}:${accountRevision}`} />;
}
function OwnedBlocks() {
  const [cursor, setCursor] = useState<string | null>(null);
  const read = useCallback(() => safetyClientService.listMyBlocks(cursor), [cursor]), editor = useOwnedEditor(read);
  const empty = !editor.loading && !editor.error && editor.data?.items.length === 0;
  return <SettingsScreen title="Blokirani korisnici" onBack={() => router.canGoBack() ? router.back() : router.replace('/profil')}>
    <T tone="muted">Korisnici koje trenutno blokiraš. Otvori korisnika da promeniš blokiranje ili pošalješ privatnu prijavu.</T>
    {editor.loading ? <T tone="muted">Učitavamo listu…</T> : null}
    {/* Nobody blocked is the good case, and it used to be a bare sentence. It now says how a block
        happens, since nothing on this screen can start one, and offers the one thing it can do. */}
    {empty ? <>
      <T>{cursor ? 'Na ovoj stranici nema više korisnika.' : 'Još nema blokiranih korisnika.'}</T>
      {cursor ? null : <T variant="note" tone="muted">Blokiranje i privatnu prijavu pokrećeš sa javnog profila osobe, iz Zadatka ili iz Dogovora.</T>}
      <SettingsAction label={cursor ? 'Početak liste' : 'Proveri ponovo'} kind="secondary" disabled={editor.busy}
        onPress={() => { if (cursor) setCursor(null); else void editor.refresh(); }} />
    </> : null}
    {editor.data?.items.length ? <SettingsGroup title="Tvoja blokiranja">{editor.data.items.map((item, i, all) =>
      <SettingsRow key={item.targetAccountId} label={item.displayName ?? 'USKOČI korisnik'} detail="Blokiran kontakt" last={i === all.length - 1}
        onPress={() => router.navigate({ pathname: '/bezbednost', params: { targetAccountId: item.targetAccountId } })} />)}</SettingsGroup> : null}
    {editor.error ? <><T accessibilityRole="alert" tone="danger">{editor.error}</T><SettingsAction label="Pokušaj ponovo" onPress={() => { void editor.refresh(); }} /></> : null}
    {editor.data?.nextCursor ? <SettingsAction label="Sledeći korisnici" kind="secondary" onPress={() => setCursor(editor.data!.nextCursor)} /> : null}
    {cursor && !empty ? <SettingsAction label="Početak liste" kind="quiet" onPress={() => setCursor(null)} /> : null}
  </SettingsScreen>;
}
