import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { DogovorProjekcija } from '../../contracts/projections';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { sesijaSada, useSesija } from '../../store/sesija';
import { izvorSada, ulogaSada, useIzvor, useUloga } from '../../store/uloga';
import { AgreementCollectionPresentation, type AgreementCollectionSection } from '../../ui/v2/AgreementCollectionPresentation';

export default function Dogovori() {
  const { user, accountRevision } = useSesija(), intent = useUloga();
  const foreground = useRef({ active: AppState.currentState !== 'background' && AppState.currentState !== 'inactive', generation: 0 });
  const [, render] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', value => {
      const active = value === 'active';
      if (foreground.current.active === active) return;
      foreground.current.active = active; foreground.current.generation++;
      render(foreground.current.generation);
    });
    return () => subscription.remove();
  }, []);
  // Retire private rows and callbacks synchronously, including a batched
  // background→foreground transition; returning creates a fresh owned read.
  return foreground.current.active ? <OwnedAgreements key={`${user?.id ?? ''}:${accountRevision}:${intent}:${foreground.current.generation}`}
    foreground={foreground.current} /> : null;
}
function OwnedAgreements({ foreground }: { foreground: { active: boolean; generation: number } }) {
  const source = useIzvor(), intent = useUloga(), { user, accountRevision } = useSesija();
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const readGeneration = useRef(0), foregroundGeneration = foreground.generation;
  const [section, setSection] = useState<AgreementCollectionSection>('active');
  const [confirmationOnly, setConfirmationOnly] = useState(false);
  useFocusEffect(useCallback(() => {
    const owner = {}; focus.current = owner; navigating.current = false;
    return () => { if (focus.current === owner) focus.current = null; };
  }, [source]));
  const load = useCallback(async () => {
    readGeneration.current++;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([source.mojiDogovori(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('AGREEMENTS_READ_TIMEOUT')), 15_000);
      })]);
    } finally { if (timer) clearTimeout(timer); }
  }, [source]);
  const resource = useFocusedResource(load), scope = focus.current;
  const renderedReadGeneration = readGeneration.current;
  const latest = useRef(resource); latest.current = resource;
  const current = () => foreground.active && foreground.generation === foregroundGeneration && renderedReadGeneration === readGeneration.current
    && !!scope && focus.current === scope && !!user?.id && sesijaSada().user?.id === user.id
    && sesijaSada().accountRevision === accountRevision && ulogaSada() === intent && izvorSada() === source
    && AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  const navigate = (action: () => void) => {
    if (current() && !navigating.current) { navigating.current = true; action(); }
  };
  const open = (agreement: DogovorProjekcija) => {
    const value = latest.current;
    if (value.loading || value.error || value.data !== resource.data || !value.data?.includes(agreement)) return;
    navigate(() => router.navigate({ pathname: '/dogovor/[id]', params: { id: agreement.id } }));
  };
  return <AgreementCollectionPresentation items={resource.data ?? []} loading={resource.loading} error={!!resource.error}
    section={section} confirmationOnly={confirmationOnly} requester={intent === 'narucilac'}
    onSection={value => { if (current()) setSection(value); }}
    onConfirmationOnly={value => { if (current()) setConfirmationOnly(value); }}
    onRefresh={() => { if (current()) void resource.refresh(); }} onOpen={open}
    onCalendar={() => navigate(() => router.navigate('/raspored'))}
    onProfile={() => navigate(() => router.navigate('/profil'))}
    onTasks={() => navigate(() => router.navigate(intent === 'narucilac' ? '/potrebe' : '/prilike'))} />;
}
