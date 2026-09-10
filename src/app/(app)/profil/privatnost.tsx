import { useCallback, useRef } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Eye, MapPin, DownloadSimple } from 'phosphor-react-native';
import { retentionPolicyClientService } from '../../../data/retentionPolicyClientService';
import { useFocusedResource } from '../../../hooks/useFocusedResource';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { ulogaSada, useUloga } from '../../../store/uloga';
import { palette, space, touch } from '../../../theme/tokens';
import { Button, Card } from '../../../ui/Button';
import { Press } from '../../../ui/Press';
import { T } from '../../../ui/Text';

const labels: Readonly<Record<string, string>> = {
  ACCOUNT_IDENTITY: 'Nalog i identitet', PROFILE_DATA: 'Podaci profila', NEED_PUBLIC: 'Javni podaci Zadatka',
  NEED_SENSITIVE: 'Privatni podaci Zadatka', RESPONSES_SELECTION: 'Prijave i izbor', PRESELECTION_QA: 'Pitanja pre Dogovora',
  AGREEMENT_CORE: 'Dogovori', AGREEMENT_MESSAGES: 'Poruke u Dogovoru', LEGAL_CONSENT: 'Prihvatanje uslova',
  NOTIFICATION_DELIVERY: 'Obaveštenja', AI_VOLATILE: 'AI razgovori i izdvojeni podaci', MEDIA_OBJECTS: 'Fotografije i datoteke',
  COMMAND_LEDGERS: 'Potvrde radnji', AUDIT_SECURITY_LOGS: 'Evidencija aktivnosti i bezbednosti',
};

export default function Privatnost() {
  const { user, accountRevision } = useSesija(), intent = useUloga();
  return <OwnedPrivacy key={`${user?.id ?? ''}:${accountRevision}:${intent}`} />;
}

function OwnedPrivacy() {
  const { user, accountRevision } = useSesija(), accountId = user?.id, intent = useUloga();
  const focus = useRef<object | null>(null), navigating = useRef(false);
  useFocusEffect(useCallback(() => {
    const scope = {}; focus.current = scope; navigating.current = false;
    return () => { if (focus.current === scope) focus.current = null; };
  }, [accountId, accountRevision, intent]));
  const readPolicy = useCallback(async () => {
    const result = await retentionPolicyClientService.readStatus();
    if (!result.ok) throw new Error('RETENTION_READ_UNAVAILABLE');
    return result.podatak;
  }, []);
  const readExecution = useCallback(async () => {
    const result = await retentionPolicyClientService.readExecutionStatus();
    if (!result.ok) throw new Error('RETENTION_EXECUTION_UNAVAILABLE');
    return result.podatak;
  }, []);
  const policy = useFocusedResource(readPolicy), execution = useFocusedResource(readExecution);
  const admitted = policy.data?.ready === true && execution.data?.executionAdmitted === true
    && execution.data.policyVersion === policy.data.policyVersion;
  const renderedFocus = focus.current;
  const current = () => renderedFocus !== null && focus.current === renderedFocus && !navigating.current && !!accountId
    && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision && ulogaSada() === intent;
  const navigate = (action: () => void) => { if (!current()) return; navigating.current = true; action(); };
  const refresh = () => { if (!current() || policy.loading || execution.loading) return;
    void policy.refresh(); void execution.refresh(); };
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.ground }}>
    <ScrollView contentContainerStyle={{ padding: space.base, paddingBottom: space.xxl, gap: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Press accessibilityRole="button" accessibilityLabel="Nazad"
          onPress={() => navigate(() => router.canGoBack() ? router.back() : router.replace('/profil'))}
          style={{ width: touch.min, height: touch.min, alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={24} color={palette.ink} />
        </Press>
        <T variant="title" style={{ flex: 1 }}>Privatnost i podaci</T>
      </View>

      <View style={{ gap: space.sm }}>
        <T variant="label" tone="muted">KONTROLA PODATAKA</T>
        <T variant="heading">Šta je javno, šta je privatno, šta je tvoje.</T>
        <T tone="muted">Podaci za saradnju imaju različitu vidljivost. Rokove čuvanja možete pregledati ispod.</T>
      </View>
      <View style={{ gap: space.base }}>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Eye size={22} color={palette.teal500} />
          <View style={{ flex: 1, gap: space.xs }}>
            <T variant="bodyStrong">Javni podaci Zadatka</T>
            <T variant="meta" tone="muted">Opis objavljenog Zadatka i njegova približna lokacija dostupni su drugim korisnicima.</T>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <MapPin size={22} color={palette.teal500} />
          <View style={{ flex: 1, gap: space.xs }}>
            <T variant="bodyStrong">Lokacija i kontakt</T>
            <T variant="meta" tone="muted">Tačna privatna lokacija i kontakt dele se samo kada pravila saradnje daju pristup. Zadaci na daljinu nemaju adresu ni pin.</T>
          </View>
        </View>
      </View>

      <Card><View style={{ padding: space.base, gap: space.md }}>
        <T variant="bodyStrong">Izvoz mojih podataka</T>
        <T variant="meta" tone="muted">Pregledajte zahtev, pripremu i dostupnost svoje kopije.</T>
        <Button label="Otvorite izvoz" kind="secondary" icon={<DownloadSimple size={20} color={palette.ink} />}
          onPress={() => navigate(() => router.navigate('/profil/izvoz'))} />
        <T variant="bodyStrong">Zatvaranje naloga</T>
        <T variant="meta" tone="muted">Zatvaranje naloga trenutno nije dostupno u aplikaciji.</T>
      </View></Card>

      <View style={{ gap: space.md }}>
        <T variant="heading">Rokovi čuvanja</T>
        {policy.loading ? <View accessibilityRole="progressbar" accessibilityLabel="Učitavamo rokove čuvanja" style={{ flexDirection: 'row', gap: space.sm }}>
          <ActivityIndicator color={palette.ink} /><T tone="muted">Učitavamo rokove čuvanja…</T>
        </View> : policy.error ? <T accessibilityRole="alert">Rokovi čuvanja trenutno nisu dostupni. Pokušajte ponovo.</T>
          : policy.data?.ready ? <>
            <T variant="meta" tone="muted">Verzija: {policy.data.policyVersion}</T>
            {policy.data.rules.map(rule => <Card key={rule.dataClass}><View style={{ padding: space.base, gap: space.sm }}>
              <T variant="bodyStrong">{labels[rule.dataClass] ?? rule.purpose}</T>
              <T variant="meta">Svrha: {rule.purpose}</T>
              <T variant="meta">Rok: {rule.retentionPeriod}</T>
              <T variant="meta">Kada se briše: {rule.deletionTrigger}</T>
              <T variant="meta">Izuzeci: {rule.exceptionRule}</T>
              <T variant="meta">Pravni osnov: {rule.legalBasis}</T>
            </View></Card>)}
          </> : <T tone="muted">Potpun raspored rokova čuvanja još nije dostupan.</T>}
        <T variant="bodyStrong">Automatsko brisanje napuštenih razgovora</T>
        {execution.loading ? <T tone="muted">Proveravamo dostupnost…</T>
          : execution.error || (execution.data?.executionAdmitted && !admitted) ? <T accessibilityRole="alert">Dostupnost automatskog brisanja nije potvrđena.</T>
            : admitted ? <T variant="meta" tone="muted">Automatsko brisanje je omogućeno samo za napuštene AI razgovore bez Zadatka i sačuvanih podataka. Primenjuju se objavljena pravila i izuzeci. Ovo nije potvrda da je određeni razgovor obrisan.</T>
              : <T variant="meta" tone="muted">Automatsko brisanje napuštenih AI razgovora trenutno nije dostupno.</T>}
        <Button label="Osvežite stanje" kind="quiet" disabled={policy.loading || execution.loading} onPress={refresh} />
      </View>
    </ScrollView>
  </SafeAreaView>;
}
