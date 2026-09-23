import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import type { PotrebaProjekcija } from '../../contracts/projections';
import type { NeedLifecycleCommand } from '../../contracts/needLifecycle';
import { createNeedLifecycleController, type NeedLifecycleState } from '../../data/needLifecycleController';
import { positiveInteger, uuid } from '../../data/serverReceipt';
import { sesijaSada, useSesija } from '../../store/sesija';
import { useIzvor } from '../../store/uloga';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { sys } from '../system/tokens';

type Action = NeedLifecycleCommand['action'];
type Controller = ReturnType<typeof createNeedLifecycleController>;
type ViewState = { loading: boolean; review: Action | null; command: NeedLifecycleCommand | null;
  state: NeedLifecycleState | null; error: string | null };
const initial: ViewState = { loading: true, review: null, command: null, state: null, error: null };
const label = (action: Action) => action === 'DELETE_DRAFT' ? 'Obriši nacrt' : 'Otkaži zadatak';

/** Existing revision-bound terminal authority. Persist only opaque command identity;
 * restoration reads the private receipt and never infers deletion from a list.
 * Recovery is deliberately mountable without the Need row: a successful delete
 * may make that row disappear before the client receives its terminal reply. */
export function NeedLifecycleActions(p: { need: PotrebaProjekcija | null; needId?: string; disabled: boolean;
  onActiveChange: (active: boolean) => void; onRefresh: () => void }) {
  const { user, accountRevision } = useSesija(), source = useIzvor();
  const accountId = user?.id ?? '', needId = p.need?.id ?? p.needId ?? '';
  const storageKey = `uskoci:need-lifecycle:v5:${accountId}:${needId}`;
  const [view, setView] = useState<ViewState>(initial), [reload, setReload] = useState(0);
  const latestView = useRef(view); latestView.current = view;
  const scope = useRef<object | null>(null), controller = useRef<Controller | null>(null);
  const latch = useRef(false), latest = useRef(p); latest.current = p;
  const foreground = () => !['background', 'inactive'].includes(AppState.currentState);
  // Whose Task this is was settled before this mounted: the Need comes from the owner-only read, a
  // restored command is stored under this account, and the server checks ownership on every
  // command. The mode the app is in was a fourth condition here and answered a different question
  // (owner decision 1, 2026-09-19). It stays in the guard only as the staleness identity it shares
  // with every other screen.
  const current = (owner: object | null) => owner !== null && scope.current === owner && foreground()
    && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
  const install = (owner: object, command: NeedLifecycleCommand, restoring: boolean) => {
    const engine = createNeedLifecycleController({ account: { accountId, accountRevision }, command,
      restoreUnknownOutcome: restoring,
      currentAccount: () => current(owner) ? { accountId, accountRevision } : null,
      refreshOwnedNeeds: async () => { if (!current(owner)) throw new Error('ACCOUNT_CHANGED'); await source.mojePotrebe(); },
    });
    controller.current = engine;
    const render = () => { if (current(owner)) setView({ loading: false, review: null, command, state: engine.snapshot(), error: null }); };
    engine.subscribe(render); render(); return engine;
  };
  useFocusEffect(useCallback(() => {
    const owner = {}; scope.current = owner; latch.current = false; setView(initial);
    let retired = false;
    const restore = async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (retired || !current(owner)) return;
        if (raw === null) { setView({ ...initial, loading: false }); return; }
        const command: NeedLifecycleCommand = JSON.parse(raw);
        if (!command || !uuid(command.needId) || command.needId !== needId || !positiveInteger(command.expectedRevision)
          || !['CANCEL', 'DELETE_DRAFT'].includes(command.action) || command.reason !== '') throw new Error('INVALID_RESTORE');
        const engine = install(owner, Object.freeze(command), true);
        await engine.reconcile();
      } catch { if (!retired && current(owner)) setView({ ...initial, loading: false,
        error: 'Prethodni zahtev nije moguće proveriti. Pokušaj ponovo pre nove radnje.' }); }
    };
    void restore();
    const app = AppState.addEventListener('change', state => {
      if (state !== 'active') { controller.current?.dispose(); controller.current = null; scope.current = null; }
      else if (!retired) setReload(value => value + 1);
    });
    return () => { retired = true; app.remove(); controller.current?.dispose(); controller.current = null;
      if (scope.current === owner) scope.current = null; latch.current = false; };
  // The scope owns every async continuation; render-time callbacks are intentionally
  // not dependencies that could retire a command on its own state update.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, accountRevision, needId, source, storageKey, reload]));
  const active = view.loading || view.review !== null || view.command !== null || view.error !== null;
  useEffect(() => { p.onActiveChange(active); return () => p.onActiveChange(false); }, [active, p.onActiveChange]);
  const owner = scope.current;
  const eligible = (action: Action) => {
    const need = latest.current.need;
    return current(owner) && !!need && need.id === needId && !latest.current.disabled && !latch.current
      && need.pokrivenost.popunjeno === 0 && need.stanje !== 'ZATVORENA'
      && (action !== 'DELETE_DRAFT' || need.stanje === 'NACRT');
  };
  const review = (action: Action) => { if (latestView.current === view && !active && eligible(action)) setView({ ...view, review: action, error: null }); };
  const submit = async () => {
    const action = view.review, need = p.need, currentNeed = latest.current.need;
    if (latestView.current !== view || !action || view.command || !need || !currentNeed || !eligible(action)
      || currentNeed.revizija !== need.revizija || !owner) return;
    latch.current = true;
    const command = Object.freeze({ action, needId, expectedRevision: need.revizija, reason: '' });
    try {
      // Persist before sending. A storage failure never licenses an untracked write.
      await AsyncStorage.setItem(storageKey, JSON.stringify(command));
      if (!current(owner)) return;
      const engine = install(owner, command, false); await engine.submit();
    } catch { if (current(owner)) setView({ ...view, error: 'Zahtev nije poslat jer nije sačuvana njegova potvrda. Pokušaj ponovo.' }); }
    finally { if (current(owner)) latch.current = false; }
  };
  const run = (operation: 'reconcile' | 'retrySame' | 'refreshCollection') => {
    if (current(owner) && !latch.current) void controller.current?.[operation]();
  };
  const finish = async (navigate: boolean) => {
    if (!current(owner) || latch.current || !['CONFIRMED', 'REJECTED'].includes(view.state?.phase ?? '')) return;
    latch.current = true;
    try {
      await AsyncStorage.removeItem(storageKey); if (!current(owner)) return;
      controller.current?.dispose(); controller.current = null;
      if (navigate) router.replace('/potrebe'); else { setReload(value => value + 1); p.onRefresh(); }
    } catch { if (current(owner)) setView({ ...view, error: 'Potvrda je sačuvana. Pokušaj ponovo da nastaviš.' }); }
    finally { if (current(owner)) latch.current = false; }
  };
  const phase = view.state?.phase;
  const busy = view.loading || phase === 'SUBMITTING' || phase === 'RECONCILING';
  // With no current row and no retained command there is no lifecycle UI to show.
  // The initial loading pass still runs so a retained command can be recovered.
  if (!p.need && !view.loading && !view.state && !view.error) return null;
  return <View style={s.panel}>
    <T style={s.title}>Upravljanje zadatkom</T>
    {view.error ? <T accessibilityLiveRegion="polite" style={s.error}>{view.error}</T> : null}
    {view.loading ? <T accessibilityLiveRegion="polite" style={s.copy}>Proveravamo prethodni zahtev…</T>
      : view.state ? <>
        <T accessibilityLiveRegion="polite" style={s.copy}>{phase === 'CONFIRMED'
          ? view.command?.action === 'DELETE_DRAFT' ? 'Server je potvrdio brisanje nacrta.' : 'Server je potvrdio otkazivanje zadatka.'
          : phase === 'SUBMITTING' ? 'Šaljem pregledani zahtev…' : phase === 'RECONCILING' ? 'Proveravamo potvrdu…'
            : view.state.error?.poruka ?? 'Ponovo otvori zadatak.'}</T>
        {phase === 'UNKNOWN_OUTCOME' ? <>
          <V2Action label="Proveri ishod" kind="quiet" onPress={() => run('reconcile')} />
          <V2Action label="Ponovi isti zahtev" kind="quiet" disabled={!controller.current?.canRetrySame()} onPress={() => run('retrySame')} />
          <T style={s.copy}>Ponavljanje je dostupno tek posle uspešne provere. Zadržava istu radnju i verziju zadatka.</T>
        </> : phase === 'CONFIRMED' ? <>
          {view.state.collectionRefreshRequired ? <V2Action label="Osveži moje zadatke" kind="quiet" onPress={() => run('refreshCollection')} /> : null}
          <V2Action label="Moji zadaci" onPress={() => { void finish(true); }} />
        </> : phase === 'REJECTED' ? <V2Action label="Učitaj aktuelni zadatak" kind="quiet" onPress={() => { void finish(false); }} /> : null}
      </> : view.review && p.need ? <>
        <T style={s.title}>{label(view.review)}?</T><T style={s.copy}>{view.review === 'DELETE_DRAFT'
          ? 'Brišeš ovaj neobjavljeni nacrt. Radnja se ne može poništiti. Fotografije prvo ukloni iz nacrta.'
          : 'Zadatak prestaje da prima prijave, a postojeće prijave se zatvaraju. Ako već postoji Dogovor, otkazivanje ide kroz taj Dogovor.'}</T>
        <T style={s.copy}>{p.need.naslov}</T>
        <V2Action label={label(view.review)} disabled={busy || p.disabled} onPress={() => { void submit(); }} />
        <V2Action label="Odustani" kind="quiet" disabled={busy} onPress={() => { if (latestView.current === view && current(owner) && !latch.current && !controller.current) setView({ ...initial, loading: false }); }} />
      </> : view.error ? <V2Action label="Ponovo proveri prethodni zahtev" kind="quiet" onPress={() => { if (current(owner)) setReload(value => value + 1); }} />
        : !p.need ? null
          : p.need.pokrivenost.popunjeno > 0 ? <><T style={s.copy}>Postojeći Dogovori se otkazuju zasebno.</T>
            <V2Action label="Otvori moje Dogovore" kind="quiet" disabled={p.disabled} onPress={() => { if (current(owner) && !p.disabled) router.push('/dogovori'); }} /></>
            : p.need.stanje !== 'ZATVORENA' ? <>
              {/* Two quiet buttons of the same weight, one of which destroys the draft for good. */}
              {p.need.stanje === 'NACRT' ? <V2Action label="Obriši nacrt" kind="destructive" disabled={p.disabled} onPress={() => review('DELETE_DRAFT')} /> : null}
              <V2Action label="Otkazivanje zadatka" kind="quiet" disabled={p.disabled} onPress={() => review('CANCEL')} />
            </> : <T style={s.copy}>Zadatak je zatvoren.</T>}
  </View>;
}
/** PKG-011: same controller and copies; a card on the shared system. */
const s = StyleSheet.create({ panel: { gap: 12, padding: 18, borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
  title: { ...sys.type.heading, color: sys.color.ink },
  copy: { ...sys.type.note, color: sys.color.muted }, error: { ...sys.type.note, color: sys.color.danger } });
