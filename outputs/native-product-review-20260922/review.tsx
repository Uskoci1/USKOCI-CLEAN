// Visual fixtures only. Buttons change the preview; nothing is submitted or persisted.
import React, { useState } from 'react';
const { createRoot } = require('react-dom/client');
import { View, ScrollView } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PublicNeedPresentation } from '../../src/ui/v2/PublicNeedPresentation';
import { ApplicationSelectionPresentation, CandidateListPresentation, CandidateSelectionPresentation, type ApplicationDraft } from '../../src/ui/v2/ApplicationSelectionPresentation';
import { AgreementHero, AgreementPeople, AgreementTabs } from '../../src/ui/v2/AgreementPresentation';
import { AgreementCompletionReview } from '../../src/ui/agreements/AgreementCompletionReview';
import { AiConversationShell } from '../../src/ui/aiFirst/AiConversationShell';
import { ProductHeader } from '../../src/ui/product/ProductDetails';
import { MarketplacePresentation } from '../../src/ui/v2/MarketplacePresentation';
import { MyApplicationsPresentation, type ApplicationsTab } from '../../src/ui/v2/MyApplicationsPresentation';
import { initialMarketplaceView } from '../../src/data/marketplaceView';
import { T } from '../../src/ui/Text';
import { V2Action } from '../../src/ui/v2/V2Action';
import type { PotrebaProjekcija, PrilikaProjekcija, KandidatProjekcija, DogovorProjekcija, MojaPrijavaProjekcija } from '../../src/contracts/projections';

const noop = () => {};
const need = { id: 'preview-task', revizija: 1, stanje: 'OBJAVLJENA',
  naslov: 'Prenos ormara do kombija', opis: 'Ormar je već rasklopljen. Treba ga pažljivo preneti sa trećeg sprata do kombija ispred zgrade.',
  podrucjeTekst: 'Liman, Novi Sad', vremeTekst: '25. septembar · 17:00–18:00', uslovi: ['Zgrada bez lifta', 'Trake za nošenje', 'Ormar je već rasklopljen'],
  taskTimezone: 'Europe/Belgrade', schedule: { kind: 'FIXED_WINDOW', startsAt: '2026-09-25T15:00:00Z', endsAt: '2026-09-25T16:00:00Z' },
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, brojPrijava: 2, brojPrijavaZaIzbor: 2,
  rezimCene: 'MY_PRICE', osnovaCene: 'TOTAL', ponudjenaCena: { iznos: 5000, valuta: 'RSD', prikaz: '5.000 RSD' },
  narucilacIme: 'Marko', narucilacProfilId: 'preview-profile', narucilacOcena: '4,8', statusTekst: 'Otvoren',
  primaNovePrijave: true, rokZaPrijaveIso: null, priblizno: null,
} as PotrebaProjekcija & PrilikaProjekcija;
const candidates = [
  { prijavaId: 'preview-offer-1', radnikProfilId: 'preview-person-1', inicijali: 'N', ime: 'Nikola', cena: { iznos: 5000, valuta: 'RSD', prikaz: '5.000 RSD' }, pokrivaMesta: 2,
    verzija: 1, hash: 'preview', preostaloMesta: 2, dolazakTekst: 'Po dogovoru', prevozTekst: '', razlogPreporuke: null,
    ocenaTekst: '4,9', recenzijeTekst: '18 recenzija', stanje: 'SELECTABLE', mozeIzabrati: true,
    napomena: 'Dolazimo nas dvojica. Imamo trake i možemo u dogovoreno vreme.',
    dokazPrijave: { sema: 'APPLICATION_V1_SELF_DECLARED', kapacitetTima: 2, vestine: ['Prenos nameštaja'], alati: ['Trake za nošenje'], vozila: [], licence: [] } },
  { prijavaId: 'preview-offer-2', radnikProfilId: 'preview-person-2', inicijali: 'A', ime: 'Aleksandra Petrović',
    verzija: 1, hash: 'preview', preostaloMesta: 2, dolazakTekst: 'Po dogovoru', prevozTekst: '', razlogPreporuke: null,
    cena: { iznos: 6500, valuta: 'RSD', prikaz: '6.500 RSD' }, pokrivaMesta: 2,
    ocenaTekst: '—', recenzijeTekst: '0 recenzija', stanje: 'SELECTABLE', mozeIzabrati: true, napomena: 'Dolazim sa kolegom.',
    dokazPrijave: { sema: 'APPLICATION_V1_SELF_DECLARED', kapacitetTima: 2, vestine: ['Selidbe'], alati: [], vozila: [], licence: [] } },
] as KandidatProjekcija[];
const agreement: DogovorProjekcija = { id: 'preview-agreement', verzija: 1, stanje: 'CONFIRMED', rezim: 'FIZICKI', naslov: need.naslov, putanjaTekst: need.podrucjeTekst,
  vremeTekst: need.vremeTekst, cena: candidates[0].cena, pokrivenost: { ukupno: 2, popunjeno: 2, preostalo: 0, udeo: 1 },
  ucesnici: [{ id: 'preview-me', profilId: null, ime: 'Marko', inicijali: 'M', uloga: 'narucilac', viSte: true, mesta: null, telefon: null },
    { id: 'preview-other', profilId: null, ime: 'Nikola', inicijali: 'N', uloga: 'uskocer', viSte: false, mesta: 2, telefon: null }],
  kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: true, tacnaLokacija: null, emailNijeDeljen: true },
  chatDostupan: true, rokPotvrdeIso: null, problemOtvoren: false, ocenaMoguca: false, hronologija: [], radnje: null, pocinje: null, izmenaCeka: null,
  // PKG-048: the Zadatak and the Prijava this preview Dogovor grew out of, so the review shows both source rows.
  izvor: { zadatakId: need.id, prijavaId: candidates[0].prijavaId },
};
const myApplications: MojaPrijavaProjekcija[] = [{ prijavaId: 'preview-own-offer', potrebaId: need.id, potrebaRevizija: 1, prijavaRevizija: 1,
  prijavaVerzija: 1, stanje: 'SUBMITTED', naslov: need.naslov, opis: need.opis, cena: candidates[0].cena, pokrivaMesta: 2,
  napomena: candidates[0].napomena, podrucjeTekst: need.podrucjeTekst, vremeTekst: need.vremeTekst,
  dogovorId: null, promenjenaPotreba: false, mozePovuci: true, traziPaznju: false },
  { prijavaId: 'preview-own-offer-2', potrebaId: 'preview-task-2', potrebaRevizija: 1, prijavaRevizija: 1, prijavaVerzija: 1,
    stanje: 'VIEWED', naslov: 'Montaža dve police', opis: '', cena: { iznos: 2500, valuta: 'RSD', prikaz: '2.500 RSD' }, pokrivaMesta: 1,
    napomena: '', podrucjeTekst: 'Grbavica, Novi Sad', vremeTekst: 'Fleksibilan termin', dogovorId: null,
    promenjenaPotreba: false, mozePovuci: true, traziPaznju: false }];
function Review() {
  const [screen, setScreen] = useState(new URLSearchParams(location.search).get('screen') ?? 'task');
  const scenario = new URLSearchParams(location.search).get('state') ?? 'ready';
  const [candidate, setCandidate] = useState(candidates[0]);
  const [applicationTab, setApplicationTab] = useState<ApplicationsTab>('all');
  const [value, setValue] = useState('');
  const [draft, setDraft] = useState<ApplicationDraft>({ price: '5000', people: '2', note: '', start: null, end: null });
  const [view, setView] = useState(() => ({ ...initialMarketplaceView(), query: scenario === 'no-results' ? 'nepostojeći posao' : '' }));
  if (screen === 'done-worker' || screen === 'done-requester') return <AgreementCompletionReview
    agreement={{ ...agreement, problemOtvoren: scenario === 'problem' }} worker={screen === 'done-worker'}
    confirm={() => setScreen('agreement')} back={() => setScreen('agreement')} />;
  // Other people's tasks (Zadaci) are DiscoveryPresentation since owner step 4 (2026-09-24), a screen that needs the
  // router's focus and the native bottom sheet, which this web preview does not have. The list preview is therefore Moji
  // zadaci, the one list MarketplacePresentation still draws, with owned rows.
  if (screen === 'list') return <MarketplacePresentation items={scenario === 'empty' ? [] : [need, { ...need, id: 'preview-task-2', naslov: 'Montaža dve police', rezimCene: 'OFFERS' }]} loading={scenario === 'loading'} error={scenario === 'error'}
    view={view} onView={setView} onOpen={() => setScreen('task')} onRefresh={noop} onProfile={noop} onNew={noop} onBack={() => setScreen('task')} />;
  if (screen === 'my-applications') return <MyApplicationsPresentation rows={scenario === 'empty' ? [] : myApplications} loading={scenario === 'loading'} unavailable={scenario === 'error'}
    message={scenario === 'error' ? 'Proveri vezu i pokušaj ponovo.' : null} notice={null} tab={applicationTab} onTab={setApplicationTab} expanded={null} draft={null}
    focusId="preview-own-offer" requestedId="preview-own-offer" busy={false} editingLoading={false} pending={false} canRetry={false} canReset={false}
    onRefresh={noop} onExplore={() => setScreen('list')} onProfile={noop} onBack={() => setScreen('task')} onReview={noop} onClose={noop} onEdit={noop}
    onChange={noop} onCancelEdit={noop} onKeep={noop} onUpdate={noop} onWithdraw={noop} onAgreement={() => setScreen('agreement')} onRetry={noop} onReset={noop} onTask={() => setScreen('task')} />;
  if (screen === 'candidates') return <CandidateListPresentation need={need} candidates={scenario === 'empty' ? [] : candidates} open={c => { setCandidate(c); setScreen('offer'); }} back={() => setScreen('task')} refresh={noop} />;
  if (screen === 'compose') return <ApplicationSelectionPresentation need={need} opportunity={need} draft={draft} change={setDraft}
    submit={noop} back={() => setScreen('task')} busy={false} pending={false} uncertain={false} refresh={noop}
    error={null} confirmed={false} openApplications={noop} canSubmit />;
  if (screen === 'offer') return <CandidateSelectionPresentation need={need} candidate={candidate} back={() => setScreen('candidates')} publicProfile={async () => null} choose={noop} busy={false} pending={false} uncertain={false}
    refresh={noop} error={null} confirmed={false} openAgreement={noop} readAgreement={async () => ({ ok: true, podatak: { dogovorId: null } })} openLinkedAgreement={noop} />;
  if (screen === 'agreement') return <View style={{ flex: 1 }}><ProductHeader title="Dogovor" subtitle="Dogovoreno" back={() => setScreen('task')} />
    <View style={{ paddingHorizontal: 20 }}><AgreementTabs tab="pregled" onChange={noop} /></View>
    <ScrollView contentContainerStyle={{ padding: 20, gap: 24 }}><AgreementHero agreement={agreement} /><AgreementPeople agreement={agreement} /></ScrollView></View>;
  if (screen === 'ai') return <AiConversationShell title="Objavi zadatak" welcome="Šta treba da se uradi?" welcomeDetail="Napiši svojim rečima. Zajedno ćemo složiti detalje."
    card={() => null} messages={[]} value={value} onChange={setValue} onSend={noop} onBack={() => setScreen('task')} onOptions={noop}
    canEdit canSend={false} pending={false} busy={false} openings={['Treba mi pomoć u stanu', 'Selidba i prevoz']} />;
  return <PublicNeedPresentation need={need} loading={false} error={false} missing={false} stale={false} busy={false} canApply canRetry
    relation={{ kind: 'NONE' }} back={() => setScreen('list')} retry={noop} apply={() => setScreen('compose')} onOwnTask={noop} onOwnApplication={noop}
    onRequesterProfile={noop} onCloseRequesterProfile={noop}
    qa={<View style={{ gap: 12 }}><T variant="heading">Pitanja o zadatku</T><T>Da li je ormar rasklopljen?</T><T tone="muted">Da, delovi su spremni za prenos.</T><V2Action label="Pogledaj pitanja" onPress={noop} /></View>} />;
}
createRoot(document.getElementById('root')!).render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: innerWidth, height: innerHeight }, insets: { top: 0, bottom: 0, left: 0, right: 0 } }}><Review /></SafeAreaProvider>);
