import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { RetentionExecutionStatus, RetentionPolicyStatus, RetentionRule } from '../../contracts/retentionPolicy';
import { SettingsAction, SettingsGroup, SettingsInfo, SettingsIntro, SettingsText as T } from '../settings/SettingsPresentation';
import { Disclosure } from '../system/Disclosure';
import { FactArt } from '../system/FactArt';
import { StateView } from '../system/StateView';
import { inset, sys } from '../system/tokens';
import { InlineNote, PlainSection } from './InlineNote';

/** The person's names for the published data classes (owner's wording, kept verbatim). */
export const retentionLabels: Readonly<Record<string, string>> = {
  ACCOUNT_IDENTITY: 'Nalog i identitet', PROFILE_DATA: 'Podaci profila', NEED_PUBLIC: 'Javni podaci Zadatka',
  NEED_SENSITIVE: 'Privatni podaci Zadatka', RESPONSES_SELECTION: 'Prijave i izbor', PRESELECTION_QA: 'Pitanja pre Dogovora',
  AGREEMENT_CORE: 'Dogovori', AGREEMENT_MESSAGES: 'Poruke u Dogovoru', LEGAL_CONSENT: 'Prihvatanje uslova',
  NOTIFICATION_DELIVERY: 'Obaveštenja', AI_VOLATILE: 'AI razgovori i izdvojeni podaci', MEDIA_OBJECTS: 'Fotografije i datoteke',
  COMMAND_LEDGERS: 'Potvrde radnji', AUDIT_SECURITY_LOGS: 'Evidencija aktivnosti i bezbednosti',
};

/** The key a rule opens under: its policy version with it, so an opened rule never carries over to a new version. */
export const ruleKey = (policyVersion: string, rule: RetentionRule) => `${policyVersion}:${rule.dataClass}`;

export type PrivacyRead<T> = { loading: boolean; error: boolean; data: T | null };

/**
 * Privatnost i podaci, drawn from what the two readers hold (round 5, owner step 11b). Calm and in the order a person
 * asks: who sees what, how long each kind is kept, whether abandoned AI conversations are removed on their own, and,
 * last, the two rare account-data actions. It has no primary action: nothing here is done every day.
 *
 * Presentation only. The route owns the reads, the focus fence and every navigation; `dataRows` are its two rows.
 */
export function PrivacyBody({ policy, execution, admitted, expandedRule, onToggle, onRefresh, dataRows }: {
  policy: PrivacyRead<RetentionPolicyStatus>; execution: PrivacyRead<RetentionExecutionStatus>;
  /** Automatic deletion is admitted for the one published version both readers name. */ admitted: boolean;
  expandedRule: string | null; onToggle: (key: string, next: boolean) => void;
  onRefresh: () => void; dataRows: ReactNode;
}) {
  const published = policy.data?.ready ? policy.data : null;
  return <>
    <SettingsIntro>
      Podaci za saradnju imaju različitu vidljivost. Rokove čuvanja možeš pregledati ispod.
    </SettingsIntro>
    <SettingsGroup title="Vidljivost">
      <SettingsInfo title="Javni podaci Zadatka" icon={<FactArt kind="eye" size={26} />}>
        Opis objavljenog Zadatka i njegova približna lokacija dostupni su drugim korisnicima.
      </SettingsInfo>
      <SettingsInfo title="Lokacija i kontakt" last icon={<FactArt kind="pin" size={26} />}>
        Tačna privatna lokacija i kontakt dele se samo kada pravila saradnje daju pristup. Zadaci na daljinu nemaju adresu ni pin.
      </SettingsInfo>
    </SettingsGroup>

    {policy.loading ? <PlainSection title="Rokovi čuvanja">
      <StateView kind="loading" title="Učitavamo rokove čuvanja…" skeleton={{ count: 1, rows: 3 }} />
    </PlainSection> : policy.error ? <PlainSection title="Rokovi čuvanja">
      <InlineNote tone="danger">Rokovi čuvanja trenutno nisu dostupni. Probaj ponovo.</InlineNote>
    </PlainSection> : published ? <SettingsGroup title="Rokovi čuvanja">
      {published.rules.map((rule, index) => {
        const key = ruleKey(published.policyVersion, rule);
        return <Disclosure key={key} label={retentionLabels[rule.dataClass] ?? rule.purpose} divider={index > 0}
          expanded={expandedRule === key} onToggle={next => onToggle(key, next)}>
          <Fact label="Svrha" value={rule.purpose} />
          <Fact label="Rok" value={rule.retentionPeriod} />
          <Fact label="Kada se briše" value={rule.deletionTrigger} />
          <Fact label="Izuzeci" value={rule.exceptionRule} />
          <Fact label="Pravni osnov" value={rule.legalBasis} />
        </Disclosure>;
      })}
      {/* The version names the list it closes, so it sits under the last rule rather than floating a group's gap below. */}
      <View style={s.version}><T variant="note" tone="muted">{`Verzija: ${published.policyVersion}`}</T></View>
    </SettingsGroup> : <PlainSection title="Rokovi čuvanja">
      <InlineNote tone="quiet">Potpun raspored rokova čuvanja još nije dostupan.</InlineNote>
    </PlainSection>}

    {/* Not green: the line under it may say the feature is off or not confirmed, and green would read "all good". */}
    <View style={s.auto}>
      <FactArt kind="clock" size={22} />
      <View style={s.autoCopy}>
        <T variant="bodyStrong">Automatsko brisanje napuštenih razgovora</T>
        {execution.loading ? <T variant="note" tone="muted">Proveravamo dostupnost…</T>
          : execution.error || (execution.data?.executionAdmitted && !admitted)
            ? <T variant="note" accessibilityRole="alert">Dostupnost automatskog brisanja nije potvrđena.</T>
            : admitted ? <T variant="note" tone="muted">Automatsko brisanje je omogućeno samo za napuštene AI razgovore bez Zadatka i sačuvanih podataka. Primenjuju se objavljena pravila i izuzeci. Ovo nije potvrda da je određeni razgovor obrisan.</T>
              : <T variant="note" tone="muted">Automatsko brisanje napuštenih AI razgovora trenutno nije dostupno.</T>}
      </View>
    </View>
    <SettingsAction label="Osveži stanje" kind="quiet" disabled={policy.loading || execution.loading} onPress={onRefresh} />

    <View style={s.data}><SettingsGroup title="Tvoji podaci">{dataRows}</SettingsGroup></View>
  </>;
}

/** One published fact of a rule: the name above, the owner's text under it, in reading size (it was 13 px meta). */
function Fact({ label, value }: { label: string; value: string }) {
  return <View style={s.fact}>
    <T variant="note" tone="muted">{label}</T>
    <T selectable>{value}</T>
  </View>;
}

const s = StyleSheet.create({
  fact: { gap: 2 },
  version: { borderTopWidth: 1, borderTopColor: sys.color.line, paddingVertical: sys.space.md },
  auto: { ...inset, backgroundColor: sys.color.wash, flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  autoCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  // The rare account-data rows stand apart from the refresh above them, which belongs to the two blocks it re-reads.
  data: { marginTop: sys.space.sm },
});
