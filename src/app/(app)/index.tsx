import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { composeHome, readHomeSection, type HomeAttentionPreview, type HomeReads, type HomeSection, type HomeTarget } from '../../data/homeSnapshot';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { sesijaSada, useSesija } from '../../store/sesija';
import { izvorSada, useIzvor } from '../../store/uloga';
import { HomePresentation } from '../../ui/home/HomePresentation';

/**
 * Početna: the root of the one shell (owner decision 1, 2026-09-19). This route used to be a
 * redirect that read a global mode and sent the person to Zadaci or to Prijave. It now answers
 * "what waits for me" from the account-owned server aggregate, shows the next Dogovor, counts my own
 * tasks and my applications from the reads it already makes, and offers the two things a person can
 * start. It reads no mode and sets none.
 */
export default function Pocetna() {
  const { user, accountRevision } = useSesija();
  return <Home key={`${user?.id ?? ''}:${accountRevision}`} />;
}
function Home() {
  const source = useIzvor(), { user, accountRevision } = useSesija();
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const [scope, setScope] = useState<object | null>(null);
  useFocusEffect(useCallback(() => {
    const owner = {}; focus.current = owner; navigating.current = false;
    // A silent refresh keeps the old snapshot without an immediate render. Publish
    // this focus token now so current actions do not wait for a network response;
    // callbacks retained from a previous focus still fail the identity check below.
    setScope(owner);
    return () => { if (focus.current === owner) focus.current = null; };
  }, []));
  const load = useCallback(async (): Promise<HomeReads & { attention: HomeSection<HomeAttentionPreview> }> => {
    const [needs, applications, agreements, attention] = await Promise.all([
      readHomeSection(() => source.mojePotrebe()), readHomeSection(() => source.mojePrijave()), readHomeSection(() => source.mojiDogovori()),
      readHomeSection(() => source.paznjaZaPocetnu())]);
    // Every failed read is unavailable, never an account with nothing in it.
    if ([needs, applications, agreements, attention].every(part => part.kind === 'unavailable')) throw new Error('HOME_READ_FAILED');
    return { needs, applications, agreements, attention };
  }, [source]);
  const resource = useFocusedResource(load);
  const home = useMemo(() => resource.data ? composeHome(resource.data, resource.data.attention) : null, [resource.data]);
  const current = () => !!scope && focus.current === scope && !!user?.id && sesijaSada().user?.id === user.id
    && sesijaSada().accountRevision === accountRevision && izvorSada() === source
    && AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  const navigate = (action: () => void) => { if (current() && !navigating.current) { navigating.current = true; action(); } };
  const open = (target: HomeTarget) => navigate(() => {
    if (target.kind === 'NEED') router.navigate({ pathname: '/potrebe/[id]/pregled', params: { id: target.needId } });
    else if (target.kind === 'CANDIDATES') router.navigate({ pathname: '/potrebe/[id]/kandidati', params: { id: target.needId } });
    else if (target.kind === 'AGREEMENT') router.navigate({ pathname: '/dogovor/[id]', params: { id: target.agreementId } });
    else router.navigate({ pathname: '/moje-prijave', params: { prijavaId: target.applicationId } });
  });
  // My own tasks and my applications are reached from here, as two front doors; "Moje aktivnosti" is no longer a
  // destination (2026-09-23). Every press keeps the focus, account and foreground guards above.
  return <HomePresentation home={home} loading={resource.loading} refreshing={resource.refreshing} error={!!resource.error}
    onPublish={() => navigate(() => router.navigate('/nova'))} onEarn={() => navigate(() => router.navigate('/zadaci'))}
    onProfile={() => navigate(() => router.navigate('/profil'))} onOpen={open}
    // One completed Dogovor waiting for my rating, named by the Dogovori read: its rating opens in one tap (critique A1,
    // 2026-09-24), exactly as the Dogovor screen opens it. Several, or none known: Dogovori, where each one waits.
    onRatings={agreementId => navigate(() => agreementId
      ? router.navigate({ pathname: '/oceni-dogovor', params: { agreementId } }) : router.navigate('/dogovori'))}
    onMyTasks={() => navigate(() => router.navigate('/potrebe'))}
    onMyApplications={() => navigate(() => router.navigate('/moje-prijave'))}
    onRefresh={() => { if (current()) void resource.refresh(true); }} />;
}
