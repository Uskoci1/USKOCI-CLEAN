import { useCallback, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { composeHome, readHomeSection, type HomeReads, type HomeTarget } from '../../data/homeSnapshot';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { sesijaSada, useSesija } from '../../store/sesija';
import { izvorSada, useIzvor } from '../../store/uloga';
import { HomePresentation } from '../../ui/home/HomePresentation';

/**
 * Početna: the root of the one shell (owner decision 1, 2026-09-19). This route used to be a
 * redirect that read a global mode and sent the person to Zadaci or to Prijave. It now answers
 * "what waits for me" for the whole account at once, from the three reads that already exist, and
 * offers the two things a person can start. It reads no mode and sets none.
 */
export default function Pocetna() {
  const { user, accountRevision } = useSesija();
  return <Home key={`${user?.id ?? ''}:${accountRevision}`} />;
}
function Home() {
  const source = useIzvor(), { user, accountRevision } = useSesija();
  const focus = useRef<object | null>(null), navigating = useRef(false);
  useFocusEffect(useCallback(() => {
    const owner = {}; focus.current = owner; navigating.current = false;
    return () => { if (focus.current === owner) focus.current = null; };
  }, []));
  const load = useCallback(async (): Promise<HomeReads> => {
    const [needs, applications, agreements] = await Promise.all([
      readHomeSection(() => source.mojePotrebe()), readHomeSection(() => source.mojePrijave()), readHomeSection(() => source.mojiDogovori())]);
    // Three failures out of three is a failed read, not an account with nothing in it.
    if ([needs, applications, agreements].every(part => part.kind === 'unavailable')) throw new Error('HOME_READ_FAILED');
    return { needs, applications, agreements };
  }, [source]);
  const resource = useFocusedResource(load), scope = focus.current;
  const home = useMemo(() => resource.data ? composeHome(resource.data) : null, [resource.data]);
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
  return <HomePresentation home={home} loading={resource.loading} refreshing={resource.refreshing} error={!!resource.error}
    onPublish={() => navigate(() => router.navigate('/nova'))} onEarn={() => navigate(() => router.navigate('/mapa'))}
    onProfile={() => navigate(() => router.navigate('/profil'))} onOpen={open}
    onAllAgreements={() => navigate(() => router.navigate('/dogovori'))}
    onAllActivities={() => navigate(() => router.navigate('/moje-aktivnosti'))}
    onRefresh={() => { if (current()) void resource.refresh(true); }} />;
}
