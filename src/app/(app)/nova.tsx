import { useRef } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowRight,
  CheckCircle,
  PaperPlaneTilt,
  ShieldCheck,
  Sparkle,
  Warning,
} from 'phosphor-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useAiNeedFlow } from '../../hooks/useAiNeedFlow';
import { factLabel, safetyMessage, sortFacts } from '../../data/aiNeedV2Ui';
import { palette, radius, space, touch } from '../../theme/tokens';
import { Button, Card } from '../../ui/Button';
import { Press } from '../../ui/Press';
import { T } from '../../ui/Text';

export default function NovaPotrebaV2() {
  const params = useLocalSearchParams<{ conversationId?: string | string[] }>();
  const resumeId = params.conversationId;
  if (Array.isArray(resumeId) || (resumeId !== undefined && (resumeId.length !== 36 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resumeId)))) {
    return <SafeAreaView style={{ flex: 1, padding: space.base, backgroundColor: palette.ground }}>
      <T variant="heading">Nacrt nije dostupan</T>
      <Button label="Nazad na Zadatke" onPress={() => router.replace('/potrebe')} />
    </SafeAreaView>;
  }
  return <NovaPotrebaContent resumeId={resumeId} />;
}

function NovaPotrebaContent({ resumeId }: { resumeId?: string }) {
  const { model, state: flow } = useAiNeedFlow(resumeId);
  const stanje = flow.conversation;
  const razgovorId = flow.conversationId;
  const unos = flow.draft;
  const radi = !!flow.busy;
  const greska = flow.error;
  const setUnos = model.setDraft;
  const skrol = useRef<ScrollView>(null);
  const nazad = () => { if (model.isCurrent()) router.canGoBack() ? router.back() : router.replace('/potrebe'); };
  const posalji = () => { void model.send().then(() => {
    if (model.isCurrent()) requestAnimationFrame(() => skrol.current?.scrollToEnd({ animated: true }));
  }); };

  if (!stanje) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.ground, justifyContent: 'center', padding: space.xl }}>
        <Button label="Nazad na Zadatke" kind="quiet" onPress={nazad} />
        {greska ? (
          <View style={{ gap: space.base, alignItems: 'center' }}>
            <Warning size={30} color={palette.danger} weight="fill" />
            <T variant="body" tone="danger" style={{ textAlign: 'center' }}>{greska}</T>
            <Button label="Pokušajte ponovo" disabled={radi} onPress={() => void model.refresh()} />
          </View>
        ) : (
          <ActivityIndicator color={palette.teal500} />
        )}
      </SafeAreaView>
    );
  }

  const facts = sortFacts(stanje.facts);
  const confirmed = facts.filter((fact) => fact.status === 'CONFIRMED').length;
  const pending = facts.length - confirmed;
  const safetyCopy = safetyMessage(stanje.safety);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.ground }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={8}
      >
        <View style={{ paddingHorizontal: space.base }}>
          <Button label="Nazad" kind="quiet" onPress={nazad} />
        </View>
        <ScrollView ref={skrol} style={{ flex: 1 }} keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: space.base, gap: space.md, paddingBottom: space.xl }}>
        <View style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <T variant="label" tone="orange">NOVI ZADATAK</T>
              <T variant="title" balance>Recite šta Vam treba</T>
            </View>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.md,
                backgroundColor: palette.orangeSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkle size={22} color={palette.orangeInk} weight="fill" />
            </View>
          </View>

          <Card>
            <View style={{ padding: space.base, gap: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <View style={{ flex: 1 }}>
                  <T variant="label" tone="muted">NACRT UŽIVO</T>
                  <T variant="heading">
                    {facts.length ? `${confirmed} potvrđeno · ${pending} za pregled` : 'Popunjava se kroz razgovor'}
                  </T>
                </View>
                <CheckCircle
                  size={24}
                  color={stanje.review.canSaveDraft ? palette.success : palette.sage300}
                  weight={stanje.review.canSaveDraft ? 'fill' : 'regular'}
                />
              </View>

              {facts.length > 0 ? (
                <View style={{ gap: space.sm }}>
                  {facts.slice(0, 6).map((fact) => (
                    <View key={fact.id} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
                      <T variant="meta" tone="muted" style={{ width: 86 }}>{factLabel(fact.key)}</T>
                      <T variant="meta" style={{ flex: 1, fontWeight: '700' }} numberOfLines={1}>
                        {fact.displayValue}
                      </T>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: fact.status === 'CONFIRMED' ? palette.success : palette.orange,
                        }}
                      />
                    </View>
                  ))}
                  {facts.length > 6 ? (
                    <T variant="meta" tone="muted">+ još {facts.length - 6} podataka</T>
                  ) : null}
                </View>
              ) : (
                <T variant="meta" tone="muted">
                  Napišite zahtev prirodno. AI će izdvojiti podatke, ali Vi ih potvrđujete pre čuvanja.
                </T>
              )}

              <Button
                label="Pregledajte nacrt"
                meta={stanje.review.missingRequired.length ? `${stanje.review.missingRequired.length} obaveznih` : 'spreman za proveru'}
                full
                disabled={!flow.fresh || radi || !!flow.pendingTurn || !razgovorId || facts.length === 0}
                icon={<ArrowRight size={18} color={palette.onOrange} weight="bold" />}
                onPress={() => {
                  if (!model.isCurrent() || !flow.fresh || radi || flow.pendingTurn || !razgovorId) return;
                  router.push({ pathname: '/pregled-nacrta', params: { conversationId: razgovorId } });
                }}
              />
            </View>
          </Card>

          {safetyCopy ? (
            <View
              style={{
                flexDirection: 'row',
                gap: space.sm,
                alignItems: 'center',
                backgroundColor: stanje.safety === 'BLOCK' ? palette.dangerBg : palette.warnBg,
                padding: space.md,
                borderRadius: radius.md,
              }}
            >
              <ShieldCheck size={18} color={stanje.safety === 'BLOCK' ? palette.danger : palette.warn} weight="fill" />
              <T variant="meta" tone={stanje.safety === 'BLOCK' ? 'danger' : 'muted'} style={{ flex: 1 }}>
                {safetyCopy}
              </T>
            </View>
          ) : null}
        </View>

          {stanje.messages.length === 0 ? (
            <Animated.View
              entering={FadeInDown.duration(220)}
              style={{
                alignSelf: 'flex-start',
                maxWidth: '88%',
                backgroundColor: palette.surface,
                borderWidth: 1,
                borderColor: palette.line100,
                borderRadius: radius.lg,
                padding: space.base,
              }}
            >
              <T variant="body">Šta treba da se uradi? Možete napisati sve odjednom, kao da objašnjavate osobi.</T>
            </Animated.View>
          ) : null}

          {stanje.messages.map((message) => (
            <Animated.View
              key={message.id}
              entering={FadeInDown.duration(220)}
              style={{
                alignSelf: message.fromAi ? 'flex-start' : 'flex-end',
                maxWidth: '88%',
                backgroundColor: message.fromAi ? palette.surface : palette.forest800,
                borderWidth: message.fromAi ? 1 : 0,
                borderColor: palette.line100,
                borderRadius: radius.lg,
                paddingVertical: space.md,
                paddingHorizontal: space.base,
              }}
            >
              <T variant="body" tone={message.fromAi ? 'ink' : 'onDark'}>{message.body}</T>
            </Animated.View>
          ))}
          {radi ? <ActivityIndicator color={palette.teal500} style={{ alignSelf: 'flex-start' }} /> : null}

        {flow.pendingTurn && <View style={{ paddingHorizontal: space.base, gap: space.sm }}>
          <T variant="bodyStrong">{flow.busy === 'send' ? 'Slanje je u toku' : 'Slanje nije potvrđeno'}</T>
          <T selectable variant="meta">{flow.pendingTurn.body}</T>
          <T variant="meta" tone="muted">Tekst nije odbačen. Ne šaljemo ga ponovo bez provere. Možete ga označiti i kopirati pre izlaska.</T>
          <Button label="Proverite razgovor" disabled={radi} onPress={() => void model.refresh()} />
          {flow.pendingTurn.observed && flow.fresh && <>
            <T variant="meta">Ista poruka sada postoji u razgovoru. Pregledajte odgovor pre nastavka.</T>
            <Button label="Pregledao sam, nastavi" disabled={radi} onPress={model.acknowledgeObservedTurn} />
          </>}
        </View>}
        {!flow.pendingTurn && !flow.fresh && <View style={{ paddingHorizontal: space.base }}>
          <Button label="Osvežite nacrt" disabled={radi} onPress={() => void model.refresh()} />
        </View>}
        {greska ? (
          <View style={{ paddingHorizontal: space.base, paddingBottom: space.sm }}>
            <T variant="meta" tone="danger">{greska}</T>
          </View>
        ) : null}

        </ScrollView>
        <View
          style={{
            paddingHorizontal: space.base,
            paddingTop: space.sm,
            paddingBottom: space.md,
            backgroundColor: palette.surface,
            borderTopWidth: 1,
            borderTopColor: palette.line100,
            flexDirection: 'row',
            gap: space.sm,
            alignItems: 'flex-end',
          }}
        >
          <TextInput
            accessibilityLabel="Poruka za AI razgovor"
            value={unos}
            onChangeText={setUnos}
            editable={!radi && !flow.pendingTurn && stanje.safety !== 'BLOCK' && !stanje.review.boundNeedId}
            placeholder="Npr. treba mi prevoz frižidera sutra..."
            placeholderTextColor={palette.inkMuted}
            multiline
            maxLength={4000}
            style={{
              flex: 1,
              minHeight: touch.min,
              maxHeight: 112,
              borderWidth: 1,
              borderColor: palette.line100,
              backgroundColor: palette.raised,
              color: palette.ink,
              borderRadius: radius.md,
              paddingHorizontal: space.md,
              paddingVertical: 10,
              fontSize: 16,
              lineHeight: 22,
            }}
          />
          <Press
            accessibilityRole="button"
            accessibilityLabel="Pošalji poruku"
            accessibilityState={{ disabled: !unos.trim() || radi || !flow.fresh || !!flow.pendingTurn || !!stanje.review.boundNeedId || stanje.safety === 'BLOCK' }}
            disabled={!unos.trim() || radi || !flow.fresh || !!flow.pendingTurn || !!stanje.review.boundNeedId || stanje.safety === 'BLOCK'}
            haptic="light"
            onPress={posalji}
            style={{
              width: touch.min,
              height: touch.min,
              borderRadius: radius.md,
              backgroundColor: unos.trim() && !radi && flow.fresh && !flow.pendingTurn && !stanje.review.boundNeedId && stanje.safety !== 'BLOCK' ? palette.orange : palette.cream050,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PaperPlaneTilt size={20} color={palette.onOrange} weight="fill" />
          </Press>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
