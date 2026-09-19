import type { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { ChatCircleText, ShieldCheck } from 'phosphor-react-native';
import { SettingsAction, SettingsPanel, SettingsScreen, SettingsText as T } from '../settings/SettingsPresentation';
import { sys } from '../system/tokens';

export const supportLabels = {
  RECEIVED: 'Zahtev je primljen', IN_REVIEW: 'U obradi', WAITING_FOR_AUTHOR: 'Čeka tvoju dopunu',
  DECIDED: 'Odgovor sa odlukom', CLOSED: 'Predmet je zatvoren',
  SERVICE: 'USKOČI podrška', TASK: 'Pomoć oko zadatka', LEGAL_PRIVACY: 'Sadržaj i privatnost', SAFETY: 'Privatna bezbednosna prijava',
  TECHNICAL: 'Tehnička pomoć', SERVICE_COMPLAINT: 'Reklamacija na USKOČI uslugu', OTHER: 'Drugo',
  COLLABORATION: 'Pomoć oko saradnje', NO_SHOW: 'Prijava nedolaska', PUBLICATION_REVIEW: 'Pregled odluke o objavi',
  CONTENT_NOTICE: 'Prijava sadržaja ili recenzije', PRIVACY_RIGHTS: 'Privatnost i prava', SAFETY_REPORT: 'Bezbednost',
  AUTHOR: 'Podnosilac', OPERATOR: 'Operater', SYSTEM: 'USKOČI',
  CREATED: 'Zahtev je primljen', CREATE: 'Zahtev je primljen', AUTHOR_REPLY: 'Dopuna zahteva',
  CLAIM: 'Predmet je preuzet', OPERATOR_REPLY: 'Odgovor operatera', REQUEST_INFO: 'Zahtev za dopunu',
  DECIDE: 'Odluka o zahtevu', APPEAL: 'Zahtev za ponovni pregled', CLAIM_APPEAL: 'Ponovni pregled je preuzet',
  DECIDE_APPEAL: 'Odluka posle ponovnog pregleda', CLOSE: 'Predmet je zatvoren',
  ACCEPTED: 'Zahtev je prihvaćen', REJECTED: 'Zahtev je odbijen',
} as const;
export const supportLabel = (value: string) => supportLabels[value as keyof typeof supportLabels] ?? 'Događaj u predmetu';
const timeFormat = new Intl.DateTimeFormat('sr-Latn-RS', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export function supportTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? timeFormat.format(date) : 'Vreme nije dostupno';
}
export function SupportFrame({ title, onBack, children, footer }: {
  title: string; onBack: () => void; children: ReactNode; footer?: ReactNode;
}) {
  return <KeyboardAvoidingView style={supportStyles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SettingsScreen title={title} onBack={onBack} footer={footer}>{children}</SettingsScreen>
  </KeyboardAvoidingView>;
}
export function SupportNotice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <SettingsPanel soft><T accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite"
    tone={error ? 'danger' : 'ink'}>{children}</T></SettingsPanel>;
}
export function SupportLoading() {
  return <View style={supportStyles.loading}><ActivityIndicator color={sys.color.green} accessibilityLabel="Učitavanje podrške" />
    <T tone="muted">Učitavamo sačuvano stanje…</T></View>;
}
export function SupportPrivacy({ safety = false }: { safety?: boolean }) {
  return <View style={supportStyles.privacy}><ShieldCheck size={22} color={sys.color.green} />
    <T variant="meta" tone="muted" style={supportStyles.grow}>{safety
      ? 'Ovaj predmet je privatan. Prijavljena osoba i grupa ne dobijaju sadržaj tvoje prijave.'
      : 'Zahtev vide podnosilac i posebno ovlašćeni operater. Sadržaj se ne prosleđuje drugoj strani u saradnji.'}</T></View>;
}
export function SupportEmpty({ children }: { children: ReactNode }) {
  return <View style={supportStyles.empty}><ChatCircleText size={32} color={sys.color.green} />
    <T style={supportStyles.center}>{children}</T></View>;
}
export function SupportField({ label, value, onChange, maximum, disabled = false, multiline = false, optional = false }: {
  label: string; value: string; onChange: (value: string) => void; maximum: number; disabled?: boolean; multiline?: boolean; optional?: boolean;
}) {
  const count = Array.from(value).length, invalid = count > maximum;
  return <View style={supportStyles.field}>
    <T variant="bodyStrong">{label}{optional ? ' (opciono)' : ''}</T>
    <TextInput accessibilityLabel={label} accessibilityHint={`Najviše ${maximum} znakova`} value={value}
      onChangeText={onChange} editable={!disabled} multiline={multiline} maxLength={maximum * 2}
      autoCapitalize="sentences" textAlignVertical={multiline ? 'top' : 'center'}
      style={[supportStyles.input, multiline && supportStyles.multiline, invalid && supportStyles.invalid]} />
    <T variant="meta" tone={invalid ? 'danger' : 'muted'} accessibilityLiveRegion={invalid ? 'polite' : 'none'}>
      {count} / {maximum}{invalid ? ' · Skrati tekst pre slanja.' : ''}
    </T>
  </View>;
}
export function SupportRecovery({ busy, absent, onRead, onCancel }: {
  busy: boolean; absent: boolean; onRead: () => void; onCancel: () => void;
}) {
  return <SettingsPanel soft>
    <T variant="heading">Najpre proveri prethodno slanje</T>
    <T>{absent ? 'Potvrda još nije pronađena. Prethodni zahtev i dalje može da stigne.'
      : 'Ishod prethodne radnje nije potvrđen. Novo slanje je zaustavljeno dok ne proveriš stanje.'}</T>
    <T variant="meta" tone="muted">Provera ne šalje ponovo tekst. Zaustavljanje važi samo za ovu radnju; ne briše ranije primljen predmet.</T>
    <SettingsAction label="Proveri ishod" disabled={busy} onPress={onRead} />
    <SettingsAction label="Zaustavi prethodno slanje" kind="quiet" disabled={busy} onPress={onCancel} />
  </SettingsPanel>;
}
export const supportStyles = StyleSheet.create({
  fill: { flex: 1 }, grow: { flex: 1, minWidth: 0 }, center: { textAlign: 'center' },
  loading: { paddingVertical: 32, gap: 12, alignItems: 'center' },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginVertical: 16 },
  empty: { paddingVertical: 32, paddingHorizontal: 16, alignItems: 'center', gap: 16 },
  field: { gap: 8, marginBottom: 20 },
  input: { minHeight: 52, borderWidth: 1, borderColor: sys.color.lineStrong, borderRadius: sys.radius.control,
    backgroundColor: sys.color.surface, ...sys.type.body, color: sys.color.ink, padding: 12 },
  multiline: { minHeight: 144 }, invalid: { borderColor: sys.color.danger },
  row: { gap: 6, paddingVertical: 16, borderBottomColor: sys.color.line, borderBottomWidth: 1 },
  status: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: sys.color.greenSoft, borderRadius: sys.radius.chip },
  gap: { gap: 12 }, actions: { gap: 12, marginVertical: 16 },
  event: { paddingLeft: 16, paddingVertical: 12, borderLeftColor: sys.color.lineStrong, borderLeftWidth: 2, gap: 8 },
});
