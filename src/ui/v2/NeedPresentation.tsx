import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, MapPin, Users } from 'phosphor-react-native';
import type { PotrebaProjekcija, StanjePotrebe } from '../../contracts/projections';
import type { PublicationEvaluation, PublicationNotReadyCode } from '../../contracts/publication';
import { needGeographyRows, needPeopleText, needRequirementRows } from '../../data/needDetailPresentation';
import { Press } from '../Press';
import { T } from '../Text';
import { V2Action } from './V2Action';
import { V2Icon } from './icons';
import { v2 } from './tokens';

const STATUS: Record<StanjePotrebe, string> = { NACRT: 'Privatan nacrt', OBJAVLJENA: 'Objavljena', CEKA_PRIJAVE: 'Čeka prijave',
  DELIMICNO_POPUNJENA: 'Delimično popunjena', POPUNJENA: 'Popunjena', ZATVORENA: 'Zatvorena' };
const NOT_READY: Record<PublicationNotReadyCode, string> = {
  POLICY_NOT_READY: 'Provera za objavu još nije dostupna. Nacrt je sačuvan.',
  POLICY_CONTENT_NOT_READY: 'Provera za objavu još nije dostupna. Nacrt je sačuvan.',
  LOCATION_INCOMPLETE: 'Potvrdite sva potrebna mesta izvršenja pre objave.',
  COUNTRY_NOT_READY: 'Objava u izabranoj državi trenutno nije dostupna.',
  PUBLIC_MEDIA_NOT_READY: 'Fotografije još nisu spremne za objavu.',
  EVALUATOR_UNAVAILABLE: 'Provera trenutno nije dostupna. Pokušajte ponovo.',
  EVALUATOR_INVALID_RESPONSE: 'Rezultat provere nije potvrđen. Pokušajte ponovo.',
  RATE_LIMITED: 'Sačekajte malo pre nove provere.',
  NEED_CHANGED: 'Zadatak je promenjen. Učitajte trenutno stanje pre nove provere.',
};
export type NeedPresentationProps = {
  need: PotrebaProjekcija | null; loading: boolean; error: string | null; busy: boolean;
  ownerIntent: boolean; remainingClosed: boolean; publishedReceipt: boolean;
  evaluation: PublicationEvaluation | null; retrying: boolean;
  onBack: () => void; onRefresh: () => void; onEvaluate: () => void; onPublish: () => void;
  onRetry: () => void; onEdit: () => void; onCloseRemaining: () => void; onCandidates: () => void;
};
function DetailRows({ rows }: { rows: { label: string; value: string }[] }) {
  return <View style={s.details}>{rows.map((row, index) => <View key={`${index}:${row.label}`} style={s.detailRow}>
    <T style={s.caption}>{row.label}</T><T style={s.body}>{row.value}</T>
  </View>)}</View>;
}
/** Executable V2 cDetails/cCard.large + 09_task.png: open hero, grouped rows and
 * pinned action. Only existing controller callbacks can perform business actions. */
export function NeedPresentation(props: NeedPresentationProps) {
  const { need, loading, error, busy, ownerIntent, remainingClosed, publishedReceipt, evaluation, retrying } = props;
  const [expanded, setExpanded] = useState<'location' | 'requirements' | null>(null);
  const draft = need?.stanje === 'NACRT' && ownerIntent;
  const decision = evaluation?.kind === 'DECISION' ? evaluation.decision : null;
  const allowed = decision?.authoritative === true && decision.outcome === 'ALLOW' && decision.publishable;
  const publicationCopy = evaluation?.kind === 'NOT_READY' ? NOT_READY[evaluation.code]
    : decision?.outcome === 'CLARIFY' ? 'Za objavu su potrebna dodatna pojašnjenja. Pregledajte i izmenite nacrt.'
      : decision?.outcome === 'REVIEW' ? 'Provera nije odobrila objavu. Zadatak ostaje sačuvan kao nacrt.'
        : decision?.outcome === 'BLOCK' ? 'Ovaj Zadatak nije odobren za objavu. Nacrt ostaje sačuvan.'
          : allowed ? 'Provera je odobrila ovu verziju Zadatka. Objavu potvrđujete zasebno.'
            : 'Nacrt je privatan. Proverite da li je spreman za objavu.';
  const usable = !!need && !loading && !error;
  const rows = need ? needGeographyRows(need) : [], requirements = need ? needRequirementRows(need) : [];
  const primaryLabel = draft ? retrying ? 'Ponovi isti zahtev za objavu' : busy ? 'Radnja je u toku…'
    : allowed ? 'Objavi Zadatak' : evaluation ? 'Ponovi proveru za objavu' : 'Proveri za objavu' : 'Pogledaj prijave';
  const primaryAction = draft ? retrying ? props.onRetry : allowed ? props.onPublish : props.onEvaluate : props.onCandidates;
  const toggle = (key: 'location' | 'requirements') => setExpanded(current => current === key ? null : key);
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <View style={s.header}>
      <Press accessibilityRole="button" accessibilityLabel="Nazad" onPress={props.onBack} haptic="select" style={s.back}>
        <V2Icon name="back" />
      </Press>
      <View style={{ flex: 1 }}><T style={s.caption}>Tvoj radni prostor</T><T accessibilityRole="header" style={s.headerTitle}>Zadatak</T></View>
    </View>
    {publishedReceipt ? <View style={s.receipt}><T accessibilityRole="alert" style={s.body}>{error
      ? 'Objava je potvrđena. Trenutni prikaz treba osvežiti.'
      : loading || busy ? 'Objava je potvrđena. Učitavamo trenutno stanje Zadatka.'
        : 'Server je potvrdio objavu. Prikazujemo ponovo učitano stanje Zadatka.'}</T></View> : null}
    {loading ? <View style={s.state}><ActivityIndicator color={v2.color.teal} /><T style={s.caption}>Učitavamo Zadatak…</T></View>
      : error || !need ? <View style={s.state}>
        <T style={s.headerTitle}>Zadatak nije dostupan</T><T style={s.body}>{error ?? 'Pokušajte ponovo.'}</T>
        <Press accessibilityRole="button" accessibilityLabel="Pokušaj ponovo" haptic="light" onPress={props.onRefresh} style={s.retry}>
          <T style={[s.body, { color: v2.color.surface, fontWeight: '700' }]}>Pokušajte ponovo</T>
        </Press>
      </View> : <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <T style={s.status}>{STATUS[need.stanje]}</T>
          {need.detalji ? <T style={s.caption}>{need.detalji.kategorija}</T> : null}
          <T accessibilityRole="header" style={s.title}>{need.naslov}</T>
          <View style={s.meta}><MapPin size={17} color={v2.color.teal} /><T style={[s.caption, s.grow]}>{need.detalji?.geografija?.mode === 'REMOTE' ? 'Na daljinu' : need.podrucjeTekst}</T></View>
          <View style={s.meta}><Clock size={17} color={v2.color.teal} /><T style={[s.caption, s.grow]}>{need.vremeTekst}</T></View>
          <View style={s.moneyRow}><T style={[s.price, s.grow]}>{need.rezimCene === 'OFFERS' ? 'Tražim ponude'
            : need.ponudjenaCena ? need.ponudjenaCena.prikaz : 'Cena nije navedena'}</T>
            <View accessible accessibilityLabel={`${need.pokrivenost.popunjeno} od ${needPeopleText(need.pokrivenost.ukupno)} dogovoreno`} style={s.coverage}>
              <Users size={18} color={v2.color.ink} /><T style={s.caption}>{need.pokrivenost.popunjeno} / {need.pokrivenost.ukupno}</T>
            </View>
          </View>
          <T style={s.caption}>{needPeopleText(need.pokrivenost.ukupno)} potrebno</T>
        </View>
        <T style={s.description}>{need.opis}</T>
        {draft ? <View style={s.publication}>
          <T style={s.sectionTitle}>Objava Zadatka</T><T accessibilityLiveRegion="polite" style={s.body}>{publicationCopy}</T>
          {retrying ? <T style={s.caption}>Prethodna objava nije potvrđena. Provereno je trenutno stanje; možete ponoviti isti zahtev.</T> : null}
          {allowed && !retrying ? <V2Action label="Ponovi proveru za objavu" kind="quiet" disabled={busy} onPress={props.onEvaluate} /> : null}
          <V2Action label="Izmeni nacrt" kind="quiet" disabled={busy || retrying} onPress={props.onEdit} />
        </View> : null}
        {!draft && ownerIntent ? <View style={s.group}>
          <Press accessibilityRole="button" accessibilityLabel={`Otvori prijave, ukupno ${need.brojPrijava}`} onPress={props.onCandidates} haptic="select" style={s.menu}>
            <View style={s.grow}><T style={s.body}>Prijave za ovaj zadatak</T><T style={s.caption}>{need.brojPrijava === 0 ? 'Još nema pristiglih ponuda.' : `${need.brojPrijava} ${need.brojPrijava === 1 ? 'prijava' : 'prijave'} za pregled`}</T></View><V2Icon name="chevron" />
          </Press>
          {need.pokrivenost.popunjeno === 0 && !remainingClosed && need.stanje !== 'ZATVORENA' ? <V2Action label="Izmeni Zadatak" kind="quiet" disabled={busy} onPress={props.onEdit} /> : null}
        </View> : null}
        <View style={s.group}>
          <Press accessibilityRole="button" accessibilityLabel="Mesto izvršenja" accessibilityState={{ expanded: expanded === 'location' }} onPress={() => toggle('location')} haptic="select" style={s.menu}>
            <View style={s.grow}><T style={s.body}>Mesto izvršenja</T><T style={s.caption}>{need.detalji?.geografija ? rows[0].value : 'Približno područje'}</T></View><V2Icon name="chevron" />
          </Press>
          {expanded === 'location' ? <>
            {!need.detalji?.geografija ? <T style={s.caption}>Javna struktura lokacije nije dostupna. Prikazano je približno područje.</T> : null}
            <DetailRows rows={[...rows, ...(need.taskCountryCode ? [{ label: 'Država zadatka', value: need.taskCountryCode }] : [])]} />
          </> : null}
          <View style={s.line} />
          <Press accessibilityRole="button" accessibilityLabel="Svi uslovi" accessibilityState={{ expanded: expanded === 'requirements' }} onPress={() => toggle('requirements')} haptic="select" style={s.menu}>
            <View style={s.grow}><T style={s.body}>Svi uslovi</T><T style={s.caption}>{requirements.length ? 'Veštine, oprema i uslovi rada' : 'Nema dodatih uslova'}</T></View><V2Icon name="chevron" />
          </Press>
          {expanded === 'requirements' ? requirements.length ? <DetailRows rows={requirements} /> : <T style={[s.caption, s.details]}>Nema dodatih uslova.</T> : null}
        </View>
        {remainingClosed ? <View style={s.publication}><T style={s.sectionTitle}>Preostala potraga je zatvorena</T><T style={s.caption}>Originalni Zadatak i postojeći Dogovori ostaju nepromenjeni.</T></View>
          : ownerIntent && need.pokrivenost.popunjeno > 0 && need.pokrivenost.preostalo > 0
            ? <V2Action label="Ne traži više nikoga" kind="quiet" disabled={busy} onPress={props.onCloseRemaining} /> : null}
        <T style={s.caption}>Tačna lokacija i privatne napomene ostaju privatni.</T>
      </ScrollView>}
    {usable && ownerIntent ? <View style={s.footer}>
      {draft && allowed && !retrying ? <T style={s.caption}>Dodatni rok za prijave nije izabran. Objavljujete Zadatak bez dodatnog roka za prijave.</T> : null}
      <V2Action label={primaryLabel} disabled={busy} onPress={primaryAction} style={s.primary} />
    </View> : null}
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: v2.color.canvas },
  header: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingBottom: 12, paddingTop: 9, backgroundColor: v2.color.header },
  back: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 13 },
  headerTitle: { ...v2.text.title, color: v2.color.ink, letterSpacing: -0.55 },
  caption: { ...v2.text.label, color: v2.color.muted }, body: { ...v2.text.body, color: v2.color.ink },
  state: { flex: 1, justifyContent: 'center', padding: 24, gap: 18 }, retry: { minHeight: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: v2.color.ink },
  receipt: { padding: 18, backgroundColor: v2.color.soft }, content: { padding: 20, paddingTop: 10, paddingBottom: 28, gap: 24 },
  hero: { gap: 10 }, status: { ...v2.text.label, color: v2.color.teal, fontWeight: '700' },
  title: { fontSize: 29, lineHeight: 33, fontWeight: '700', letterSpacing: -0.85, color: v2.color.ink, marginTop: 8, marginBottom: 4 },
  meta: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, grow: { flex: 1, minWidth: 0 },
  moneyRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 18 },
  price: { fontSize: 31, lineHeight: 37, fontWeight: '700', letterSpacing: -0.65, color: v2.color.ink },
  coverage: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: v2.color.soft, borderRadius: 8, padding: 8 },
  description: { ...v2.text.body, color: v2.color.ink, lineHeight: 25 },
  publication: { gap: 12, padding: 18, backgroundColor: v2.color.soft, borderRadius: 18 }, sectionTitle: { ...v2.text.body, color: v2.color.ink, fontWeight: '700' },
  group: { backgroundColor: v2.color.surface, borderWidth: 1, borderColor: v2.color.line, borderRadius: 18, paddingHorizontal: 16 },
  menu: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 14 },
  line: { height: 1, backgroundColor: v2.color.line }, details: { paddingBottom: 18, gap: 16 }, detailRow: { gap: 4 },
  footer: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8, gap: 8, backgroundColor: v2.color.surface, borderTopWidth: 1, borderTopColor: v2.color.line },
  primary: { backgroundColor: v2.color.orange, borderWidth: 0, minHeight: 50 },
});
