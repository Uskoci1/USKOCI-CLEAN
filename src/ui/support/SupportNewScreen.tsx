import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import type { DogovorProjekcija } from '../../contracts/projections';
import { agreementClientService } from '../../data/agreementClientService';
import type { SupportPayloads, SupportReference, SupportTopic } from '../../data/supportCaseTypes';
import { positiveInteger, uuid } from '../../data/serverReceipt';
import { SettingsAction, SettingsGroup, SettingsIntro, SettingsPanel, SettingsRow, SettingsText as T } from '../settings/SettingsPresentation';
import { SupportField, SupportFrame, SupportLoading, SupportNotice, SupportPrivacy, supportLabel } from './SupportPresentation';
import { SupportRecoveryPanel } from './SupportRecoveryPanel';
import { useSupportController } from './useSupportController';

type CreateTopic = SupportPayloads['CREATE']['topic'];
const topics: CreateTopic[] = ['TECHNICAL', 'COLLABORATION', 'NO_SHOW', 'SERVICE_COMPLAINT', 'CONTENT_NOTICE', 'PRIVACY_RIGHTS', 'OTHER'];
export function supportRouteReference(params: { contextKind?: unknown; contextId?: unknown; contextRevision?: unknown }): SupportReference | null | 'INVALID' {
  if (params.contextKind === undefined && params.contextId === undefined && params.contextRevision === undefined) return null;
  if (!['TASK', 'AGREEMENT', 'AGREEMENT_MESSAGE', 'GROUP_MESSAGE', 'TASK_REVIEW', 'SAFETY_REPORT'].includes(params.contextKind as string)
    || !uuid(params.contextId) || params.contextId !== params.contextId.toLowerCase()) return 'INVALID';
  const versioned = ['TASK', 'AGREEMENT', 'AGREEMENT_MESSAGE'].includes(params.contextKind as string);
  const revision = versioned && typeof params.contextRevision === 'string' && /^[1-9][0-9]{0,9}$/.test(params.contextRevision)
    ? Number(params.contextRevision) : null;
  if (versioned ? !positiveInteger(revision) : params.contextRevision !== undefined) return 'INVALID';
  return { kind: params.contextKind as SupportReference['kind'], id: params.contextId, revision };
}
const channel = (topic: SupportTopic): SupportPayloads['CREATE']['channel'] =>
  ['COLLABORATION', 'NO_SHOW', 'PUBLICATION_REVIEW'].includes(topic) ? 'TASK'
    : ['CONTENT_NOTICE', 'PRIVACY_RIGHTS'].includes(topic) ? 'LEGAL_PRIVACY' : 'SERVICE';
export function SupportNewScreen({ reference }: { reference: SupportReference | null | 'INVALID' }) {
  const model = useSupportController({ type: 'NEW' }), { state, navigate } = model;
  return <SupportFrame title="Novi zahtev" onBack={() => navigate(() => router.canGoBack() ? router.back() : router.replace('/podrska'))}>
    <SettingsIntro>Izaberi temu i napiši šta želiš da razjasnimo. Sam prijem zahteva ne menja Zadatak, Dogovor ili ocenu.</SettingsIntro>
    <SupportPrivacy />
    <SupportRecoveryPanel model={model} />
    {state.message ? <SupportNotice error={state.phase === 'ERROR'}>{state.message}</SupportNotice> : null}
    {state.phase === 'LOADING' ? <SupportLoading /> : null}
    {reference === 'INVALID'
      ? <SupportNotice error>Kontekst zahteva nije ispravan. Ponovo otvori podršku iz Zadatka ili Dogovora.</SupportNotice>
      : state.receipt || !model.focused ? null : <NewContents
        key={`${model.accountId}:${model.accountRevision}:${model.incarnationId}:${reference ? `${reference.kind}:${reference.id}:${reference.revision}` : 'NONE'}`}
        model={model} initialReference={reference} />}
    {state.capabilities && !state.capabilities.canCreate ? <SupportNotice>Novi zahtev trenutno nije dostupan ovom nalogu. Sačuvane zahteve možeš ponovo da proveriš iz podrške.</SupportNotice> : null}
    {state.phase === 'ERROR' ? <SettingsAction label="Proveri dostupnost" kind="quiet" onPress={() => { if (model.current()) void model.controller?.load(); }} /> : null}
  </SupportFrame>;
}
function NewContents({ model, initialReference }: { model: ReturnType<typeof useSupportController>; initialReference: SupportReference | null }) {
  const { state, current: parentCurrent, controller, navigate } = model;
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const current = () => alive.current && parentCurrent();
  const [topic, setTopic] = useState<CreateTopic>(initialReference?.kind === 'TASK_REVIEW' ? 'PUBLICATION_REVIEW'
    : initialReference?.kind === 'AGREEMENT' ? 'COLLABORATION' : 'TECHNICAL');
  const [context, setContext] = useState<SupportReference | null>(initialReference);
  const [selectedEvidence, setSelectedEvidence] = useState<SupportReference | null>(
    initialReference && ['AGREEMENT_MESSAGE', 'GROUP_MESSAGE'].includes(initialReference.kind) ? initialReference : null);
  const [contextTitle, setContextTitle] = useState<string | null>(null);
  const [title, setTitle] = useState(''), [body, setBody] = useState(''), [desired, setDesired] = useState('');
  const [choices, setChoices] = useState<DogovorProjekcija[] | null>(null), [choosing, setChoosing] = useState(false), [choiceError, setChoiceError] = useState('');
  const [choicePage, setChoicePage] = useState(0);
  const disabled = state.phase !== 'READY' || !state.capabilities?.canCreate || !!state.pending || choosing;
  const draftView = useMemo(() => ({}), [topic, context, title, body, desired, disabled, selectedEvidence]);
  const latestDraft = useRef(draftView); latestDraft.current = draftView;
  const requiresAgreement = topic === 'COLLABORATION' || topic === 'NO_SHOW';
  const valid = !!title.trim() && Array.from(title).length <= 200 && !!body.trim() && Array.from(body).length <= 4000
    && Array.from(desired).length <= 1000 && (!requiresAgreement || context?.kind === 'AGREEMENT')
    && (topic !== 'PUBLICATION_REVIEW' || context?.kind === 'TASK_REVIEW');
  async function loadAgreements() {
    if (!current() || disabled) return;
    setChoosing(true); setChoiceError('');
    try { const result = await agreementClientService.mojiDogovori();
      if (!current()) return;
      setChoices(result.filter(item => uuid(item.id) && positiveInteger(item.verzija))); setChoicePage(0);
    } catch { if (current()) setChoiceError('Dogovori nisu učitani. Pokušaj ponovo.'); }
    finally { if (current()) setChoosing(false); }
  }
  return <>
    <SettingsGroup title="Tema zahteva">{(initialReference?.kind === 'TASK_REVIEW' ? ['PUBLICATION_REVIEW' as const, ...topics] : topics).map((value, index, all) =>
      <SettingsRow key={value} label={`${topic === value ? 'Izabrano: ' : ''}${supportLabel(value)}`} last={index === all.length - 1} disabled={disabled}
        onPress={() => { if (current() && !disabled) { setTopic(value); setChoices(null);
          if ((value === 'COLLABORATION' || value === 'NO_SHOW') && context?.kind !== 'AGREEMENT') setContext(null);
          else if (value === 'PUBLICATION_REVIEW') setContext(initialReference); } }} />)}</SettingsGroup>
    {requiresAgreement ? <SettingsPanel><T variant="bodyStrong">Dogovor na koji se zahtev odnosi</T>
      <T variant="meta" tone="muted">Operater dobija označeni Dogovor i nužan kontekst. Privatni razgovor se ne kopira automatski.</T>
      {context?.kind === 'AGREEMENT' ? <T>{contextTitle ?? 'Izabran Dogovor'}, verzija {context.revision}.</T> : <T>Izaberi jedan od svojih Dogovora.</T>}
      <SettingsAction label={choosing ? 'Učitavamo Dogovore…' : 'Izaberi Dogovor'} kind="quiet" disabled={disabled} onPress={() => { void loadAgreements(); }} />
      {choiceError ? <T accessibilityRole="alert" tone="danger">{choiceError}</T> : null}
      {choices ? choices.length ? <SettingsGroup title="Tvoji Dogovori">
        {choices.slice(choicePage * 50, (choicePage + 1) * 50).map((item, index, all) => <SettingsRow key={item.id}
          label={item.naslov || 'Dogovor'} detail={`Verzija ${item.verzija}`} last={index === all.length - 1} disabled={disabled}
          onPress={() => { if (current() && !disabled) { setContext({ kind: 'AGREEMENT', id: item.id.toLowerCase(), revision: item.verzija });
            setContextTitle(item.naslov || 'Dogovor'); setChoices(null); } }} />)}
        {choices.length > (choicePage + 1) * 50 ? <SettingsAction label="Još Dogovora" kind="quiet" disabled={disabled} onPress={() => { if (current()) setChoicePage(value => value + 1); }} /> : null}
        {choicePage > 0 ? <SettingsAction label="Prethodni Dogovori" kind="quiet" disabled={disabled} onPress={() => { if (current()) setChoicePage(value => value - 1); }} /> : null}
      </SettingsGroup> : <>
        {/* Choosing this topic with no agreements made the send button unreachable, with nothing
            anywhere saying why: the requirement is stated up here and the way out is beside it. */}
        <T>Ova tema traži Dogovor, a ti još nemaš nijedan.</T>
        <SettingsAction label="Izaberi drugu temu" kind="quiet" disabled={disabled}
          onPress={() => { if (current() && !disabled) { setTopic('OTHER'); setContext(null); setContextTitle(null); setChoices(null); } }} />
      </> : null}
    </SettingsPanel> : context ? <SettingsPanel soft><T variant="bodyStrong">Izabrani kontekst</T>
      <T>{context.kind === 'TASK_REVIEW' ? 'Pregledana odluka o Zadatku' : context.kind === 'TASK' ? 'Izabrani Zadatak'
        : context.kind === 'AGREEMENT_MESSAGE' ? 'Izabrana poruka iz Dogovora' : context.kind === 'GROUP_MESSAGE' ? 'Izabrana grupna poruka' : 'Namerno izabrana referenca'}{context.revision ? `, verzija ${context.revision}` : ''}.</T>
      <T variant="meta" tone="muted">Uz zahtev se šalje ovaj kontekst. Ostali razgovori i privatni podaci nisu automatski priloženi.</T>
    </SettingsPanel> : null}
    {selectedEvidence ? <SettingsPanel soft><T variant="bodyStrong">Izabrana poruka je priložena</T>
      <T>{selectedEvidence.kind === 'AGREEMENT_MESSAGE' ? 'Poruka iz privatnog Dogovora' : 'Poruka iz grupnog razgovora'}.
        {' '}Prilaže se samo namerno izabrana poruka, čak i ako zahtev povežeš sa Dogovorom.</T>
      <SettingsAction label="Ukloni izabranu poruku iz zahteva" kind="quiet" disabled={disabled}
        onPress={() => { if (current() && !disabled) {
          if (context?.kind === selectedEvidence.kind && context.id === selectedEvidence.id) setContext(null);
          setSelectedEvidence(null);
        } }} />
    </SettingsPanel> : null}
    {topic === 'PRIVACY_RIGHTS' ? <SettingsPanel soft><T>Ovde možeš da pošalješ zahtev u vezi sa svojim pravima. Slobodna poruka ne izvršava izvoz ili zatvaranje naloga.</T>
      <SettingsAction label="Otvori izvoz i zatvaranje naloga" kind="quiet" disabled={disabled} onPress={() => navigate(() => router.push('/profil/privatnost'))} />
    </SettingsPanel> : null}
    <SupportField label="Kratak naslov" value={title} onChange={value => { if (current() && !disabled) setTitle(value); }} maximum={200} disabled={disabled} />
    <SupportField label="Opis zahteva" value={body} onChange={value => { if (current() && !disabled) setBody(value); }} maximum={4000} multiline disabled={disabled} />
    <SupportField label="Željeni ishod" value={desired} onChange={value => { if (current() && !disabled) setDesired(value); }} maximum={1000} multiline optional disabled={disabled} />
    <SettingsAction label={state.phase === 'SENDING' ? 'Čekamo potvrdu…' : 'Pošalji privatni zahtev'} disabled={disabled || !valid}
      onPress={() => { if (current() && latestDraft.current === draftView && !disabled && valid) void controller?.submit('CREATE', {
        channel: channel(topic), topic, title, body, desiredOutcome: desired.trim() ? desired : null, context,
        evidence: selectedEvidence ? [selectedEvidence] : [],
      }, state); }} />
  </>;
}
