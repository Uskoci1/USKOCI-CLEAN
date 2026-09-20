import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { composeActivities, readHomeSection, type ActivityFilter, type HomeReads, type HomeTarget } from '../../data/homeSnapshot';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { sesijaSada, useSesija } from '../../store/sesija';
import { izvorSada, useIzvor } from '../../store/uloga';
import { ActivitiesPresentation } from '../../ui/home/ActivitiesPresentation';

/**
 * Moje aktivnosti v1 (second V3 slice, 2026-09-19): the same three reads as Početna, as one list
 * with two filters. There is no paging because the two list RPCs offer none; that is a
 * READ_CONTRACT item for the third slice, and nothing here invents a cursor.
 */
export default function MojeAktivnosti() {
  const { user, accountRevision } = useSesija();
  return <Activities key={`${user?.id ?? ''}:${accountRevision}`} />;
}
function Activities() {
  const source = useIzvor(), { user, accountRevision } = useSesija();
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const [scope, setScope] = useState<object | null>(null);
  const [filter, setFilter] = useState<ActivityFilter>({ relation: 'ALL', period: 'ACTIVE' });
  useFocusEffect(useCallback(() => {
    const owner = {}; focus.current = owner; navigating.current = false;
    // Publish the focus token as state, exactly as Početna does. A ref written inside an effect
    // re-renders nothing, so a screen that read it during render kept the token of its FIRST
    // visit: come back to the screen and the guard compared an old token against a new one and
    // refused every press, silently, for the rest of that screen's life.
    setScope(owner);
    return () => { if (focus.current === owner) focus.current = null; };
  }, []));
  const load = useCallback(async (): Promise<HomeReads> => {
    const [needs, applications, agreements] = await Promise.all([
      readHomeSection(() => source.mojePotrebe()), readHomeSection(() => source.mojePrijave()), readHomeSection(() => source.mojiDogovori())]);
    if (needs.kind === 'unavailable' && applications.kind === 'unavailable') throw new Error('ACTIVITIES_READ_FAILED');
    return { needs, applications, agreements };
  }, [source]);
  const resource = useFocusedResource(load);
  const page = useMemo(() => resource.data ? composeActivities(resource.data, filter) : null, [resource.data, filter]);
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
  return <ActivitiesPresentation page={page} filter={filter} loading={resource.loading} refreshing={resource.refreshing} error={!!resource.error}
    onFilter={next => { if (current()) setFilter(next); }} onOpen={open}
    onBack={() => navigate(() => { if (router.canGoBack()) router.back(); else router.replace('/'); })}
    onRefresh={() => { if (current()) void resource.refresh(true); }} />;
}
