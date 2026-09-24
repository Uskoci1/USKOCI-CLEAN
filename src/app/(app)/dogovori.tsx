import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { DogovorProjekcija } from '../../contracts/projections';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { sesijaSada, useSesija } from '../../store/sesija';
import { izvorSada, useIzvor } from '../../store/uloga';
import { AgreementCollectionPresentation, type AgreementCollectionSection } from '../../ui/v2/AgreementCollectionPresentation';

export default function Dogovori() {
  const { user, accountRevision } = useSesija();
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
  return foreground.current.active ? <OwnedAgreements key={`${user?.id ?? ''}:${accountRevision}:${foreground.current.generation}`}
    foreground={foreground.current} /> : null;
}
function OwnedAgreements({ foreground }: { foreground: { active: boolean; generation: number } }) {
  const source = useIzvor(), { user, accountRevision } = useSesija();
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const [scope, setScope] = useState<object | null>(null);
  const readGeneration = useRef(0), foregroundGeneration = foreground.generation;
  const [section, setSection] = useState<AgreementCollectionSection>('active');
  const [confirmationOnly, setConfirmationOnly] = useState(false);
  useFocusEffect(useCallback(() => {
    const owner = {}; focus.current = owner; navigating.current = false;
    // Publish the focus token as state, exactly as Početna does. A ref written inside an effect
    // re-renders nothing, so a screen that read it during render kept the token of its FIRST
    // visit: come back to the screen and the guard compared an old token against a new one and
    // refused every press, silently, for the rest of that screen's life.
    setScope(owner);
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
  const resource = useFocusedResource(load);
  const renderedReadGeneration = readGeneration.current;
  const latest = useRef(resource); latest.current = resource;
  const current = () => foreground.active && foreground.generation === foregroundGeneration && renderedReadGeneration === readGeneration.current
    && !!scope && focus.current === scope && !!user?.id && sesijaSada().user?.id === user.id
    && sesijaSada().accountRevision === accountRevision && izvorSada() === source
    && AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  const navigate = (action: () => void) => {
    if (current() && !navigating.current) { navigating.current = true; action(); }
  };
  // A card is acted on only while it is a row of the list on screen: a retained card from an older read is refused.
  const shown = (agreement: DogovorProjekcija) => {
    const value = latest.current;
    return !value.loading && !value.error && value.data === resource.data && !!value.data?.includes(agreement);
  };
  const open = (agreement: DogovorProjekcija) => {
    if (!shown(agreement)) return;
    navigate(() => router.navigate({ pathname: '/dogovor/[id]', params: { id: agreement.id } }));
  };
  // The rating strip of a finished Dogovor goes straight to its rating (round-1 critique A2), the same route the
  // Dogovor's own footer opens, behind the same guards. The list offers it only while the Dogovor says the rating is
  // possible; the rating screen reads for itself whether mine is still due. `from` names where Back returns.
  const rate = (agreement: DogovorProjekcija) => {
    if (!shown(agreement) || agreement.stanje !== 'COMPLETED' || !agreement.ocenaMoguca) return;
    navigate(() => router.navigate({ pathname: '/oceni-dogovor', params: { agreementId: agreement.id, from: 'dogovori' } }));
  };
  return <AgreementCollectionPresentation items={resource.data ?? []} loading={resource.loading} refreshing={resource.refreshing} error={!!resource.error}
    section={section} confirmationOnly={confirmationOnly}
    onSection={value => { if (current()) setSection(value); }}
    onConfirmationOnly={value => { if (current()) setConfirmationOnly(value); }}
    onRefresh={() => { if (current()) void resource.refresh(true); }} onOpen={open} onRate={rate}
    onCalendar={() => navigate(() => router.navigate('/raspored'))}
    onProfile={() => navigate(() => router.navigate('/profil'))}
    onHome={() => navigate(() => router.navigate('/'))} />;
}
