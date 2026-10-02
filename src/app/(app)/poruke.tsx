import { useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ConversationInboxItem } from '../../contracts/conversationInbox';
import { conversationInboxBuilt } from '../../data/conversationInboxGate';
import { useConversationInbox } from '../../hooks/useConversationInbox';
import { useSesija, sesijaSada } from '../../store/sesija';
import { ConversationInboxPresentation } from '../../ui/messages/ConversationInboxPresentation';
import { ScreenHeader } from '../../ui/system/ScreenHeader';
import { DetailTopBar } from '../../ui/system/DetailTopBar';
import { StateView } from '../../ui/system/StateView';
import { sys } from '../../ui/system/tokens';

export default function Poruke() {
  // An unpaired build never probes for a missing reader or calls notifications a conversation list.
  if (!conversationInboxBuilt()) return <SafeAreaView style={{ flex: 1, backgroundColor: sys.color.surface }}>
    <DetailTopBar title="Poruke" onBack={() => router.canGoBack() ? router.back() : router.replace('/dogovori')} />
    <StateView kind="empty" title="Razgovori su u Dogovorima" body="Otvori Dogovor da nastaviš dopisivanje."
      primary={{ label: 'Otvori Dogovore', onPress: () => router.replace('/dogovori') }} />
  </SafeAreaView>;
  return <ConversationInbox />;
}

function ConversationInbox() {
  const { state, model } = useConversationInbox();
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const visit = useRef<object | null>(null), navigating = useRef(false);
  useFocusEffect(useCallback(() => {
    const token = {}; visit.current = token; navigating.current = false;
    return () => { if (visit.current === token) visit.current = null; };
  }, [model]));
  const active = () => visit.current !== null && !navigating.current && !!accountId
    && !['background', 'inactive'].includes(AppState.currentState)
    && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
  const navigate = (action: () => void) => { if (active()) { navigating.current = true; action(); } };
  const open = (row: ConversationInboxItem) => {
    if (!active() || !model.canOpen(row)) return;
    // Route IDs are intents only. Each destination independently reauthorizes the Agreement/history.
    navigate(() => row.kind === 'GROUP'
      ? router.push({ pathname: '/dogovor/[id]/grupa', params: { id: row.routeAgreementId, from: 'poruke' } })
      : router.push({ pathname: '/dogovor/[id]', params: { id: row.routeAgreementId, tab: 'poruke', from: 'poruke' } }));
  };
  const latestOpen = useRef(open); latestOpen.current = open;
  const onOpen = useCallback((row: ConversationInboxItem) => latestOpen.current(row), []);
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: sys.color.surface }}>
    <ConversationInboxPresentation items={state.page?.items ?? null} loading={state.loading} refreshing={state.refreshing}
      error={(!state.page && !!state.error) || state.error === 'load' || state.error === 'refresh'} paging={state.paging} pageError={state.error === 'page'}
      hasMore={!!state.page?.nextCursor} openingDisabled={state.stale} onOpen={onOpen}
      onRefresh={() => { if (active()) void model.refresh(); }} onLoadMore={() => { if (active()) void model.more(); }}
      onAgreements={() => navigate(() => router.push('/dogovori'))}
      header={<ScreenHeader title="Poruke" onProfile={() => navigate(() => router.push('/profil'))} />} />
  </SafeAreaView>;
}
