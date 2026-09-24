import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { safetyClientService } from '../../../data/safetyClientService';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { noviUuidZahtevId } from '../../../lib/idempotencija';
import { useSesija } from '../../../store/sesija';
import { useConfirmSheet } from '../../../ui/system/ConfirmSheet';
import { BlockedAccountsList, blockedName, type BlockedAccount } from '../../../ui/settings/BlockedAccountsList';
import { SettingsScreen } from '../../../ui/settings/SettingsPresentation';

export default function BlockedAccounts() {
  const { user, accountRevision } = useSesija();
  return <OwnedBlocks key={`${user?.id}:${accountRevision}`} />;
}

/**
 * The people you block (step 11a, 2026-09-24): each is a person row with their own "Odblokiraj", asked once in a sheet
 * before the command goes. Opening the person still leads to the private report and the block itself. The unblock is
 * the existing revisioned, idempotent command: one request id per blocked revision, reused when the same unblock is
 * tried again, and nothing else is sent until the list has been read again after a refused or unknown outcome.
 */
function OwnedBlocks() {
  const [cursor, setCursor] = useState<string | null>(null);
  const read = useCallback(() => safetyClientService.listMyBlocks(cursor), [cursor]), editor = useOwnedEditor(read);
  const confirmation = useConfirmSheet();
  const commands = useRef(new Map<string, { revision: number; id: string }>());
  const [pending, setPending] = useState<string | null>(null);
  const lastUnblocked = useRef<string | null>(null);
  const closeConfirmation = confirmation.close;
  // A question left open is retired whenever its answer would land on a list that is no longer the one it was asked on.
  useFocusEffect(useCallback(() => () => closeConfirmation(), [closeConfirmation]));
  const refresh = () => { closeConfirmation(); void editor.refresh(); };
  const page = (next: string | null) => { closeConfirmation(); setCursor(next); };
  async function unblock(item: BlockedAccount) {
    const target = item.targetAccountId, name = blockedName(item);
    let command = commands.current.get(target);
    if (!command || command.revision !== item.revision) {
      command = { revision: item.revision, id: noviUuidZahtevId() };
      commands.current.set(target, command);
    }
    const frozen = command;
    setPending(target);
    try {
      await editor.save(async () => {
        lastUnblocked.current = name;
        const result = await safetyClientService.setBlock({ targetAccountId: target, blocked: false,
          expectedRevision: frozen.revision, clientRequestId: frozen.id });
        if (!result.ok) return result;
        commands.current.delete(target);
        return safetyClientService.listMyBlocks(cursor);
      });
    } finally { setPending(null); }
  }
  const askUnblock = (item: BlockedAccount) => confirmation.ask({ title: blockedName(item),
    message: 'Odblokiranje ne vraća ranije dozvole za deljenje kontakta ili tačne lokacije.', confirmLabel: 'Odblokiraj',
    onConfirm: () => unblock(item) });
  return <SettingsScreen title="Blokirani korisnici" onBack={() => router.canGoBack() ? router.back() : router.replace('/profil')}>
    <BlockedAccountsList data={editor.data} loading={editor.loading} busy={editor.busy} error={editor.error} uncertain={editor.uncertain}
      cursor={cursor} pending={pending}
      notice={editor.saved && lastUnblocked.current ? `Blokiranje je uklonjeno: ${lastUnblocked.current}.` : null}
      onOpen={item => router.navigate({ pathname: '/bezbednost', params: { targetAccountId: item.targetAccountId } })}
      onUnblock={askUnblock} onRefresh={refresh} onPage={page} />
    {confirmation.sheet}
  </SettingsScreen>;
}
