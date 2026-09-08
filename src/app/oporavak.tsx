import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { ActivityIndicator, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, CheckCircle, LockKey } from 'phosphor-react-native';
import { usePasswordRecovery } from '../hooks/usePasswordRecovery';
import { useSesija } from '../store/sesija';
import { AuthField, PrimaryButton } from '../ui/auth/AuthControls';
import { palette, radius, space, type } from '../theme/tokens';

export default function PasswordRecoveryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSesija();
  const incoming = Linking.useLinkingURL();
  const [link, setLink] = useState(incoming);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [validation, setValidation] = useState<string | null>(null);
  const recovery = usePasswordRecovery(link);
  const busy = recovery.state.status === 'saving';
  const back = () => router.replace(user ? '/' : { pathname: '/auth', params: { form: 'login' } });

  useEffect(() => {
    if (!incoming) return;
    if (incoming !== link) { setPassword(''); setConfirmation(''); setValidation(null); }
    setLink(incoming);
    // Expo Router preserves a URL fragment as the '#' navigation parameter.
    // Clear that owner as well as browser history, otherwise router hydration
    // restores the credential fragment after a direct history.replaceState.
    router.setParams({ '#': undefined });
    // Credentials are read only through Linking and kept in this transient flow.
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.location.pathname === '/oporavak') {
        window.history.replaceState(window.history.state, '', '/oporavak');
      }
    } else Linking.clearInitialURL();
  }, [incoming]);

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
        <ArrowLeft size={22} color={palette.ink} />
      </Pressable>
      <Text style={styles.headerLabel}>Oporavak naloga</Text><View style={styles.back} />
    </View>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(32, insets.bottom + 24) }]}>
        <View style={styles.column}>
          <View style={styles.icon}>{state.status === 'success'
            ? <CheckCircle size={30} color={palette.success} />
            : <LockKey size={28} color={palette.ink} />}</View>
          <Text accessibilityRole="header" style={styles.title}>{state.status === 'success' ? 'Lozinka je\npromenjena.' : 'Nova lozinka.\nIsti USKOČI nalog.'}</Text>
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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8F5' },
  flex: { flex: 1 },
  header: { width: '100%', maxWidth: 460, alignSelf: 'center', flexDirection: 'row', minHeight: 68, alignItems: 'center', paddingHorizontal: space.md },
  back: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { flex: 1, color: palette.ink, textAlign: 'center', ...type.meta },
  scroll: { flexGrow: 1, padding: space.xl, alignItems: 'center' },
  column: { width: '100%', maxWidth: 412, gap: space.xl },
  icon: { width: 64, height: 64, borderRadius: radius.xl, backgroundColor: '#E4EDE8', alignItems: 'center', justifyContent: 'center' },
  title: { color: palette.ink, fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.7 },
  content: { gap: space.base },
  copy: { color: palette.inkMuted, ...type.body },
  email: { color: palette.ink, ...type.bodyStrong, marginBottom: space.sm },
  note: { color: palette.inkMuted, ...type.meta },
  error: { color: palette.danger, ...type.body },
  link: { minHeight: 48, justifyContent: 'center' },
  linkText: { color: palette.ink, ...type.action },
});
