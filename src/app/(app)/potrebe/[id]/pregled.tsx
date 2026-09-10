import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, ScrollView, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CaretRight, Clock, MapPin, PencilSimple, UserMinus, Users } from 'phosphor-react-native';
import type { PotrebaProjekcija, StanjePotrebe } from '../../../../contracts/projections';
import type { PublicationEvaluation, PublishNeedCommand, PublishNeedReceipt } from '../../../../contracts/publication';
import type { Ishod } from '../../../../data/ports';
import { aiNeedV2Izvor } from '../../../../data';
import { publicationClientService, decodePublicationEvaluation } from '../../../../data/publicationClientService';
import { failure, positiveInteger, sameId, timestamp, uuid } from '../../../../data/serverReceipt';
import { ru4Production } from '../../../../data/ru4Production';
import { useOwnedEditor } from '../../../../hooks/useOwnedEditor';
import { noviZahtevId } from '../../../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../../../store/sesija';
import { ulogaSada, useIzvor, useUloga } from '../../../../store/uloga';
import { palette, space, radius, elevation, touch } from '../../../../theme/tokens';
import { Card } from '../../../../ui/Button';
import { NeedPublicationPanel } from '../../../../ui/NeedPublicationPanel';
import { Press } from '../../../../ui/Press';
import { T } from '../../../../ui/Text';

const STATUS: Record<StanjePotrebe, string> = { NACRT: 'Nacrt', OBJAVLJENA: 'Objavljena', CEKA_PRIJAVE: 'Čeka prijave',
  DELIMICNO_POPUNJENA: 'Delimično popunjena', POPUNJENA: 'Popunjena', ZATVORENA: 'Zatvorena' };
type Snapshot = { need: PotrebaProjekcija; remainingClosed: boolean; evaluation: PublicationEvaluation | null };
type Attempt = { command: PublishNeedCommand; needsReadback: boolean };
// These explicit B07 rejections did not accept this command. Transport failures
// and unreadable receipts retain the original intent until an owned readback.
const REJECTED_PUBLICATION = new Set(['AUTH_REQUIRED', 'NEED_NOT_OWNED', 'NEED_NOT_FOUND', 'NEED_NOT_DRAFT',
  'NEED_REVISION_STALE', 'PUBLICATION_CONTEXT_STALE', 'PUBLICATION_CONTEXT_NOT_READY', 'PUBLICATION_DECISION_STALE',
  'PUBLICATION_DECISION_CONTEXT_STALE',
  'PUBLICATION_DECISION_FINGERPRINT_STALE', 'PUBLICATION_DECISION_NOT_ALLOW', 'PUBLICATION_POLICY_STALE',
  'POLICY_BUNDLE_NOT_READY', 'POLICY_CONTENT_NOT_READY', 'PUBLICATION_LOCATION_INCOMPLETE',
  'RESPONSE_DEADLINE_INVALID', 'IDEMPOTENCY_KEY_REUSED']);
const changed = () => failure('REVIEW_CHANGED', 'Ponovo otvorite Zadatak i pregledajte trenutno stanje.');
function matchesReceipt(receipt: PublishNeedReceipt, command: PublishNeedCommand) {
  return receipt && sameId(receipt.needId, command.needId) && receipt.status === 'PUBLISHED'
    && timestamp(receipt.publishedAt) && receipt.responseDeadline === command.responseDeadline
    && typeof receipt.idempotentReplay === 'boolean';
}

export default function PregledPotrebe() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const { user, accountRevision } = useSesija();
  const intent = useUloga();
  return <OwnedNeed key={`${id}:${user?.id ?? ''}:${accountRevision}:${intent}`} id={id} />;
}
function OwnedNeed({ id }: { id: string }) {
  const izvor = useIzvor(), intent = useUloga();
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const identity = useMemo(() => ({}), [id, izvor, intent, accountId, accountRevision]);
  const latestIdentity = useRef(identity); latestIdentity.current = identity;
  const focus = useRef<object | null>(null), life = useRef(0), navigating = useRef(false), dialog = useRef<object | null>(null);
  const foreground = useRef(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [lifecycle, setLifecycle] = useState(0);
  const attempt = useRef<Attempt | null>(null);
  const reading = useRef<object | null>(null);
  const [publishedReceipt, setPublishedReceipt] = useState(false);
  useFocusEffect(useCallback(() => {
    const scope = {}; focus.current = scope; life.current++; navigating.current = false;
    foreground.current = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    const subscription = AppState.addEventListener('change', state => {
      const active = state === 'active';
      if (active === foreground.current) return;
      foreground.current = active; life.current++; dialog.current = null;
      if (attempt.current) attempt.current.needsReadback = true;
      setLifecycle(value => value + 1);
    });
    return () => { subscription.remove(); if (focus.current === scope) focus.current = null;
      life.current++; dialog.current = null; if (attempt.current) attempt.current.needsReadback = true; };
  }, [identity]));
  const read = useCallback(async (): Promise<Ishod<Snapshot>> => {
    const owner = focus.current, generation = life.current, invocation = {};
    reading.current = invocation;
    const current = () => owner !== null && focus.current === owner && foreground.current && life.current === generation
      && reading.current === invocation
      && latestIdentity.current === identity && sesijaSada().user?.id === accountId
      && sesijaSada().accountRevision === accountRevision && ulogaSada() === intent;
    const load = async (): Promise<Ishod<Snapshot>> => {
      if (!current()) return changed();
      if (!uuid(id)) return failure('NEED_REQUIRED', 'Zadatak nije izabran.');
      const need = await izvor.potreba(id);
      if (!current()) return changed();
      if (!need || !sameId(need.id, id) || !positiveInteger(need.revizija) || !Object.hasOwn(STATUS, need.stanje)) {
        return failure('NEED_UNAVAILABLE', 'Zadatak nije pronađen ili više nije dostupan.');
      }
      const search = await ru4Production.remainingSearchState(id);
      if (!current()) return changed();
      if (!search || typeof search.closed !== 'boolean') return failure('NEED_INVALID_RESPONSE', 'Pregled Zadatka nije potvrđen.');
      if (attempt.current) {
        if (attempt.current.command.expectedRevision !== need.revizija || need.stanje !== 'NACRT') attempt.current = null;
        else attempt.current.needsReadback = false;
      }
      return { ok: true, podatak: { need, remainingClosed: search.closed, evaluation: null } };
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([load(), new Promise<Ishod<Snapshot>>(resolve => {
        timer = setTimeout(() => resolve(failure('NEED_READ_TIMEOUT', 'Učitavanje traje predugo. Proverite vezu i pokušajte ponovo.')), 15_000);
      })]);
    } catch { return failure('NEED_READ_FAILED', 'Zadatak trenutno nije moguće učitati. Proverite vezu i pokušajte ponovo.'); }
    finally {
      if (timer !== undefined) clearTimeout(timer);
      // SDK reads may finish after the timeout. Retire their side-effect authority.
      if (reading.current === invocation) reading.current = null;
    }
  }, [id, identity, izvor, accountId, accountRevision, intent, lifecycle]);
  const editor = useOwnedEditor(read);
  const potreba = editor.data?.need ?? null;
  const preostalaPotragaZatvorena = editor.data?.remainingClosed ?? false;
  const ucitava = editor.loading, greska = editor.error, akcijaUToku = editor.busy || editor.uncertain;
  const renderedFocus = focus.current, renderedLife = life.current;
  const latestData = useRef(editor.data); latestData.current = editor.data;
  const current = () => focus.current !== null && focus.current === renderedFocus && foreground.current
    && life.current === renderedLife && latestIdentity.current === identity && latestData.current === editor.data
    && !!accountId && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision && ulogaSada() === intent;
  const canAct = () => current() && intent === 'narucilac' && !navigating.current && !editor.loading && !editor.busy && !editor.uncertain && !!editor.data;
  const navigate = (action: () => void) => { if (!current() || navigating.current) return;
    dialog.current = null; navigating.current = true; action(); };
  const refresh = () => { if (!current() || editor.busy) return; dialog.current = null;
    if (attempt.current) attempt.current.needsReadback = true; void editor.refresh(); };
  const ask = (title: string, description: string, label: string, command: () => Promise<void>) => {
    if (!canAct() || dialog.current) return;
    const confirmation = {}; dialog.current = confirmation;
    const cancel = () => { if (dialog.current === confirmation) dialog.current = null; };
    Alert.alert(title, description, [{ text: 'Odustani', style: 'cancel', onPress: cancel }, {
      text: label, onPress: () => { if (dialog.current !== confirmation || !canAct()) return;
        dialog.current = null; void command(); },
    }], { cancelable: true, onDismiss: cancel });
  };
  const evaluate = async () => {
    if (!canAct() || !potreba || potreba.stanje !== 'NACRT' || attempt.current) return;
    const request = { needId: potreba.id, expectedRevision: potreba.revizija };
    await editor.save(async () => {
      const result = await publicationClientService.evaluate(request);
      if (!current()) return changed();
      if (!result.ok) return result;
      const evaluation = decodePublicationEvaluation(result.podatak, request);
      if (evaluation?.kind === 'NOT_READY' && evaluation.code === 'NEED_CHANGED') {
        return failure('NEED_CHANGED', 'Zadatak je promenjen. Učitajte trenutno stanje pre nove provere.');
      }
      return evaluation ? { ok: true, podatak: { ...editor.data!, evaluation } }
        : failure('PUBLICATION_INVALID_RESPONSE', 'Rezultat provere nije potvrđen. Učitajte Zadatak ponovo.');
    });
  };
  const publish = async (command: PublishNeedCommand) => {
    if (!canAct() || !potreba || potreba.stanje !== 'NACRT' || command.needId !== potreba.id
      || command.expectedRevision !== potreba.revizija) return;
    await editor.save(async () => {
      attempt.current = { command, needsReadback: true };
      const result = await publicationClientService.publish(command);
      if (!current()) return changed();
      if (!result.ok) {
        if (REJECTED_PUBLICATION.has(result.kod)) attempt.current = null;
        return result;
      }
      if (!matchesReceipt(result.podatak, command)) return failure('PUBLICATION_INVALID_RESPONSE', 'Objava nije potvrđena. Učitajte trenutno stanje pre novog pokušaja.');
      attempt.current = null; setPublishedReceipt(true);
      return read();
    });
  };
  const confirmPublish = () => {
    if (!canAct() || !potreba || potreba.stanje !== 'NACRT' || attempt.current) return;
    const evaluation = editor.data?.evaluation;
    const decision = evaluation?.kind === 'DECISION' ? evaluation.decision : null;
    if (!decision || decision.needId !== potreba.id || decision.needRevision !== potreba.revizija
      || !decision.authoritative || decision.outcome !== 'ALLOW' || !decision.publishable) return;
    ask('Objavi Zadatak?', 'Objavljujete pregledanu verziju Zadatka. Dodatni rok za prijave nije izabran. Tačna lokacija i privatne napomene ostaju privatni.',
      'Objavi Zadatak', async () => publish({ needId: potreba.id, expectedRevision: potreba.revizija,
        decisionSequence: decision.decisionSequence, responseDeadline: null, clientRequestId: noviZahtevId('objava'), confirmed: true }));
  };
  const retryPublish = () => {
    const previous = attempt.current;
    if (!canAct() || !previous || previous.needsReadback) return;
    ask('Ponovi isti zahtev?', 'Ponavljate prethodni zahtev za objavu iste verzije. Dodatni rok za prijave nije izabran.',
      'Ponovi isti zahtev', async () => { if (attempt.current === previous) await publish(previous.command); });
  };
  const zatvoriPreostaluPotragu = () => {
    if (!canAct() || !potreba || preostalaPotragaZatvorena || potreba.pokrivenost.popunjeno <= 0 || potreba.pokrivenost.preostalo <= 0) return;
    ask('Ne traži više nikoga?', `Zatvorićemo potragu za preostalih ${potreba.pokrivenost.preostalo} mesta. Postojeći Dogovori i originalni uslovi Zadatka ostaju nepromenjeni.`,
      'Zatvori potragu', async () => { await editor.save(async () => {
        const result = await ru4Production.closeRemainingSearch(potreba.id, potreba.revizija, noviZahtevId('zatvori-preostalu-potragu'));
        if (!current()) return changed();
        return result.ok ? read() : failure('REMAINING_SEARCH_CLOSE_FAILED', 'Potraga nije potvrđeno zatvorena. Učitajte trenutno stanje.');
      }); });
  };
  const otvoriIzmenu = () => {
    if (!canAct() || !potreba || attempt.current || potreba.pokrivenost.popunjeno !== 0 || preostalaPotragaZatvorena || potreba.stanje === 'ZATVORENA') return;
    ask(potreba.stanje === 'NACRT' ? 'Izmeni nacrt?' : 'Izmena Zadatka', potreba.stanje === 'NACRT'
      ? 'Otvorićete sačuvani Zadatak za pregled i ispravke. Posle čuvanja potrebna je nova provera za objavu.'
      : 'Dok traje izmena, Zadatak privremeno prestaje da prima nove Prijave. Posle čuvanja prolazi ponovnu proveru, a postojeće Prijave će morati da se osveže. Postojeći Dogovori se ne menjaju.',
      'Nastavite', async () => { await editor.save(async () => {
        const result = await aiNeedV2Izvor.openEditConversation(potreba.id);
        if (!current()) return changed();
        if (!result.ok) return result;
        if (!sameId(result.podatak.needId, potreba.id) || !uuid(result.podatak.conversationId) || !positiveInteger(result.podatak.revision)
          || result.podatak.authoritative !== true || !['DRAFT', 'PUBLISHED', 'SELECTION'].includes(result.podatak.needStatus)) {
          return failure('NEED_EDIT_INVALID_RESPONSE', 'Otvaranje izmene nije potvrđeno. Učitajte Zadatak ponovo.');
        }
        if (result.podatak.revision !== potreba.revizija || (potreba.stanje === 'NACRT' && result.podatak.needStatus !== 'DRAFT')) {
          return failure('STALE_REVIEW_REQUIRED', 'Zadatak je promenjen. Učitajte trenutno stanje pre otvaranja izmene.');
        }
        navigate(() => router.push({ pathname: '/nova', params: { conversationId: result.podatak.conversationId } }));
        return { ok: true, podatak: editor.data! };
      }); });
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.ground }}>
      <View
        style={{
          minHeight: 58,
          paddingHorizontal: space.base,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
        }}
      >
        <Press
          accessibilityRole="button"
          accessibilityLabel="Nazad"
          haptic="select"
          onPress={() => navigate(() => router.back())}
          style={{
            width: touch.min,
            height: touch.min,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={21} color={palette.ink} />
        </Press>
        <T variant="title" style={{ flex: 1 }}>Pregled Zadatka</T>
      </View>

      {publishedReceipt ? <View style={{ padding: space.base, gap: space.sm }}>
        <T accessibilityRole="alert" tone="success">{greska
          ? 'Objava je potvrđena. Trenutni prikaz treba osvežiti.'
          : ucitava || editor.busy ? 'Objava je potvrđena. Učitavamo trenutno stanje Zadatka.'
          : 'Server je potvrdio objavu. Prikazujemo ponovo učitano stanje Zadatka.'}</T>
      </View> : null}
      {ucitava ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.teal500} />
        </View>
      ) : greska || !potreba ? (
        <View style={{ flex: 1, padding: space.base, justifyContent: 'center', gap: space.md }}>
          <T variant="heading">Zadatak nije dostupan</T>
          <T variant="body" tone="muted">{greska ?? 'Pokušajte ponovo.'}</T>
          <Press
            accessibilityRole="button"
            accessibilityLabel="Pokušaj ponovo"
            haptic="light"
            onPress={refresh}
            style={{
              minHeight: touch.min,
              borderRadius: radius.md,
              backgroundColor: palette.forest800,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T variant="action" tone="onDark">Pokušajte ponovo</T>
          </Press>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: space.base, paddingBottom: space.xxl, gap: space.base }}
          showsVerticalScrollIndicator={false}
        >
          <Card style={elevation.card}>
            <View style={{ padding: space.base, gap: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: palette.orange }} />
                <T variant="label" tone="muted" style={{ flex: 1 }}>ZADATAK</T>
                <T variant="meta" tone="orange" style={{ fontWeight: '800' }}>
                  {STATUS[potreba.stanje]}
                </T>
              </View>

              <T variant="display">{potreba.naslov}</T>
              <T variant="body" tone="muted">{potreba.opis}</T>

              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: palette.line100,
                  paddingTop: space.md,
                  gap: space.sm,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <MapPin size={17} color={palette.teal500} />
                  <T variant="body" style={{ flex: 1 }}>{potreba.podrucjeTekst}</T>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Clock size={17} color={palette.teal500} />
                  <T variant="body" style={{ flex: 1 }}>{potreba.vremeTekst}</T>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Users size={17} color={palette.teal500} />
                  <T variant="body" style={{ flex: 1 }}>
                    {potreba.pokrivenost.popunjeno} od {potreba.pokrivenost.ukupno} mesta dogovoreno
                  </T>
                </View>
              </View>

              <View style={{ height: 7, borderRadius: radius.pill, backgroundColor: palette.cream050, overflow: 'hidden' }}>
                <View
                  style={{
                    height: '100%',
                    width: `${Math.max(0, Math.min(100, potreba.pokrivenost.udeo * 100))}%`,
                    borderRadius: radius.pill,
                    backgroundColor: palette.teal500,
                  }}
                />
              </View>

              {potreba.ponudjenaCena && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: space.md,
                    borderRadius: radius.md,
                    backgroundColor: palette.cream050,
                  }}
                >
                  <T variant="meta" tone="muted">Vaša cena</T>
                  <T variant="heading">{potreba.ponudjenaCena.prikaz}</T>
                </View>
              )}

              {potreba.uslovi.length > 0 && (
                <View style={{ gap: space.sm }}>
                  <T variant="label" tone="muted">USLOVI</T>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                    {potreba.uslovi.map((uslov) => (
                      <View
                        key={uslov}
                        style={{
                          borderWidth: 1,
                          borderColor: palette.line100,
                          borderRadius: radius.pill,
                          paddingHorizontal: space.md,
                          paddingVertical: 6,
                        }}
                      >
                        <T variant="meta" tone="muted" style={{ fontWeight: '700' }}>{uslov}</T>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </Card>

          {potreba.stanje === 'NACRT' && intent === 'narucilac' ? <NeedPublicationPanel
            evaluation={editor.data?.evaluation ?? null} busy={akcijaUToku}
            retrying={!!attempt.current && !attempt.current.needsReadback}
            onEvaluate={() => { void evaluate(); }} onPublish={confirmPublish} onRetry={retryPublish} onEdit={otvoriIzmenu} /> : null}

          {preostalaPotragaZatvorena ? (
            <View
              style={{
                padding: space.base,
                borderRadius: radius.lg,
                backgroundColor: palette.cream050,
                borderWidth: 1,
                borderColor: palette.line100,
                gap: 4,
              }}
            >
              <T variant="bodyStrong">Preostala potraga je zatvorena</T>
              <T variant="meta" tone="muted">
                Originalni Zadatak i postojeći Dogovori ostaju nepromenjeni.
              </T>
            </View>
          ) : null}

          {intent === 'narucilac' && potreba.pokrivenost.popunjeno === 0 &&
          !preostalaPotragaZatvorena &&
          potreba.stanje !== 'NACRT' &&
          potreba.stanje !== 'ZATVORENA' ? (
            <Press
              accessibilityRole="button"
              accessibilityLabel="Izmeni Zadatak"
              accessibilityState={{ disabled: akcijaUToku }}
              haptic="light"
              disabled={akcijaUToku}
              onPress={otvoriIzmenu}
              style={{
                minHeight: touch.min,
                paddingHorizontal: space.base,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: palette.line100,
                flexDirection: 'row',
                gap: space.sm,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: palette.surface,
              }}
            >
              <PencilSimple size={18} color={palette.ink} />
              <T variant="action">Izmeni Zadatak</T>
            </Press>
          ) : null}

          {intent === 'narucilac' && potreba.pokrivenost.popunjeno > 0 &&
          potreba.pokrivenost.preostalo > 0 &&
          !preostalaPotragaZatvorena ? (
            <Press
              accessibilityRole="button"
              accessibilityLabel="Ne traži više nikoga"
              accessibilityState={{ disabled: akcijaUToku }}
              disabled={akcijaUToku}
              haptic="medium"
              onPress={zatvoriPreostaluPotragu}
              style={{
                minHeight: touch.min,
                paddingHorizontal: space.base,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: palette.line100,
                flexDirection: 'row',
                gap: space.sm,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: akcijaUToku ? 0.55 : 1,
              }}
            >
              {akcijaUToku ? <ActivityIndicator size="small" color={palette.ink} /> : <UserMinus size={18} color={palette.ink} />}
              <T variant="action">Ne traži više nikoga</T>
            </Press>
          ) : null}

          <Press
            accessibilityRole="button"
            accessibilityLabel={`Otvori prijave, ukupno ${potreba.brojPrijava}`}
            haptic="light"
            onPress={() => navigate(() => router.push({ pathname: '/potrebe/[id]/kandidati', params: { id: potreba.id } }))}
          >
            <Card style={elevation.card}>
              <View
                style={{
                  minHeight: 72,
                  padding: space.base,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                }}
              >
                <View style={{ flex: 1, gap: 3 }}>
                  <T variant="heading">Prijave</T>
                  <T variant="meta" tone="muted">
                    {potreba.brojPrijava === 0
                      ? 'Još nema kandidata za ovaj Zadatak.'
                      : `${potreba.brojPrijava} ${potreba.brojPrijava === 1 ? 'kandidat' : 'kandidata'} za pregled`}
                  </T>
                </View>
                <CaretRight size={19} color={palette.ink} />
              </View>
            </Card>
          </Press>

          <T variant="meta" tone="muted" style={{ textAlign: 'center' }}>
            Revizija {potreba.revizija}. Izbor kandidata se vezuje za ovu autoritativnu verziju Zadatka.
          </T>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
