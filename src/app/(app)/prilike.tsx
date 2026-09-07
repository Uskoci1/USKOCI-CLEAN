import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useDiscoveryBrowse } from '../../hooks/useDiscoveryBrowse';
import { postaviUlogu, useUloga } from '../../store/uloga';
import { WorkspaceHeader } from '../../ui/WorkspaceHeader';
import { DiscoveryBody } from '../../ui/discovery/DiscoveryBody';

/** Both intentions browse one public-safe data set; details reread server authority. */
export default function Prilike() {
  const browse = useDiscoveryBrowse(), intent = useUloga(), router = useRouter();
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#F7F8F5' }}>
    <WorkspaceHeader title="Zadaci" />
    <DiscoveryBody key={browse.scope} state={browse} intent={intent} refresh={browse.refresh} loadMore={browse.loadMore}
      onOpen={id => router.navigate({ pathname: '/prilike/[id]', params: { id } })}
      onOwn={() => router.navigate('/potrebe')} onNew={() => { postaviUlogu('narucilac'); router.navigate('/nova'); }} />
  </SafeAreaView>;
}
