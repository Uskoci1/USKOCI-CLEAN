import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supportCaseClientService } from '../../data/supportCaseClientService';
import type { SupportReference } from '../../data/supportCaseTypes';
import { sesijaSada, useSesija } from '../../store/sesija';
import { ulogaSada, useUloga } from '../../store/uloga';
import { SettingsAction, SettingsPanel, SettingsText as T } from '../settings/SettingsPresentation';

/** An explicit read opens an owned existing case or a new unsent form.
 * The route contains only an opaque reference, never a narrative or snapshot. */
export function SupportContextEntry({ reference, label = 'Otvori podršku', disabled = false, canAct = () => true,
  navigate = action => action(), previewText }: { reference: SupportReference; label?: string; disabled?: boolean; previewText?: string;
    canAct?: () => boolean; navigate?: (action: () => void) => void }) {
  const { user, accountRevision } = useSesija(), accountId = user?.id ?? '', intent = useUloga();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(false), [, setEpoch] = useState(0), selectedRef = useRef(false); selectedRef.current = selected;
  const selection = useRef<{ focus: object; view: object; accountId: string; accountRevision: number; intent: typeof intent } | null>(null);
  const focus = useRef<object | null>(null), lock = useRef<object | null>(null);
  const view = useMemo(() => ({}), [reference.kind, reference.id, reference.revision, disabled, previewText]);
  const latestView = useRef(view); latestView.current = view;
  useFocusEffect(useCallback(() => {
    const token = {}; focus.current = token; lock.current = null; selection.current = null; setBusy(false); setError(null); setSelected(false); setEpoch(x => x + 1);
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active') { focus.current = null; lock.current = null; selection.current = null; setBusy(false); setError(null); setSelected(false); }
      else { focus.current = {}; lock.current = null; setBusy(false); setEpoch(x => x + 1); }
    });
    return () => { listener.remove(); focus.current = null; lock.current = null; selection.current = null; setSelected(false); };
  }, [accountId, accountRevision, intent, view]));
  const renderedFocus = focus.current;
  const selectedForView = selected && selection.current?.focus === renderedFocus && selection.current?.view === view
    && selection.current?.accountId === accountId && selection.current?.accountRevision === accountRevision && selection.current?.intent === intent;
  const previewValid = previewText === undefined || typeof previewText === 'string' && previewText.trim().length > 0 && Array.from(previewText).length <= 6000;
  const canSelect = () => renderedFocus !== null && focus.current === renderedFocus && latestView.current === view && !disabled && previewValid
    && !['background', 'inactive'].includes(AppState.currentState) && canAct()
    && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision && ulogaSada() === intent;
  const open = async () => {
    const token = renderedFocus;
    const ownLease = () => token !== null && focus.current === token && latestView.current === view
      && !['background', 'inactive'].includes(AppState.currentState)
      && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision && ulogaSada() === intent;
    const current = () => ownLease() && !disabled && canAct();
    if (!accountId || !current() || lock.current || !previewValid || previewText !== undefined && (!selectedForView || !selectedRef.current)) return;
    const operation = {}; lock.current = operation; setBusy(true); setError(null);
    const bound = { kind: reference.kind, id: reference.id, revision: reference.revision };
    try {
      const result = await supportCaseClientService.findContext(bound.kind, bound.id, { accountId, accountRevision, isCurrent: current });
      if (!current() || lock.current !== operation) return;
      if (!result.ok) { setError(result.poruka); return; }
      const target = result.podatak.caseId;
      focus.current = null;
      navigate(() => target ? router.push({ pathname: '/podrska/[id]', params: { id: target } })
        : router.push({ pathname: '/podrska/novi', params: { contextKind: bound.kind, contextId: bound.id,
          ...(bound.revision !== null ? { contextRevision: String(bound.revision) } : {}) } }));
    } catch { if (current()) setError('Postojeći zahtev nije učitan. Proveri ponovo pre nastavka.'); }
    // A parent authority refresh invalidates this result, while the same screen
    // lease still owns its busy indicator. Release that indicator without using
    // the rejected result or updating another account/focus/context.
    finally { if (lock.current === operation) { lock.current = null; if (ownLease()) setBusy(false); } }
  };
  return <>
    {!selectedForView ? <SettingsAction label={busy ? 'Proveravamo prethodni zahtev…' : label} kind="quiet" disabled={disabled || busy || !previewValid}
      onPress={() => { if (!canSelect() || lock.current) return; if (previewText !== undefined && renderedFocus) {
        selection.current = { focus: renderedFocus, view, accountId, accountRevision, intent }; setSelected(true);
      } else void open(); }} /> : null}
    {selectedForView && previewText !== undefined ? <SettingsPanel soft><T variant="heading">Izabrana poruka za privatnu podršku</T>
      <T selectable>{previewText}</T><T variant="meta" tone="muted">Uz privatni zahtev prilažeš samo ovu poruku. Ostatak razgovora se ne kopira i druga strana ne dobija zahtev.</T>
      <SettingsAction label={busy ? 'Proveravamo prethodni zahtev…' : 'Nastavi sa izabranom porukom'} disabled={disabled || busy}
        onPress={() => { void open(); }} />
      <SettingsAction label="Odustani od izbora poruke" kind="quiet" disabled={disabled || busy}
        onPress={() => { if (canSelect() && !lock.current) { selection.current = null; setSelected(false); } }} />
    </SettingsPanel> : null}
    {error ? <T tone="danger" accessibilityRole="alert">{error}</T> : null}
  </>;
}
