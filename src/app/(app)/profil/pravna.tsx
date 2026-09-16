import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { LegalDocument } from '../../../contracts/legal';
import type { ProcessorLegalRole } from '../../../contracts/processorMap';
import { legalClientService } from '../../../data/legalClientService';
import { processorMapClientService } from '../../../data/processorMapClientService';
import { noviUuidZahtevId } from '../../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { ulogaSada, useUloga } from '../../../store/uloga';
import { LegalDocumentRows } from '../../../ui/legal/LegalDocuments';
import { LegalReviewController, legalHttpsUrl, reviewedDocuments, sessionLegalIntentJournal } from '../../../ui/legal/legalReview';
import { SettingsAction, SettingsGroup, SettingsInfo, SettingsIntro, SettingsPanel, SettingsScreen, SettingsText as T } from '../../../ui/settings/SettingsPresentation';
import { sys } from '../../../ui/system/tokens';

const roles: Record<ProcessorLegalRole, string> = { PROCESSOR: 'Obrađivač', SUBPROCESSOR: 'Podobrađivač', INDEPENDENT_CONTROLLER: 'Samostalni rukovalac' };
export default function PravnaDokumenta() {
  const { user, accountRevision } = useSesija(), role = useUloga();
  return <OwnedLegal key={`${user?.id ?? ''}:${accountRevision}:${role}`} />;
}
function OwnedLegal() {
  const { user, accountRevision } = useSesija(), role = useUloga(), accountId = user?.id;
  const focus = useRef<object | null>(null), opening = useRef(false), leaving = useRef(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const owner = useCallback(() => !!accountId && sesijaSada().user?.id === accountId &&
    sesijaSada().accountRevision === accountRevision && ulogaSada() === role, [accountId, accountRevision, role]);
  const controller = useMemo(() => new LegalReviewController({ isOwner: owner, newId: noviUuidZahtevId,
    intentJournal: sessionLegalIntentJournal(`${accountId ?? ''}:${accountRevision}`),
    readBundle: () => legalClientService.readBundle(), readProcessors: () => processorMapClientService.readStatus(),
    accept: (key, terms, privacy) => legalClientService.acceptReviewedBundle(key, terms, privacy),
    readAcceptance: key => legalClientService.readAcceptance(key) }), [owner, accountId, accountRevision]);
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);
  useFocusEffect(useCallback(() => {
    const token = {}; focus.current = token; leaving.current = false; setLinkError(null); controller.activate();
    return () => { if (focus.current === token) focus.current = null; controller.deactivate(); };
  }, [controller]));
  const renderedFocus = focus.current;
  const current = () => !!renderedFocus && focus.current === renderedFocus && owner() && !leaving.current;
  const back = () => { if (!current()) return; leaving.current = true; controller.deactivate();
    if (router.canGoBack()) router.back(); else router.replace('/profil'); };
  const openUrl = async (value: string) => {
    const url = legalHttpsUrl(value), token = focus.current;
    if (!current() || !url || opening.current) return;
    opening.current = true; setLinkError(null);
    try { await Linking.openURL(url); }
    catch { if (focus.current === token && current()) setLinkError('Dokument nije otvoren. Pokušajte ponovo.'); }
    finally { opening.current = false; }
  };
  const documents = reviewedDocuments(state.bundle);
  const receiptCurrent = state.receipt && documents && documents[0].sha256 === state.receipt.termsSha256 && documents[1].sha256 === state.receipt.privacySha256;
  const confirmed = state.bundle?.acceptedCurrentBundle || !!receiptCurrent;
  const action = state.pending ? <SettingsAction label={state.busy ? 'Provera je u toku…' : state.pending === 'READ_REQUIRED' ? 'Proverite ishod prihvatanja' : 'Ponovite isto prihvatanje'}
    disabled={state.busy || state.loading} onPress={() => { if (!current()) return; void (state.pending === 'READ_REQUIRED' ? controller.readOutcome() : controller.accept(state.bundle)); }} />
    : documents && !confirmed ? <SettingsAction label={state.busy ? 'Beleženje prihvatanja…' : 'Prihvatite pregledane dokumente'} disabled={state.busy || state.loading}
      onPress={() => { if (current()) void controller.accept(state.bundle); }} /> : null;
  return <SettingsScreen title="Pravna dokumenta" onBack={back} footer={action}>
    <SettingsIntro kicker="JASNO I DOSTUPNO" title="Uslovi i privatnost.">Pročitajte važeće dokumente i podatke o obradi svojih podataka.</SettingsIntro>
    {state.loading ? <ActivityIndicator accessibilityLabel="Učitavanje pravnih dokumenata" color={sys.color.green} /> : <>
      <LegalDocumentRows bundle={state.bundle} disabled={state.busy} onOpen={(doc: LegalDocument) => { void openUrl(doc.url); }} />
      {confirmed ? <SettingsPanel soft><T accessibilityLiveRegion="polite">Prihvaćene su aktuelne verzije dokumenata.</T></SettingsPanel>
        : state.receipt ? <SettingsPanel soft><T>Prethodno prihvatanje je potvrđeno. Učitajte aktuelne dokumente ponovo.</T></SettingsPanel> : null}
      <SettingsGroup title="Obrađivači podataka">
        {state.processors?.ready ? <SettingsInfo title={`Mapa obrade · ${state.processors.mapVersion}`} last>Podaci iz objavljene mape obrade.</SettingsInfo>
          : <SettingsInfo title={state.processorError ? 'Podaci o obrađivačima nisu dostupni' : 'Mapa obrade još nije objavljena'} last>{state.processorError ?? 'Podaci će biti dostupni kada bude objavljena potpuna mapa obrade.'}</SettingsInfo>}
      </SettingsGroup>
      {state.processors?.ready ? state.processors.providers.map(provider => <SettingsPanel soft key={provider.providerCode}>
        <T variant="heading" accessibilityRole="header">{provider.providerDisplayName}</T>
        <T variant="meta" tone="muted">{provider.legalEntityName} · {roles[provider.legalRole]}</T>
        {[
          ['Svrha obrade', provider.purpose], ['Podaci koji se obrađuju', provider.dataCategories.join(', ')],
          ['Regioni obrade', provider.processingRegions], ['Prenos podataka', provider.crossBorderTransfer ? provider.transferMechanism : 'Bez međunarodnog prenosa prema objavljenoj mapi.'],
          ['Čuvanje i brisanje', provider.retentionDeletionTerms], ['Podobrađivači', provider.subprocessorTerms],
          ['Osnov obrade', provider.legalBasisReference], ['Ugovor o obradi', provider.dpaReference],
        ].filter(([, value]) => !!value).map(([title, value]) => <View key={title} style={{ gap: 3 }}><T variant="bodyStrong">{title}</T><T variant="meta" tone="muted">{value}</T></View>)}
        <SettingsAction label={`Obaveštenje o privatnosti · ${provider.providerDisplayName}`} kind="quiet" onPress={() => { void openUrl(provider.privacyNoticeUrl); }} />
      </SettingsPanel>) : null}
      <SettingsAction label="Učitajte stanje ponovo" kind="quiet" disabled={state.busy} onPress={() => { if (current()) void controller.refresh(); }} />
    </>}
    {state.error || linkError ? <SettingsPanel><T accessibilityRole="alert" accessibilityLiveRegion="polite">{linkError ?? state.error}</T></SettingsPanel> : null}
  </SettingsScreen>;
}
