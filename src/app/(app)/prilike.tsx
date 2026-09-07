import { useCallback, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useDiscoveryBrowse } from '../../hooks/useDiscoveryBrowse';
import { postaviUlogu, useUloga } from '../../store/uloga';
import { WorkspaceHeader } from '../../ui/WorkspaceHeader';
import { DiscoveryBody } from '../../ui/discovery/DiscoveryBody';
import { createDiscoveryMapScope } from '../../ui/discovery/discoveryMapScope';

/** Both intentions browse one public-safe data set; details reread server authority. */
export default function Prilike() {
  const browse = useDiscoveryBrowse(), intent = useUloga(), router = useRouter();
  const cameraScope = useMemo(createDiscoveryMapScope, [browse.scope]);
  useFocusEffect(useCallback(() => {
    cameraScope.enter();
    return () => cameraScope.leave();
  }, [cameraScope]));
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#F7F8F5' }}>
    <WorkspaceHeader title="Zadaci" brand />
    <DiscoveryBody key={browse.scope} cameraScope={cameraScope} state={browse} intent={intent} refresh={browse.refresh} loadMore={browse.loadMore}
      onOpen={id => { cameraScope.suspend(); router.navigate({ pathname: '/prilike/[id]', params: { id } }); }}
      onOwn={() => { cameraScope.suspend(); router.navigate('/potrebe'); }}
      onNew={() => { cameraScope.suspend(); postaviUlogu('narucilac'); router.navigate('/nova'); }} />
  </SafeAreaView>;
}
