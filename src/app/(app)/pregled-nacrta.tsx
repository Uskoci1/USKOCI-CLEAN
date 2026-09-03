import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
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
import { aiNeedV2Izvor } from '../../data';
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

export default function PregledNacrtaR07() {
  const params = useLocalSearchParams<{ conversationId?: string | string[] }>();
  const conversationId = Array.isArray(params.conversationId) ? params.conversationId[0] : params.conversationId;
  const [stanje, setStanje] = useState<AiNeedV2Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyFactId, setBusyFactId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [greska, setGreska] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const requestId = useRef(`ru2-r07-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  const osvezi = useCallback(async () => {
    if (!conversationId) {
      setGreska('Nacrt nije izabran.');
      setLoading(false);
      return false;
    }
    try {
      const result = await aiNeedV2Izvor.loadConversation(conversationId);
      if (!result) {
        setGreska('Nacrt nije dostupan ovom nalogu.');
        setStanje(null);
        return false;
      }
      setStanje(result);
      setGreska(null);
      return true;
    } catch (error: any) {
      setGreska(error?.message || 'Pregled trenutno nije mogao da se učita.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void osvezi();
  }, [osvezi]);

  const potvrdi = useCallback(async (fact: AiNeedV2Fact) => {
    setBusyFactId(fact.id);
    setGreska(null);
    try {
      const result = await aiNeedV2Izvor.confirmFact(fact.id);
      if (!result.ok) {
        setGreska(result.poruka);
        return;
      }
      await osvezi();
    } finally {
      setBusyFactId(null);
    }
  }, [osvezi]);

  const sacuvajIspravku = useCallback(async () => {
    if (!edit) return;
    const parsed = correctionFromText(edit.fact, edit.text);
    if (!parsed.ok) {
      setEdit({ ...edit, error: parsed.message });
      return;
    }
    setBusyFactId(edit.fact.id);
    setGreska(null);
    try {
      const result = await aiNeedV2Izvor.correctFact(edit.fact.id, parsed.value, parsed.displayValue);
      if (!result.ok) {
        setEdit({ ...edit, error: result.poruka });
        return;
      }
      setEdit(null);
      await osvezi();
    } finally {
      setBusyFactId(null);
    }
  }, [edit, osvezi]);

  const sacuvajNacrt = useCallback(async () => {
    if (!conversationId || !stanje?.review.canSaveDraft || saving) return;
    setSaving(true);
    setGreska(null);
    try {
      const result = await aiNeedV2Izvor.saveDraft(conversationId, requestId.current);
      if (!result.ok) {
        setGreska(result.poruka);
        return;
      }
      router.replace({ pathname: '/potrebe/[id]/pregled', params: { id: result.podatak.needId } });
    } finally {
      setSaving(false);
    }
  }, [conversationId, saving, stanje?.review.canSaveDraft]);

  const vratiSeURazgovor = useCallback(() => {
    if (!conversationId) {
      router.back();
      return;
    }
    router.replace({ pathname: '/nova', params: { conversationId } });
  }, [conversationId]);

  const facts = useMemo(() => sortFacts(stanje?.facts ?? []), [stanje?.facts]);
  const confirmed = facts.filter((fact) => fact.status === 'CONFIRMED').length;
  const safetyCopy = stanje ? safetyMessage(stanje.safety) : null;
  const alreadySaved = stanje?.review.boundNeedId ?? null;
  const saveAllowed = Boolean(stanje?.review.canSaveDraft && stanje?.safety !== 'BLOCK' && !alreadySaved);

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
          <Button label="Nazad" kind="secondary" onPress={() => router.back()} />
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
                <T variant="label" tone="muted">HUMAN REVIEW</T>
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
                  Obavezni podaci su potvrđeni. Server može da napravi DRAFT.
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
                Ovaj razgovor je već vezan za jedan DRAFT Zadatak. Ne pravimo drugi.
              </T>
              <Button
                full
                label="Otvorite sačuvani Zadatak"
                onPress={() => router.replace({ pathname: '/potrebe/[id]/pregled', params: { id: alreadySaved } })}
              />
            </View>
          </Card>
        ) : null}

        {facts.map((fact) => {
          const potvrdjen = fact.status === 'CONFIRMED';
          const busy = busyFactId === fact.id;
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
                      onChangeText={(text) => setEdit({ ...edit, text, error: null })}
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
                      <Button label="Odustani" kind="quiet" onPress={() => setEdit(null)} />
                      <Button label="Sačuvaj ispravku" disabled={busy} onPress={sacuvajIspravku} />
                    </View>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <Button
                      label={canEditFactInline(fact) ? 'Izmenite' : 'Izmenite u razgovoru'}
                      kind="quiet"
                      icon={<PencilSimple size={16} color={palette.inkMuted} />}
                      onPress={() => {
                        if (!canEditFactInline(fact)) {
                          vratiSeURazgovor();
                          return;
                        }
                        setEdit({ fact, text: fact.displayValue, error: null });
                      }}
                    />
                    {!potvrdjen ? (
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
          </View>
        ) : null}

        {!alreadySaved ? (
          <Card raised>
            <View style={{ padding: space.base, gap: space.md }}>
              <View style={{ gap: space.xs }}>
                <T variant="heading">Sačuvajte kao nacrt</T>
                <T variant="body" tone="muted">
                  Ovo još nije objava. Server pravi samo DRAFT Zadatak; admission i objava ostaju poseban sledeći korak.
                </T>
              </View>
              <Button
                label={saving ? 'Čuvanje...' : 'Sačuvajte DRAFT'}
                full
                haptic="success"
                disabled={!saveAllowed || saving}
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
