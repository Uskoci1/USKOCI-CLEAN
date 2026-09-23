import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { CaretDown, CaretUp } from 'phosphor-react-native';
import { retentionPolicyClientService } from '../../../data/retentionPolicyClientService';
import { useFocusedResource } from '../../../hooks/useFocusedResource';
import { sesijaSada, useSesija } from '../../../store/sesija';

import { sys } from '../../../ui/system/tokens';
import { SettingsText as T, SettingsScreen, SettingsIntro, SettingsPanel, SettingsInfo, SettingsAction, settingsStyles as styles } from '../../../ui/settings/SettingsPresentation';
import { Press } from '../../../ui/Press';
import { ClosureEntry } from '../../../ui/closure/ClosureDialog';
import { FactArt } from '../../../ui/system/FactArt';

const labels: Readonly<Record<string, string>> = {
  ACCOUNT_IDENTITY: 'Nalog i identitet', PROFILE_DATA: 'Podaci profila', NEED_PUBLIC: 'Javni podaci Zadatka',
  NEED_SENSITIVE: 'Privatni podaci Zadatka', RESPONSES_SELECTION: 'Prijave i izbor', PRESELECTION_QA: 'Pitanja pre Dogovora',
  AGREEMENT_CORE: 'Dogovori', AGREEMENT_MESSAGES: 'Poruke u Dogovoru', LEGAL_CONSENT: 'Prihvatanje uslova',
  NOTIFICATION_DELIVERY: 'Obaveštenja', AI_VOLATILE: 'AI razgovori i izdvojeni podaci', MEDIA_OBJECTS: 'Fotografije i datoteke',
  COMMAND_LEDGERS: 'Potvrde radnji', AUDIT_SECURITY_LOGS: 'Evidencija aktivnosti i bezbednosti',
};

export default function Privatnost() {
  const { user, accountRevision } = useSesija();
  return <OwnedPrivacy key={`${user?.id ?? ''}:${accountRevision}`} />;
}

function OwnedPrivacy() {
  const { user, accountRevision } = useSesija(), accountId = user?.id;
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    const scope = {}; focus.current = scope; navigating.current = false; setExpandedRule(null);
    return () => { if (focus.current === scope) focus.current = null; };
  }, [accountId, accountRevision]));
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
  const publishedPolicy = policy.data?.ready ? policy.data : null;
  const admitted = policy.data?.ready === true && execution.data?.executionAdmitted === true
    && execution.data.policyVersion === policy.data.policyVersion;
  const renderedFocus = focus.current;
  const current = () => renderedFocus !== null && focus.current === renderedFocus && !navigating.current && !!accountId
    && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
  const navigate = (action: () => void) => { if (!current()) return; navigating.current = true; action(); };
  const refresh = () => { if (!current() || policy.loading || execution.loading) return;
    void policy.refresh(); void execution.refresh(); };
  return <SettingsScreen title="Privatnost i podaci"
    onBack={() => navigate(() => router.canGoBack() ? router.back() : router.replace('/profil'))}>
    <SettingsIntro>
      Podaci za saradnju imaju različitu vidljivost. Rokove čuvanja možeš pregledati ispod.
    </SettingsIntro>
    <SettingsPanel>
      <SettingsInfo title="Javni podaci Zadatka" icon={<FactArt kind="eye" size={26} />}>
        Opis objavljenog Zadatka i njegova približna lokacija dostupni su drugim korisnicima.
      </SettingsInfo>
      <SettingsInfo title="Lokacija i kontakt" last icon={<FactArt kind="pin" size={26} />}>
        Tačna privatna lokacija i kontakt dele se samo kada pravila saradnje daju pristup. Zadaci na daljinu nemaju adresu ni pin.
      </SettingsInfo>
    </SettingsPanel>
    <SettingsPanel soft>
      <SettingsInfo title="Izvoz mojih podataka" last icon={<FactArt kind="download" size={26} />}>
        Pogledaj zahtev, pripremu i dostupnost svoje kopije.
      </SettingsInfo>
      <SettingsAction label="Otvori izvoz" kind="secondary" onPress={() => navigate(() => router.navigate('/profil/izvoz'))} />
      <ClosureEntry />
    </SettingsPanel>

    <View style={{ marginTop: 20, gap: 12 }}>
      <T variant="heading" accessibilityRole="header">Rokovi čuvanja</T>
      {policy.loading ? <View accessibilityRole="progressbar" accessibilityLabel="Učitavamo rokove čuvanja" style={{ flexDirection: 'row', gap: 8 }}>
        <ActivityIndicator color={sys.color.green} /><T tone="muted">Učitavamo rokove čuvanja…</T>
      </View> : policy.error ? <T accessibilityRole="alert">Rokovi čuvanja trenutno nisu dostupni. Probaj ponovo.</T>
        : publishedPolicy ? <>
          <T variant="meta" tone="muted">Verzija: {publishedPolicy.policyVersion}</T>
          <SettingsPanel>
            {publishedPolicy.rules.map(rule => {
              const key = `${publishedPolicy.policyVersion}:${rule.dataClass}`, expanded = expandedRule === key;
              const title = labels[rule.dataClass] ?? rule.purpose;
              return <View key={key} style={{ borderBottomWidth: 1, borderBottomColor: sys.color.line }}>
                <Press accessibilityRole="button" accessibilityLabel={`Rokovi: ${title}`} accessibilityState={{ expanded }}
                  onPress={() => { if (current()) setExpandedRule(expanded ? null : key); }} haptic="select"
                  style={{ minHeight: 56, paddingVertical: 14, gap: 12, flexDirection: 'row', alignItems: 'center' }}>
                  <T variant="bodyStrong" style={{ flex: 1 }}>{title}</T>
                  {expanded ? <CaretUp size={18} color={sys.color.green} /> : <CaretDown size={18} color={sys.color.green} />}
                </Press>
                {expanded ? <View style={{ paddingBottom: 16, gap: 8 }}>
                  <T variant="meta">Svrha: {rule.purpose}</T>
                  <T variant="meta">Rok: {rule.retentionPeriod}</T>
                  <T variant="meta">Kada se briše: {rule.deletionTrigger}</T>
                  <T variant="meta">Izuzeci: {rule.exceptionRule}</T>
                  <T variant="meta">Pravni osnov: {rule.legalBasis}</T>
                </View> : null}
              </View>;
            })}
          </SettingsPanel>
        </> : <T tone="muted">Potpun raspored rokova čuvanja još nije dostupan.</T>}
      <View style={styles.notice}>
        <View style={{ flex: 1, gap: 8 }}>
          <T variant="bodyStrong">Automatsko brisanje napuštenih razgovora</T>
          {execution.loading ? <T tone="muted">Proveravamo dostupnost…</T>
            : execution.error || (execution.data?.executionAdmitted && !admitted) ? <T accessibilityRole="alert">Dostupnost automatskog brisanja nije potvrđena.</T>
              : admitted ? <T variant="meta" tone="muted">Automatsko brisanje je omogućeno samo za napuštene AI razgovore bez Zadatka i sačuvanih podataka. Primenjuju se objavljena pravila i izuzeci. Ovo nije potvrda da je određeni razgovor obrisan.</T>
                : <T variant="meta" tone="muted">Automatsko brisanje napuštenih AI razgovora trenutno nije dostupno.</T>}
        </View>
      </View>
      <SettingsAction label="Osveži stanje" kind="quiet" disabled={policy.loading || execution.loading} onPress={refresh} />
    </View>
  </SettingsScreen>;
}
