import { useEffect, useMemo, useState } from 'react';
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

import type { AiNeedV2Fact } from '../../contracts/aiNeedV2';
import { useAiNeedFlow } from '../../hooks/useAiNeedFlow';
import {
  canEditFactInline,
  correctionFromText,
  correctionInputText,
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
  const conversationId = params.conversationId;
  if (typeof conversationId !== 'string' || conversationId.length !== 36 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId)) {
    return <SafeAreaView style={{ flex: 1, padding: space.base, backgroundColor: palette.ground }}>
      <T variant="heading">Nacrt nije dostupan</T>
      <Button label="Nazad na Zadatke" onPress={() => router.replace('/potrebe')} />
    </SafeAreaView>;
  }
  return <PregledContent conversationId={conversationId} />;
}

function PregledContent({ conversationId }: { conversationId: string }) {
  const { model, state: flow } = useAiNeedFlow(conversationId);
  const stanje = flow.conversation;
  const loading = !stanje && !flow.error;
  const saving = flow.busy === 'save';
  const greska = flow.error;
  const [edit, setEdit] = useState<EditState | null>(null);
  useEffect(() => setEdit(null), [model]);
  const potvrdi = (fact: AiNeedV2Fact) => model.confirm(fact);
  const sacuvajIspravku = async () => {
    if (!edit || flow.busy || !flow.fresh || !model.isCurrent()) return;
    const parsed = correctionFromText(edit.fact, edit.text, 'lines');
    if (!parsed.ok) { setEdit({ ...edit, error: parsed.message }); return; }
    const accepted = await model.correct(edit.fact, parsed.value, parsed.displayValue);
    if (accepted && model.isCurrent()) setEdit(null);
  };
  const sacuvajNacrt = async () => {
    await model.save();
    const needId = model.snapshot().savedNeedId;
    if (model.isCurrent() && needId) router.replace({ pathname: '/potrebe/[id]/pregled', params: { id: needId } });
  };
  const vratiSeURazgovor = () => {
    if (!model.isCurrent()) return;
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/nova', params: { conversationId } });
  };
  const facts = useMemo(() => sortFacts(stanje?.facts ?? []), [stanje?.facts]);
  const confirmed = facts.filter(fact => fact.status === 'CONFIRMED').length;
  const safetyCopy = stanje ? safetyMessage(stanje.safety) : null;
  const alreadySaved = stanje?.review.boundNeedId ?? flow.savedNeedId;
  const saveAllowed = Boolean(flow.fresh && !flow.busy && flow.reviewPendingCount === 0 && stanje?.review.canSaveDraft && stanje?.safety !== 'BLOCK' && !alreadySaved);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.ground, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.teal500} />
        <Button label="Nazad u razgovor" kind="quiet" onPress={vratiSeURazgovor} />
      </SafeAreaView>
    );
  }

  if (!stanje) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.ground, padding: space.xl, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', gap: space.base }}>
          <Warning size={30} color={palette.danger} weight="fill" />
          <T variant="body" tone="danger" style={{ textAlign: 'center' }}>{greska ?? 'Nacrt nije dostupan.'}</T>
          <Button label="Pokušajte ponovo" disabled={!!flow.busy} onPress={() => void model.refresh()} />
          <Button label="Nazad u razgovor" kind="secondary" onPress={vratiSeURazgovor} />
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
                <T variant="label" tone="muted">VAŠA PROVERA</T>
                <T variant="heading">{confirmed} od {facts.length} podataka potvrđeno</T>
                {flow.reviewPendingCount > 0 && <T variant="meta" tone="muted">Još {flow.reviewPendingCount} predloga čeka Vašu proveru, uključujući dodatne uslove.</T>}
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
                  Obavezni podaci su potvrđeni. Nacrt još nije objavljen.
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
                Zadatak je sačuvan kao nacrt i još nije objavljen.
              </T>
              <Button
                full
                label="Otvorite sačuvani Zadatak"
                onPress={() => { if (model.isCurrent()) router.replace({ pathname: '/potrebe/[id]/pregled', params: { id: alreadySaved } }); }}
              />
            </View>
          </Card>
        ) : null}

        {facts.map((fact) => {
          const potvrdjen = fact.status === 'CONFIRMED';
          const busy = !!flow.busy || !flow.fresh || flow.pendingSave || !!alreadySaved || stanje.safety === 'BLOCK';
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
                    <T variant="meta" tone="muted">{fact.status === 'CONFIRMED' ? 'Potvrđeno' : fact.source === 'AI_INFERENCE' ? 'Predlog AI — proverite' : 'Iz odgovora — proverite'}</T>
                    {fact.evidence ? (
                      <T variant="meta" tone="muted">Iz razgovora: „{fact.evidence}“</T>
                    ) : null}
                  </View>
                  {potvrdjen ? <CheckCircle size={22} color={palette.success} weight="fill" /> : null}
                </View>

                {editing ? (
                  <View style={{ gap: space.sm }}>
                    <TextInput
                      accessibilityLabel={`Nova vrednost: ${factLabel(fact.key)}`}
                      editable={!busy}
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
                    {fact.valueType === 'TEXT_ARRAY' && <T variant="meta" tone="muted">Jedna stavka po redu.</T>}
                    {edit.error ? <T variant="meta" tone="danger">{edit.error}</T> : null}
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm }}>
                      <Button label="Odustani" kind="quiet" onPress={() => setEdit(null)} />
                      <Button label="Sačuvaj ispravku" disabled={busy} onPress={sacuvajIspravku} />
                    </View>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <Button
                      accessibilityLabel={`Izmenite: ${factLabel(fact.key)}`}
                      label={canEditFactInline(fact) ? 'Izmenite' : 'Izmenite u razgovoru'}
                      kind="quiet"
                      disabled={busy}
                      icon={<PencilSimple size={16} color={palette.inkMuted} />}
                      onPress={() => {
                        if (busy || !model.isCurrent()) return;
                        if (!canEditFactInline(fact)) {
                          vratiSeURazgovor();
                          return;
                        }
                        setEdit({ fact, text: correctionInputText(fact), error: null });
                      }}
                    />
                    {!potvrdjen ? (
                      <Button
                        accessibilityLabel={`Potvrdite: ${factLabel(fact.key)}`}
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

        {(!flow.fresh || greska || flow.pendingSave) && <Button label="Osvežite nacrt" disabled={!!flow.busy} onPress={() => void model.refresh()} />}
        {flow.pendingSave && <T variant="meta" tone="muted">Čuvanje još nije potvrđeno. Provera ili ponovni pokušaj odnose se na isti nacrt.</T>}
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
                  Sačuvajte proverene podatke kao nacrt. Zadatak još neće biti objavljen.
                </T>
              </View>
              <Button
                label={saving ? 'Čuvanje...' : 'Sačuvajte nacrt'}
                full
                haptic="success"
                disabled={!saveAllowed || saving}
                onPress={sacuvajNacrt}
              />
              {!saveAllowed && stanje.safety !== 'BLOCK' ? (
                <T variant="meta" tone="muted" style={{ textAlign: 'center' }}>
                  Potvrdite ili ispravite sve predložene podatke pre čuvanja.
                </T>
              ) : null}
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
