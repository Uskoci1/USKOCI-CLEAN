import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Check,
  CheckCircle,
  LockKey,
  PencilSimple,
  ShieldCheck,
  Warning,
} from 'phosphor-react-native';

import type { AiNeedV2Conversation, AiNeedV2Fact } from '../../contracts/aiNeedV2';
import type { PotrebaProjekcija } from '../../contracts/projections';
import { aiNeedV2Izvor, izvor } from '../../data';
import type { Ishod } from '../../data/ports';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { sesijaSada, useSesija } from '../../store/sesija';
import { ulogaSada, useUloga } from '../../store/uloga';
import {
  canEditFactInline,
  correctionFromText,
  factLabel,
  safetyMessage,
  sortFacts,
} from '../../data/aiNeedV2Ui';
import { palette, radius, space, touch } from '../../theme/tokens';
import { Button, Card } from '../../ui/Button';
import { Press } from '../../ui/Press';
import { T } from '../../ui/Text';

type EditState = {
  fact: AiNeedV2Fact;
  text: string;
  error: string | null;
};
type ReviewSnapshot = { conversation: AiNeedV2Conversation; need: PotrebaProjekcija | null };

export default function PregledNacrtaR07() {
  const params = useLocalSearchParams<{ conversationId?: string | string[] }>();
  const conversationId = typeof params.conversationId === 'string' ? params.conversationId : undefined;
  const { user, accountRevision } = useSesija();
  const intent = useUloga();
  const accountId = user?.id;
  const routeIdentity = useMemo(() => ({}), [conversationId, accountId, accountRevision, intent]);
  const currentRoute = useRef(routeIdentity);
  currentRoute.current = routeIdentity;
  const focused = useRef(false);
  const focusScope = useRef<object | null>(null);
  const navigating = useRef(false);
  useFocusEffect(useCallback(() => {
    focused.current = true; focusScope.current = {}; navigating.current = false;
    return () => { focused.current = false; focusScope.current = null; };
  }, [routeIdentity]));
  const read = useCallback(async (): Promise<Ishod<ReviewSnapshot>> => {
    if (!conversationId) return { ok: false, kod: 'REVIEW_REQUIRED', poruka: 'Nacrt nije izabran.' };
    const readScope = focusScope.current;
    const current = () => focused.current && focusScope.current === readScope && currentRoute.current === routeIdentity &&
      sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision && ulogaSada() === intent;
    try {
      const conversation = await aiNeedV2Izvor.loadConversation(conversationId);
      if (!current()) return { ok: false, kod: 'REVIEW_CHANGED', poruka: 'Ponovo otvorite pregled.' };
      if (!conversation || conversation.conversationId !== conversationId) {
        return { ok: false, kod: 'REVIEW_UNAVAILABLE', poruka: 'Nacrt nije dostupan ovom nalogu.' };
      }
      const need = conversation.review.boundNeedId ? await izvor.potreba(conversation.review.boundNeedId) : null;
      if (!current()) return { ok: false, kod: 'REVIEW_CHANGED', poruka: 'Ponovo otvorite pregled.' };
      if (conversation.review.boundNeedId && (!need || need.id !== conversation.review.boundNeedId)) {
        return { ok: false, kod: 'BOUND_NEED_UNAVAILABLE', poruka: 'Zadatak trenutno nije dostupan. Učitajte pregled ponovo.' };
      }
      return { ok: true, podatak: { conversation, need } };
    } catch {
      return { ok: false, kod: 'REVIEW_READ_FAILED', poruka: 'Pregled trenutno nije moguće učitati. Proverite vezu i pokušajte ponovo.' };
    }
  }, [conversationId, routeIdentity, accountId, accountRevision, intent]);
  const editor = useOwnedEditor(read);
  const stanje = editor.data?.conversation ?? null;
  const vezanZadatak = editor.data?.need ?? null;
  const loading = editor.loading;
  const saving = editor.busy;
  const greska = editor.error;
  const [edit, setEdit] = useState<EditState | null>(null);
  useEffect(() => { setEdit(null); }, [editor.data]);

  // Navigation and local edit callbacks belong to the same visible, focused review.
  const viewIdentity = useMemo(() => ({}), [editor.data, conversationId, accountId, accountRevision, intent]);
  const currentView = useRef(viewIdentity);
  currentView.current = viewIdentity;
  const isCurrent = () => focused.current && currentView.current === viewIdentity &&
    !!accountId && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision && ulogaSada() === intent;
  const canAct = () => isCurrent() && !navigating.current && !editor.loading && !editor.busy && !editor.uncertain && !!editor.data;
  const navigate = (action: () => void) => {
    if (!isCurrent() || navigating.current) return;
    navigating.current = true; action();
  };
  const requestId = useMemo(() => `ru2-r07-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    [conversationId, accountId, accountRevision]);
  const editRequestId = useMemo(() => `ru4-edit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    [conversationId, accountId, accountRevision]);

  const facts = useMemo(() => sortFacts(stanje?.facts ?? []), [stanje?.facts]);
  const confirmed = facts.filter(fact => fact.status === 'CONFIRMED').length;
  const safetyCopy = stanje ? safetyMessage(stanje.safety) : null;
  const boundNeedId = stanje?.review.boundNeedId ?? null;
  const editMode = Boolean(boundNeedId && vezanZadatak && vezanZadatak.stanje !== 'NACRT');
  const alreadySaved = editMode ? null : boundNeedId;
  const saveAllowed = Boolean(stanje?.review.canSaveDraft && stanje?.safety !== 'BLOCK' && !alreadySaved);
  const blocked = saving || editor.uncertain || loading;

  const potvrdi = async (fact: AiNeedV2Fact) => {
    if (!canAct() || !stanje?.facts.includes(fact)) return;
    await editor.save(async () => {
      const result = await aiNeedV2Izvor.confirmFact(fact.id);
      if (!result.ok) return result;
      if (!isCurrent()) return { ok: false, kod: 'REVIEW_CHANGED', poruka: 'Ponovo otvorite pregled.' };
      return read();
    });
  };
  const sacuvajIspravku = async () => {
    if (!canAct() || !edit || !stanje?.facts.includes(edit.fact)) return;
    const parsed = correctionFromText(edit.fact, edit.text);
    if (!parsed.ok) { setEdit({ ...edit, error: parsed.message }); return; }
    await editor.save(async () => {
      const result = await aiNeedV2Izvor.correctFact(edit.fact.id, parsed.value, parsed.displayValue);
      if (!result.ok) return result;
      if (!isCurrent()) return { ok: false, kod: 'REVIEW_CHANGED', poruka: 'Ponovo otvorite pregled.' };
      return read();
    });
  };
  const sacuvajNacrt = async () => {
    if (!canAct() || !conversationId || !saveAllowed || editMode) return;
    await editor.save(async () => {
      const result = await aiNeedV2Izvor.saveDraft(conversationId, requestId);
      if (!result.ok) return result;
      if (isCurrent() && !navigating.current) {
        navigating.current = true;
        router.replace({ pathname: '/potrebe/[id]/pregled', params: { id: result.podatak.needId } });
      }
      return { ok: true, podatak: editor.data! };
    });
  };
  const sacuvajIzmene = async () => {
    if (!canAct() || !conversationId || !boundNeedId || !vezanZadatak || !editMode || !saveAllowed) return;
    // Send the revision loaded with this visible review. Never adopt a newer
    // revision at confirmation time; the server must reject a stale review.
    const reviewedRevision = vezanZadatak.revizija;
    await editor.save(async () => {
      const result = await aiNeedV2Izvor.confirmEdit(boundNeedId, reviewedRevision, conversationId, editRequestId);
      if (!result.ok) return result;
      if (isCurrent() && !navigating.current) {
        navigating.current = true;
        router.replace({ pathname: '/potrebe/[id]/pregled', params: { id: result.podatak.needId } });
      }
      return { ok: true, podatak: editor.data! };
    });
  };
  const vratiSeURazgovor = () => navigate(() => {
    if (!conversationId) router.back();
    else router.replace({ pathname: '/nova', params: { conversationId } });
  });

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.ground, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.teal500} />
      </SafeAreaView>
    );
  }

  if (!stanje) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.ground, padding: space.xl, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', gap: space.base }}>
          <Warning size={30} color={palette.danger} weight="fill" />
          <T variant="body" tone="danger" style={{ textAlign: 'center' }}>{greska ?? 'Nacrt nije dostupan.'}</T>
          <Button label="Učitajte pregled ponovo" onPress={() => { void editor.refresh(); }} />
          <Button label="Nazad" kind="secondary" onPress={() => navigate(() => router.back())} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.ground }}>
      <View
        style={{
          paddingHorizontal: space.base,
          paddingVertical: space.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
        }}
      >
        <Press
          accessibilityRole="button"
          accessibilityLabel="Nazad u razgovor"
          haptic="select"
          onPress={vratiSeURazgovor}
          style={{
            width: touch.min,
            height: touch.min,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: palette.line100,
            backgroundColor: palette.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={20} color={palette.ink} weight="bold" />
        </Press>
        <View style={{ flex: 1 }}>
          <T variant="label" tone="orange">PREGLED PRE ČUVANJA</T>
          <T variant="title">Proverite Zadatak</T>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.base, paddingBottom: space.huge, gap: space.base }}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <View style={{ padding: space.base, gap: space.md }}>
            <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <T variant="label" tone="muted">VAŠA POTVRDA</T>
                <T variant="heading">{confirmed} od {facts.length} podataka potvrđeno</T>
              </View>
              <CheckCircle
                size={28}
                color={stanje.review.canSaveDraft ? palette.success : palette.orangeInk}
                weight="fill"
              />
            </View>

            {stanje.review.missingRequired.length > 0 ? (
              <View style={{ backgroundColor: palette.warnBg, borderRadius: radius.md, padding: space.md, gap: space.xs }}>
                <T variant="meta" style={{ fontWeight: '800' }}>Još treba potvrditi ili dopuniti:</T>
                <T variant="meta" tone="muted">
                  {stanje.review.missingRequired.map(factLabel).join(' · ')}
                </T>
              </View>
            ) : (
              <View style={{ backgroundColor: palette.successBg, borderRadius: radius.md, padding: space.md, flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                <Check size={17} color={palette.success} weight="bold" />
                <T variant="meta" tone="success" style={{ flex: 1, fontWeight: '700' }}>
                  Obavezni podaci su potvrđeni. Zadatak možete sačuvati kao nacrt.
                </T>
              </View>
            )}
          </View>
        </Card>

        {safetyCopy ? (
          <View
            style={{
              padding: space.md,
              borderRadius: radius.md,
              backgroundColor: stanje.safety === 'BLOCK' ? palette.dangerBg : palette.warnBg,
              flexDirection: 'row',
              gap: space.sm,
              alignItems: 'center',
            }}
          >
            <ShieldCheck size={18} color={stanje.safety === 'BLOCK' ? palette.danger : palette.warn} weight="fill" />
            <T variant="meta" tone={stanje.safety === 'BLOCK' ? 'danger' : 'muted'} style={{ flex: 1 }}>
              {safetyCopy}
            </T>
          </View>
        ) : null}

        {alreadySaved ? (
          <Card raised>
            <View style={{ padding: space.base, gap: space.md }}>
              <T variant="heading">Nacrt je već sačuvan</T>
              <T variant="body" tone="muted">
                Zadatak iz ovog razgovora je sačuvan i možete mu se vratiti.
              </T>
              <Button
                full
                label="Otvorite sačuvani Zadatak"
                onPress={() => navigate(() => router.replace({ pathname: '/potrebe/[id]/pregled', params: { id: alreadySaved } }))}
              />
            </View>
          </Card>
        ) : null}

        {!alreadySaved && conversationId ? <Button label="Mesto Zadatka" kind="secondary" disabled={blocked}
          onPress={() => { if (canAct()) navigate(() => router.push({ pathname: '/mesto-zadatka', params: { conversationId } })); }} /> : null}

        {facts.map((fact) => {
          const locationFact = ['need.task_geography', 'need.task_country_code', 'need.exact_address', 'need.access_notes', 'need.resolved_location'].includes(fact.key);
          const potvrdjen = fact.status === 'CONFIRMED';
          const busy = blocked;
          const editing = edit?.fact.id === fact.id;
          return (
            <Card key={fact.id}>
              <View style={{ padding: space.base, gap: space.md }}>
                <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, gap: space.xs }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                      <T variant="label" tone="muted">{factLabel(fact.key).toUpperCase()}</T>
                      {fact.privacyClass === 'PRIVATE' ? (
                        <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: palette.cream050, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 3 }}>
                          <LockKey size={12} color={palette.inkMuted} weight="fill" />
                          <T variant="meta" tone="muted">privatno</T>
                        </View>
                      ) : null}
                    </View>
                    <T variant="bodyStrong">{fact.displayValue}</T>
                    {fact.evidence ? (
                      <T variant="meta" tone="muted">Iz razgovora: „{fact.evidence}“</T>
                    ) : null}
                  </View>
                  {potvrdjen ? <CheckCircle size={22} color={palette.success} weight="fill" /> : null}
                </View>

                {editing ? (
                  <View style={{ gap: space.sm }}>
                    <TextInput
                      value={edit.text}
                      onChangeText={(text) => { if (canAct()) setEdit({ ...edit, text, error: null }); }}
                      editable={!blocked}
                      autoFocus
                      multiline={fact.valueType === 'TEXT' || fact.valueType === 'TEXT_ARRAY'}
                      style={{
                        minHeight: touch.min,
                        borderWidth: 1,
                        borderColor: edit.error ? palette.danger : palette.line100,
                        borderRadius: radius.md,
                        backgroundColor: palette.raised,
                        color: palette.ink,
                        paddingHorizontal: space.md,
                        paddingVertical: space.sm,
                        fontSize: 16,
                      }}
                    />
                    {edit.error ? <T variant="meta" tone="danger">{edit.error}</T> : null}
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm }}>
                      <Button label="Odustani" kind="quiet" disabled={blocked} onPress={() => { if (canAct()) setEdit(null); }} />
                      <Button label="Sačuvaj ispravku" disabled={busy} onPress={sacuvajIspravku} />
                    </View>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <Button
                      label={locationFact ? 'Izmenite mesto' : canEditFactInline(fact) ? 'Izmenite' : 'Izmenite u razgovoru'}
                      kind="quiet"
                      icon={<PencilSimple size={16} color={palette.inkMuted} />}
                      disabled={blocked}
                      onPress={() => {
                        if (!canAct()) return;
                        if (locationFact && conversationId) {
                          navigate(() => router.push({ pathname: '/mesto-zadatka', params: { conversationId } }));
                          return;
                        }
                        if (!canEditFactInline(fact)) {
                          vratiSeURazgovor();
                          return;
                        }
                        setEdit({ fact, text: fact.displayValue, error: null });
                      }}
                    />
                    {!potvrdjen && fact.key !== 'need.resolved_location' ? (
                      <Button
                        label="Potvrdite"
                        kind="secondary"
                        disabled={busy}
                        icon={<Check size={16} color={palette.ink} weight="bold" />}
                        onPress={() => void potvrdi(fact)}
                      />
                    ) : null}
                  </View>
                )}
              </View>
            </Card>
          );
        })}

        {facts.length === 0 ? (
          <Card>
            <View style={{ padding: space.base, gap: space.md }}>
              <T variant="heading">Još nema podataka za pregled</T>
              <T variant="body" tone="muted">Vratite se u razgovor i opišite šta Vam treba.</T>
              <Button label="Nazad u razgovor" kind="secondary" onPress={vratiSeURazgovor} />
            </View>
          </Card>
        ) : null}

        {greska ? (
          <View style={{ backgroundColor: palette.dangerBg, borderRadius: radius.md, padding: space.md }}>
            <T variant="meta" tone="danger">{greska}</T>
            <Button label="Učitajte pregled ponovo" kind="secondary" onPress={() => { void editor.refresh(); }} />
          </View>
        ) : null}

        {editMode ? (
          <Card raised>
            <View style={{ padding: space.base, gap: space.md }}>
              <View style={{ gap: space.xs }}>
                <T variant="heading">Sačuvajte izmene</T>
                <T variant="body" tone="muted">
                  Zadatak se vraća u nacrt i prolazi ponovnu proveru pre nego što ponovo bude vidljiv. Postojeće Prijave će morati da se osveže; Dogovori se ne menjaju.
                </T>
              </View>
              <Button
                label={saving ? 'Čuvanje...' : 'Sačuvajte izmene'}
                full
                haptic="success"
                disabled={!saveAllowed || blocked}
                onPress={() => { void sacuvajIzmene(); }}
              />
              {!saveAllowed && stanje.safety !== 'BLOCK' ? (
                <T variant="meta" tone="muted" style={{ textAlign: 'center' }}>
                  Potvrdite sve podatke pre čuvanja izmena.
                </T>
              ) : null}
            </View>
          </Card>
        ) : null}

        {!alreadySaved && !editMode ? (
          <Card raised>
            <View style={{ padding: space.base, gap: space.md }}>
              <View style={{ gap: space.xs }}>
                <T variant="heading">Sačuvajte kao nacrt</T>
                <T variant="body" tone="muted">
                  Zadatak ostaje privatan nacrt. Pregled i objava dolaze u sledećem koraku.
                </T>
              </View>
              <Button
                label={saving ? 'Čuvanje...' : 'Sačuvajte nacrt'}
                full
                haptic="success"
                disabled={!saveAllowed || blocked}
                onPress={sacuvajNacrt}
              />
              {!saveAllowed && stanje.safety !== 'BLOCK' ? (
                <T variant="meta" tone="muted" style={{ textAlign: 'center' }}>
                  Potvrdite sve obavezne podatke pre čuvanja.
                </T>
              ) : null}
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
