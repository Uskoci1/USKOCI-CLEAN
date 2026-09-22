// Visual fixtures only. Buttons change the preview; nothing is submitted or persisted.
import React, { useState } from 'react';
const { createRoot } = require('react-dom/client');
import { View, ScrollView } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PublicNeedPresentation } from '../../src/ui/v2/PublicNeedPresentation';
import { ApplicationSelectionPresentation, CandidateListPresentation, CandidateSelectionPresentation, type ApplicationDraft } from '../../src/ui/v2/ApplicationSelectionPresentation';
import { AgreementHero, AgreementPeople, AgreementTabs } from '../../src/ui/v2/AgreementPresentation';
import { AiConversationShell } from '../../src/ui/aiFirst/AiConversationShell';
import { ProductHeader } from '../../src/ui/product/ProductDetails';
import { MarketplacePresentation } from '../../src/ui/v2/MarketplacePresentation';
import { initialMarketplaceView } from '../../src/data/marketplaceView';
import { T } from '../../src/ui/Text';
import { V2Action } from '../../src/ui/v2/V2Action';
import type { PotrebaProjekcija, PrilikaProjekcija, KandidatProjekcija, DogovorProjekcija } from '../../src/contracts/projections';

const noop = () => {};
const need = { id: 'preview-task', revizija: 1, stanje: 'OBJAVLJENA',
  naslov: 'Prenos ormara do kombija', opis: 'Ormar je već rasklopljen. Treba ga pažljivo preneti sa trećeg sprata do kombija ispred zgrade.',
  podrucjeTekst: 'Liman, Novi Sad', vremeTekst: '25. septembar · 17:00–18:00', uslovi: ['Zgrada bez lifta', 'Trake za nošenje', 'Ormar je već rasklopljen'],
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, brojPrijava: 2, brojPrijavaZaIzbor: 2,
  rezimCene: 'MY_PRICE', osnovaCene: 'TOTAL', ponudjenaCena: { iznos: 5000, valuta: 'RSD', prikaz: '5.000 RSD' },
  narucilacIme: 'Marko', narucilacProfilId: 'preview-profile', narucilacOcena: '4,8', statusTekst: 'Otvoren',
  primaNovePrijave: true, rokZaPrijaveIso: null, priblizno: null,
} as PotrebaProjekcija & PrilikaProjekcija;
// Public discovery must not accidentally receive the owned discriminator, which would draw an
// owner's selection count on a public card. These remain clearly labelled local examples only.
const { stanje: _ownedState, ...opportunity } = need;
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
};
function Review() {
  const [screen, setScreen] = useState(new URLSearchParams(location.search).get('screen') ?? 'task');
  const scenario = new URLSearchParams(location.search).get('state') ?? 'ready';
  const [candidate, setCandidate] = useState(candidates[0]);
  const [value, setValue] = useState('');
  const [draft, setDraft] = useState<ApplicationDraft>({ price: '5000', people: '2', note: '', start: null, end: null });
  const [view, setView] = useState(() => ({ ...initialMarketplaceView(), query: scenario === 'no-results' ? 'nepostojeći posao' : '' }));
  if (screen === 'list') return <MarketplacePresentation owned={false} items={scenario === 'empty' ? [] : [opportunity, { ...opportunity, id: 'preview-task-2', naslov: 'Montaža dve police', rezimCene: 'OFFERS' }]} loading={scenario === 'loading'} error={scenario === 'error'}
    scopeKey="preview-only" view={view} onView={setView} onOpen={() => setScreen('task')} onRefresh={noop} onSwitch={noop} onProfile={noop} onNew={noop} />;
  if (screen === 'candidates') return <CandidateListPresentation need={need} candidates={candidates} open={c => { setCandidate(c); setScreen('offer'); }} back={() => setScreen('task')} refresh={noop} />;
  if (screen === 'compose') return <ApplicationSelectionPresentation need={need} opportunity={need} draft={draft} change={setDraft}
    submit={noop} back={() => setScreen('task')} busy={false} pending={false} uncertain={false} refresh={noop}
    error={null} confirmed={false} openApplications={noop} canSubmit={false} />;
  if (screen === 'offer') return <CandidateSelectionPresentation need={need} candidate={candidate} back={() => setScreen('candidates')} publicProfile={async () => null} choose={noop} busy={false} pending={false} uncertain={false}
    refresh={noop} error={null} confirmed={false} openAgreement={noop} readAgreement={async () => ({ ok: true, podatak: { dogovorId: null } })} openLinkedAgreement={noop} />;
  if (screen === 'agreement') return <View style={{ flex: 1 }}><ProductHeader title="Dogovor" subtitle="Dogovoreno" back={() => setScreen('task')} />
    <View style={{ paddingHorizontal: 20 }}><AgreementTabs tab="pregled" onChange={noop} /></View>
    <ScrollView contentContainerStyle={{ padding: 20, gap: 24 }}><AgreementHero agreement={agreement} /><AgreementPeople agreement={agreement} /></ScrollView></View>;
  if (screen === 'ai') return <AiConversationShell title="Objavi zadatak" subtitle="Nacrt" welcome="Šta treba da se uradi?" welcomeDetail="Napiši svojim rečima. Zajedno ćemo složiti detalje."
    card={() => null} messages={[]} value={value} onChange={setValue} onSend={noop} onBack={() => setScreen('task')} onOptions={noop}
    canEdit canSend={false} pending={false} busy={false} openings={['Treba mi pomoć u stanu', 'Selidba i prevoz']} />;
  return <PublicNeedPresentation need={need} loading={false} error={false} missing={false} stale={false} busy={false} canApply canRetry
    relation={{ kind: 'NONE' }} back={() => setScreen('list')} retry={noop} apply={() => setScreen('compose')} onOwnTask={noop} onOwnApplication={noop}
    onRequesterProfile={noop} onCloseRequesterProfile={noop}
    qa={<View style={{ gap: 12 }}><T variant="heading">Pitanja o zadatku</T><T>Da li je ormar rasklopljen?</T><T tone="muted">Da, delovi su spremni za prenos.</T><V2Action label="Pogledaj pitanja" onPress={noop} /></View>} />;
}
createRoot(document.getElementById('root')!).render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: innerWidth, height: innerHeight }, insets: { top: 0, bottom: 0, left: 0, right: 0 } }}><Review /></SafeAreaProvider>);
