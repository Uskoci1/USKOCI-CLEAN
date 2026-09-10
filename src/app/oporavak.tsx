import { AuthIntro } from '../ui/auth/AuthPresentation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'expo-router';
import { passwordRecoveryIntent } from '../store/passwordRecoveryIntent';
import { ActivityIndicator, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'phosphor-react-native';
import { usePasswordRecovery } from '../hooks/usePasswordRecovery';
import { useSesija } from '../store/sesija';
import { AuthField, PrimaryButton } from '../ui/auth/AuthControls';
import { BuildIdentity } from '../ui/BuildIdentity';
import { palette, space, type } from '../theme/tokens';

export default function PasswordRecoveryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSesija();
  const intent = useSyncExternalStore(passwordRecoveryIntent.subscribe, passwordRecoveryIntent.snapshot, passwordRecoveryIntent.serverSnapshot);
  const link = intent?.link ?? null;
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [validation, setValidation] = useState<string | null>(null);
  const recovery = usePasswordRecovery(link, intent?.id ?? null);
  const busy = recovery.state.status === 'saving';
  const back = () => {
    if (intent) passwordRecoveryIntent.clear(intent.id);
    router.replace(user ? '/' : { pathname: '/auth', params: { form: 'login' } });
  };

  useEffect(() => {
    setPassword(''); setConfirmation(''); setValidation(null);
  }, [intent?.id]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!busy) back();
      return true;
    });
    return () => subscription.remove();
  }, [busy, router, user?.id]);

  useEffect(() => {
    if (recovery.state.status === 'success' || recovery.state.status === 'error') {
      setPassword(''); setConfirmation('');
    }
  }, [recovery.state.status]);

  async function save() {
    if (busy) return;
    if (password.length < 6) { setValidation('Lozinka mora imati najmanje 6 znakova.'); return; }
    if (password !== confirmation) { setValidation('Lozinke se ne poklapaju.'); return; }
    setValidation(null);
    await recovery.save(password);
  }

  const state = recovery.state;
  return <View style={[styles.screen, { paddingTop: insets.top }]}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Nazad" disabled={busy} onPress={back} style={styles.back}>
        <ArrowLeft size={22} color="#143D35" />
      </Pressable>
      <Text style={styles.headerLabel}>Oporavak naloga</Text>
    </View>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(32, insets.bottom + 24) }]}>
        <View style={styles.column}>
          <AuthIntro title={state.status === 'success' ? 'Lozinka je promenjena.' : 'Postavi novu lozinku.'}
            copy={state.status === 'success' ? 'Isti nalog. Tvoji Zadaci i Dogovori.' : 'Bezbedan povratak u isti USKOČI nalog.'} eyebrow="BEZBEDAN POVRATAK" />
          <View accessibilityLiveRegion="polite" style={styles.content}>
            {state.status === 'verifying' ? <>
              <ActivityIndicator accessibilityLabel="Provera linka" color={palette.ink} />
              <Text style={styles.copy}>Proveravamo link za oporavak…</Text>
            </> : null}
            {state.status === 'ready' || state.status === 'saving' ? <>
              <Text style={styles.copy}>Postavite novu lozinku za nalog:</Text>
              <Text selectable style={styles.email}>{state.identity.email}</Text>
              <AuthField label="Nova lozinka" value={password} onChangeText={value => { setPassword(value); setValidation(null); }}
                placeholder="Unesite novu lozinku" secure newPassword editable={!busy} />
              <AuthField label="Potvrdite novu lozinku" value={confirmation} onChangeText={value => { setConfirmation(value); setValidation(null); }}
                placeholder="Ponovite novu lozinku" secure newPassword editable={!busy} />
              <Text style={styles.note}>Ne menjaju se Vaši Zadaci, Prijave ni Dogovori. Posle promene prijavite se novom lozinkom.</Text>
              {validation || state.error ? <Text accessibilityRole="alert" style={styles.error}>{validation ?? state.error?.message}</Text> : null}
              <PrimaryButton title="Sačuvajte novu lozinku" onPress={() => void save()} busy={busy} />
            </> : null}
            {state.status === 'success' ? <>
              <Text style={styles.copy}>Možete da nastavite tamo gde ste stali. Za ulazak koristite novu lozinku.</Text>
              <PrimaryButton title="Prijavite se" onPress={back} />
            </> : null}
            {state.status === 'error' ? <>
              <Text accessibilityRole="alert" style={styles.error}>{state.error.message}</Text>
              {state.error.code === 'VERIFY_UNAVAILABLE' ? <PrimaryButton title="Pokušajte ponovo" onPress={recovery.retry} /> : null}
              {!user ? <PrimaryButton title="Zatražite novi link" onPress={() => router.replace({ pathname: '/auth', params: { form: 'recovery' } })} /> : null}
              <Pressable accessibilityRole="button" style={styles.link} onPress={back}>
                <Text style={styles.linkText}>{user ? 'Nazad u aplikaciju' : 'Nazad na prijavu'}</Text>
              </Pressable>
            </> : null}
          </View>
          <BuildIdentity />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FBFCFB' },
  flex: { flex: 1 },
  header: { width: '100%', maxWidth: 460, alignSelf: 'center', flexDirection: 'row', minHeight: 65, alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 9, paddingBottom: 12, backgroundColor: '#FAFCFB' },
  back: { width: 44, minHeight: 44, marginLeft: -8, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { flex: 1, color: '#143D35', textAlign: 'left', fontSize: 20, lineHeight: 23.2, letterSpacing: -.55, fontWeight: '700' },
  scroll: { flexGrow: 1, paddingHorizontal: 20, alignItems: 'center' },
  column: { width: '100%', maxWidth: 412 },
  content: { gap: space.base, padding: 18, borderWidth: 1, borderColor: '#D8E5DD', backgroundColor: '#FFFFFF', borderRadius: 22, marginTop: 6 },
  copy: { color: '#5D7067', fontSize: 15, lineHeight: 22.5 },
  email: { color: '#143D35', ...type.bodyStrong, marginBottom: space.sm },
  note: { color: '#5D7067', ...type.meta },
  error: { color: palette.danger, ...type.body },
  link: { minHeight: 48, justifyContent: 'center' },
  linkText: { color: '#143D35', ...type.action },
});
