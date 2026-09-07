import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  LockKey,
  MapPin,
  Phone,
  User,
} from 'phosphor-react-native';

import { authClientService } from '../data/authClientService';
import { useAuthAvailability } from '../hooks/useAuthAvailability';
import { useAuthFormCommand } from '../hooks/useAuthFormCommand';
import { EntryWelcome } from '../ui/entry/EntryWelcome';
import { entryIntentClientService } from '../data/entryIntentClientService';

type Rezim = 'LOGIN' | 'SIGNUP';
type Faza = 'EMAIL' | 'PHONE' | 'OTP' | 'RECOVERY_UNAVAILABLE' | 'SIGNUP_NEXT_STEP';

function AuthField({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
  autoCapitalize = 'none',
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon?: React.ReactNode;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
}) {
  const [vidljivo, setVidljivo] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText}
          editable={editable} autoCapitalize={autoCapitalize} autoCorrect={false}
          keyboardType={keyboardType} placeholder={placeholder} placeholderTextColor="#73847E"
          secureTextEntry={secure && !vidljivo} style={styles.fieldInput}
          autoComplete={keyboardType === 'email-address' ? 'email' : secure ? 'password' : 'off'}
        />
        {secure ? <Pressable accessibilityRole="button" disabled={!editable}
          accessibilityLabel={vidljivo ? 'Sakrij lozinku' : 'Prikaži lozinku'}
          onPress={() => setVidljivo(x => !x)} style={styles.passToggle}>
          {vidljivo ? <EyeSlash size={21} color="#5D6E6D" /> : <Eye size={21} color="#5D6E6D" />}
        </Pressable> : null}
      </View>
    </View>
  );
}

function PrimaryButton({
  title,
  onPress,
  busy,
  disabled,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        (disabled || busy) && styles.disabled,
        pressed && !disabled && !busy && styles.primaryPressed,
      ]}
    >
      {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{title}</Text>}
    </Pressable>
  );
}

function MethodButton({
  title,
  icon,
  onPress,
  disabled,
}: {
  title: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.method, pressed && styles.methodPressed]}
    >
      <View style={styles.methodIcon}>{icon}</View>
      <Text style={styles.methodText}>{title}</Text>
    </Pressable>
  );
}

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ form?: string }>();
  const [otvoren, setOtvoren] = useState(params.form === 'login');
  const [rezim, setRezim] = useState<Rezim>('LOGIN');
  const [faza, setFaza] = useState<Faza>('EMAIL');

  const [ime, setIme] = useState('');
  const [prezime, setPrezime] = useState('');
  const [grad, setGrad] = useState('');
  const [email, setEmail] = useState('');
  const [lozinka, setLozinka] = useState('');
  const [potvrda, setPotvrda] = useState('');
  const [telefon, setTelefon] = useState('');
  const [otp, setOtp] = useState('');
  const [saglasnost, setSaglasnost] = useState(false);
  const [confirmationRequired, setConfirmationRequired] = useState(true);

  const commands = useAuthFormCommand();
  const radi = commands.busy;
  const availability = useAuthAvailability(otvoren);
  const methods = availability.status === 'ready' ? availability.data : null;
  const [greska, setGreska] = useState<string | null>(null);
  const [poruka, setPoruka] = useState<string | null>(null);

  useEffect(() => {
    if (!otvoren) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      commands.changeForm(() => {
        if (faza !== 'EMAIL' || rezim !== 'LOGIN') { setFaza('EMAIL'); setRezim('LOGIN'); }
        else setOtvoren(false);
        setGreska(null); setPoruka(null);
      });
      return true;
    });
    return () => subscription.remove();
  }, [commands.changeForm, otvoren, faza, rezim]);

  function otvori(mode: Rezim = 'LOGIN') {
    commands.changeForm(() => {
      setRezim(mode);
      setFaza('EMAIL');
      setGreska(null);
      setPoruka(null);
      setOtvoren(true);
    });
  }

  function nazadNaEmail() {
    commands.changeForm(() => {
      setRezim('LOGIN');
      setFaza('EMAIL');
      setGreska(null);
      setPoruka(null);
    });
  }

  function prijaviGresku(error: unknown) {
    setGreska(error instanceof Error ? error.message : 'Zahtev trenutno nije uspeo. Pokušajte ponovo.');
  }

  async function izaberiNameru(intent: 'REQUESTER' | 'WORKER') {
    await commands.run(() => entryIntentClientService.prepare(intent), () => {
      setRezim('LOGIN'); setFaza('EMAIL'); setGreska(null); setPoruka(null); setOtvoren(true);
    }, () => setGreska('Izbor nije sačuvan. Pokušajte ponovo.'));
  }

  async function emailAkcija() {
    const ready = availability.current();
    if (!ready || !(rezim === 'SIGNUP' ? ready.emailSignup : ready.emailPassword)) return;
    await commands.run(async () => {
      setGreska(null);
      setPoruka(null);
      if (!email.trim() || !lozinka) throw new Error('Unesite email i lozinku.');
      if (rezim === 'LOGIN') {
        await authClientService.signInWithPassword({ email: email.trim(), password: lozinka });
        return true;
      }
      if (!ime.trim() || !prezime.trim() || !grad.trim()) throw new Error('Unesite ime, prezime i grad.');
      if (lozinka.length < 6) throw new Error('Lozinka mora imati najmanje 6 znakova.');
      if (lozinka !== potvrda) throw new Error('Lozinke se ne poklapaju.');
      if (!saglasnost) throw new Error('Potrebno je prihvatiti Uslove korišćenja i Politiku privatnosti.');
      const result = await authClientService.signUp({
        email: email.trim(), password: lozinka,
        firstName: ime.trim(), lastName: prezime.trim(), city: grad.trim(),
      });
      return result.hasSession;
    }, hasSession => {
      if (!hasSession) {
        setLozinka('');
        setPotvrda('');
        setConfirmationRequired(ready.emailConfirmationRequired);
        setFaza('SIGNUP_NEXT_STEP');
      }
    }, prijaviGresku);
  }

  async function posaljiTelefon() {
    if (!availability.current()?.phoneOtp) return;
    await commands.run(async () => {
      setGreska(null);
      setPoruka(null);
      await authClientService.sendPhoneOtp({ phone: telefon.trim() });
    }, () => {
      setFaza('OTP');
      setPoruka('Zahtev za kod je prihvaćen.');
    }, prijaviGresku);
  }

  async function potvrdiOtp() {
    if (!availability.current()?.phoneOtp) return;
    await commands.run(async () => {
      setGreska(null);
      await authClientService.verifyPhoneOtp({ phone: telefon.trim(), token: otp.trim() });
    }, () => {}, prijaviGresku);
  }

  const naslov =
    faza === 'PHONE'
      ? rezim === 'SIGNUP' ? 'Napravite nalog telefonom' : 'Prijavite se telefonom'
      : faza === 'OTP'
        ? 'Unesite kod'
        : faza === 'RECOVERY_UNAVAILABLE'
          ? 'Oporavak lozinke'
          : faza === 'SIGNUP_NEXT_STEP'
            ? confirmationRequired ? 'Proverite email' : 'Nastavite prijavu'
            : rezim === 'SIGNUP'
              ? 'Napravite nalog'
              : 'Prijavite se emailom';

  const podnaslov =
    faza === 'PHONE'
      ? 'Unesite broj telefona.'
      : faza === 'OTP'
        ? 'Unesite kod kada stigne na Vaš broj.'
        : faza === 'RECOVERY_UNAVAILABLE'
          ? 'Ova mogućnost još nije dostupna u aplikaciji.'
          : faza === 'SIGNUP_NEXT_STEP'
            ? confirmationRequired ? 'Pratite uputstvo za potvrdu registracije.' : 'Vratite se na prijavu.'
            : rezim === 'SIGNUP'
              ? 'Unesite osnovne podatke za nalog.'
              : 'Unesite email i lozinku.';

  if (!otvoren) return <EntryWelcome onRequester={() => void izaberiNameru('REQUESTER')}
    onWorker={() => void izaberiNameru('WORKER')} onSignIn={() => otvori('LOGIN')} busy={radi} error={greska} />;
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Nazad" disabled={radi}
          onPress={() => commands.changeForm(() => {
            if (faza !== 'EMAIL' || rezim !== 'LOGIN') { setFaza('EMAIL'); setRezim('LOGIN'); }
            else setOtvoren(false);
            setGreska(null); setPoruka(null);
          })} style={styles.backButton}><ArrowLeft size={22} color="#142F30" /></Pressable>
        <Text style={styles.headerTitle}>{rezim === 'SIGNUP' ? 'Registracija' : 'Prijava'}</Text>
        <View style={{ width: 48 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.sheetScroll, { paddingBottom: Math.max(28, insets.bottom + 16) }]}>
          <View style={styles.formColumn}>
            <View style={styles.authHead}>
              <Text accessibilityRole="header" style={styles.authTitle}>{faza === 'EMAIL' && rezim === 'LOGIN' ? 'Drago nam je\nšto ste tu.' : naslov}</Text>
              <Text style={styles.authSubtitle}>{faza === 'EMAIL' && rezim === 'LOGIN' ? 'Prijavite se da nastavite.' : podnaslov}</Text>
            </View>


            {faza === 'EMAIL' && methods?.emailPassword && methods.emailSignup ? <View style={styles.tabs}>
              {(['LOGIN', 'SIGNUP'] as const).map(mode => <Pressable key={mode} accessibilityRole="tab"
                accessibilityState={{ selected: rezim === mode, disabled: radi }} disabled={radi}
                onPress={() => commands.changeForm(() => { setRezim(mode); setGreska(null); setPoruka(null); })}
                style={[styles.tab, rezim === mode && styles.selectedTab]}>
                <Text style={styles.tabLabel}>{mode === 'LOGIN' ? 'Prijava' : 'Registracija'}</Text>
              </Pressable>)}
            </View> : null}
            {poruka ? <View style={[styles.banner, styles.bannerOk]}><Text style={styles.bannerOkText}>{poruka}</Text></View> : null}

            {availability.status === 'loading' ? (
              <View accessibilityRole="progressbar" style={styles.form}>
                <ActivityIndicator color="#5D6E6D" />
                <Text style={styles.stateCopy}>Proveravamo dostupne načine prijave…</Text>
              </View>
            ) : availability.status === 'error' ? (
              <View style={styles.form}>
                <Text style={styles.stateCopy}>Ne možemo da proverimo dostupne načine prijave. Proverite vezu i pokušajte ponovo.</Text>
                <PrimaryButton title="Pokušajte ponovo" busy={radi} onPress={() => void availability.retry()} />
              </View>
            ) : null}

            {faza === 'EMAIL' && methods ? (
              <>
                {methods.emailPassword ? <View style={styles.form}>
                  {rezim === 'SIGNUP' && methods.emailSignup ? (
                    <>
                      <AuthField
                        label="Ime"
                        value={ime}
                        onChangeText={(value) => commands.changeForm(() => setIme(value))}
                        editable={!radi}
                        autoCapitalize="words"
                        placeholder="Ime"
                        icon={<User size={21} color="#5D6E6D" />}
                      />
                      <AuthField
                        label="Prezime"
                        value={prezime}
                        onChangeText={(value) => commands.changeForm(() => setPrezime(value))}
                        editable={!radi}
                        autoCapitalize="words"
                        placeholder="Prezime"
                        icon={<User size={21} color="#5D6E6D" />}
                      />
                      <AuthField
                        label="Grad"
                        value={grad}
                        onChangeText={(value) => commands.changeForm(() => setGrad(value))}
                        editable={!radi}
                        autoCapitalize="words"
                        placeholder="Vaš grad"
                        icon={<MapPin size={21} color="#5D6E6D" />}
                      />
                    </>
                  ) : null}

                  <AuthField
                    label="Email"
                    value={email}
                    onChangeText={(value) => commands.changeForm(() => setEmail(value))}
                    editable={!radi}
                    keyboardType="email-address"
                    placeholder="ime@primer.rs"
                    icon={<EnvelopeSimple size={21} color="#5D6E6D" />}
                  />
                  <AuthField
                    label="Lozinka"
                    value={lozinka}
                    onChangeText={(value) => commands.changeForm(() => setLozinka(value))}
                    editable={!radi}
                    placeholder="Unesite lozinku"
                    secure
                    icon={<LockKey size={21} color="#5D6E6D" />}
                  />

                  {rezim === 'SIGNUP' && methods.emailSignup ? (
                    <>
                      <AuthField
                        label="Potvrdite lozinku"
                        value={potvrda}
                        onChangeText={(value) => commands.changeForm(() => setPotvrda(value))}
                        editable={!radi}
                        placeholder="Ponovite lozinku"
                        secure
                        icon={<LockKey size={21} color="#5D6E6D" />}
                      />
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: saglasnost }}
                        disabled={radi}
                        onPress={() => commands.changeForm(() => setSaglasnost((x) => !x))}
                        style={styles.consent}
                      >
                        <View style={[styles.checkbox, saglasnost && styles.checkboxChecked]}>
                          {saglasnost ? <Text style={styles.checkmark}>✓</Text> : null}
                        </View>
                        <Text style={styles.consentText}>
                          Prihvatam <Text style={styles.legalLink}>Uslove korišćenja</Text> i potvrđujem da sam pročitao/la <Text style={styles.legalLink}>Politiku privatnosti</Text>.
                        </Text>
                      </Pressable>
                    </>
                  ) : null}

                  <PrimaryButton
                    title={rezim === 'SIGNUP' ? 'Napravite nalog' : 'Prijavite se'}
                    disabled={rezim === 'SIGNUP' && !methods.emailSignup}
                    onPress={() => void emailAkcija()}
                    busy={radi}
                  />
                  <View style={styles.feedback} accessibilityLiveRegion="polite">
                    {greska ? <Text accessibilityRole="alert" style={styles.bannerErrorText}>{greska}</Text> : null}
                  </View>

                  {rezim === 'LOGIN' ? (
                    <Pressable accessibilityRole="button" disabled={radi} onPress={() => commands.changeForm(() => { setFaza('RECOVERY_UNAVAILABLE'); setGreska(null); setPoruka(null); })} style={styles.forgot}>
                      <Text style={styles.forgotText}>Zaboravili ste lozinku?</Text>
                    </Pressable>
                  ) : null}
                </View> : <Text style={styles.stateCopy}>Prijava emailom trenutno nije dostupna.</Text>}



                {methods.emailPassword && !methods.emailSignup ? (
                  <Text style={styles.smallNote}>Otvaranje novih naloga trenutno nije dostupno.</Text>
                ) : null}
                {rezim === 'SIGNUP' && !methods.emailSignup ? (
                  <PrimaryButton title="Nazad na prijavu" onPress={nazadNaEmail} busy={radi} />
                ) : null}
                {rezim === 'SIGNUP' && methods.emailSignup && methods.emailConfirmationRequired ? (
                  <Text style={styles.smallNote}>Pre prve prijave potrebno je da potvrdite email.</Text>
                ) : null}
                {methods.phoneOtp ? <View style={styles.methods}>
                  <MethodButton
                    title="Telefon"
                    icon={<Phone size={23} color="#174B43" />}
                    disabled={radi}
                    onPress={() => commands.changeForm(() => { setFaza('PHONE'); setGreska(null); setPoruka(null); })}
                  />
                </View> : null}


              </>
            ) : null}

            {faza === 'PHONE' && methods?.phoneOtp ? (
              <View style={styles.form}>
                <Pressable disabled={radi} onPress={nazadNaEmail} style={styles.backRow}>
                  <ArrowLeft size={16} color="#5D6E6D" />
                  <Text style={styles.backText}>Nazad na prijavu</Text>
                </Pressable>
                <AuthField
                  label="Broj telefona"
                  value={telefon}
                  onChangeText={(value) => commands.changeForm(() => setTelefon(value))}
                  editable={!radi}
                  keyboardType="phone-pad"
                  placeholder="+381 6x xxx xxxx"
                  icon={<Phone size={21} color="#5D6E6D" />}
                />
                <Text style={styles.smallNote}>Poslaćemo Vam jednokratni kod.</Text>
                <PrimaryButton title="Pošaljite kod" onPress={() => void posaljiTelefon()} busy={radi} />
              </View>
            ) : null}

            {faza === 'OTP' && methods?.phoneOtp ? (
              <View style={styles.form}>
                <Pressable disabled={radi} onPress={() => commands.changeForm(() => setFaza('PHONE'))} style={styles.backRow}>
                  <ArrowLeft size={16} color="#5D6E6D" />
                  <Text style={styles.backText}>Promenite broj</Text>
                </Pressable>
                <View style={styles.stateIcon}><Phone size={28} color="#5D6E6D" /></View>
                <Text style={styles.stateTitle}>Unesite kod</Text>
                <Text style={styles.stateCopy}>Unesite primljeni kod. Ako ne stigne, možete zatražiti novi.</Text>
                <AuthField
                  label="Kod"
                  value={otp}
                  onChangeText={(value) => commands.changeForm(() => setOtp(value))}
                  editable={!radi}
                  keyboardType="number-pad"
                  placeholder="123456"
                  icon={<LockKey size={21} color="#5D6E6D" />}
                />
                <PrimaryButton title="Potvrdite kod" onPress={() => void potvrdiOtp()} busy={radi} />
                <Pressable disabled={radi} onPress={() => void posaljiTelefon()} style={styles.linkButton}>
                  <Text style={styles.linkText}>Pošaljite novi kod</Text>
                </Pressable>
              </View>
            ) : null}

            {(faza === 'PHONE' || faza === 'OTP') && methods && !methods.phoneOtp ? (
              <View style={styles.form}>
                <Text style={styles.stateCopy}>Prijava telefonom trenutno nije dostupna.</Text>
                <PrimaryButton title="Nazad na prijavu" onPress={nazadNaEmail} busy={radi} />
              </View>
            ) : null}

            {faza === 'RECOVERY_UNAVAILABLE' ? (
              <View style={styles.form}>
                <View style={styles.stateIcon}><LockKey size={28} color="#5D6E6D" /></View>
                <Text style={styles.stateCopy}>Oporavak lozinke još nije dostupan u aplikaciji. Možete se vratiti na prijavu.</Text>
                <PrimaryButton title="Nazad na prijavu" onPress={nazadNaEmail} />
              </View>
            ) : null}

            {faza === 'SIGNUP_NEXT_STEP' ? (
              <View style={styles.form}>
                <View style={styles.stateIcon}><EnvelopeSimple size={28} color="#5D6E6D" /></View>
                <Text style={styles.stateTitle}>{confirmationRequired ? 'Proverite email' : 'Nastavite prijavu'}</Text>
                <Text style={styles.stateCopy}>{confirmationRequired
                  ? 'Ako je registracija prihvaćena, dobićete poruku sa daljim uputstvom. Posle potvrde emaila vratite se na prijavu.'
                  : 'Nalog još nije prijavljen. Vratite se na prijavu. Ako ste dobili poruku za potvrdu emaila, prvo pratite njeno uputstvo.'}</Text>
                <PrimaryButton title="Nazad na prijavu" onPress={nazadNaEmail} busy={radi} />
                <Pressable disabled={radi} onPress={() => commands.changeForm(() => {
                  setRezim('SIGNUP'); setFaza('EMAIL'); setGreska(null); setPoruka(null);
                })} style={styles.linkButton}>
                  <Text style={styles.linkText}>Izmenite email</Text>
                </Pressable>
              </View>
            ) : null}
            {faza !== 'EMAIL' && greska ? <Text accessibilityRole="alert" style={styles.bannerErrorText}>{greska}</Text> : null}
            {faza === 'EMAIL' && rezim === 'LOGIN' ? <View style={styles.notice}>
              <Text style={styles.noticeTitle}>Jedan nalog.</Text>
              <Text style={styles.noticeCopy}>Možete i da tražite pomoć i da uskočite drugima.</Text>
            </View> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8F5' },
  header: { width: '100%', maxWidth: 460, alignSelf: 'center', flexDirection: 'row', height: 68, alignItems: 'center', paddingHorizontal: 12 },
  backButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '600', color: '#142F30' },
  sheetScroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 8 },
  formColumn: { width: '100%', maxWidth: 412 },
  authHead: { gap: 12, marginBottom: 28 },
  authTitle: { color: '#142F30', fontSize: 32, lineHeight: 37, letterSpacing: -0.7, fontWeight: '700' },
  authSubtitle: { color: '#5D6E6D', fontSize: 15, lineHeight: 22 },
  tabs: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 14, backgroundColor: '#DCE3DE', marginBottom: 16 },
  tab: { flex: 1, minHeight: 48, paddingVertical: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 11 },
  selectedTab: { backgroundColor: '#FFFFFF' },
  tabLabel: { color: '#142F30', fontSize: 14, fontWeight: '600' },
  form: { gap: 16 },
  field: { gap: 8 },
  fieldLabel: { color: '#142F30', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE3DE', borderRadius: 12, minHeight: 56 },
  fieldInput: { flex: 1, minWidth: 0, minHeight: 54, paddingHorizontal: 16, paddingVertical: 14, color: '#142F30', fontSize: 16, lineHeight: 24 },
  passToggle: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  primary: { minHeight: 56, borderRadius: 16, backgroundColor: '#142F30', alignItems: 'center', justifyContent: 'center', padding: 16 },
  primaryText: { color: '#FFFFFF', fontSize: 16, lineHeight: 24, fontWeight: '600' },
  primaryPressed: { opacity: 0.76 },
  disabled: { opacity: 0.45 },
  feedback: { minHeight: 24, marginTop: -6 },
  banner: { marginBottom: 12, borderRadius: 14, padding: 12 },
  bannerOk: { backgroundColor: '#E6F3EC' },
  bannerOkText: { color: '#265B40', fontSize: 14, lineHeight: 21 },
  bannerErrorText: { color: '#A03328', fontSize: 14, lineHeight: 21 },
  forgot: { minHeight: 48, justifyContent: 'center', marginTop: -20 },
  forgotText: { color: '#142F30', fontSize: 14, fontWeight: '600', lineHeight: 21 },
  methods: { marginTop: 16 },
  method: { minHeight: 56, borderRadius: 16, borderWidth: 1, borderColor: '#DCE3DE', backgroundColor: '#FFFFFF', flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center', padding: 14 },
  methodPressed: { opacity: 0.76 },
  methodIcon: { width: 24, height: 24 },
  methodText: { color: '#142F30', fontSize: 16, fontWeight: '600' },
  consent: { flexDirection: 'row', gap: 12, minHeight: 48, paddingVertical: 8 },
  checkbox: { width: 24, height: 24, borderWidth: 1, borderColor: '#78938A', borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  checkboxChecked: { backgroundColor: '#142F30' },
  checkmark: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  consentText: { flex: 1, color: '#5D6E6D', fontSize: 13, lineHeight: 21 },
  legalLink: { color: '#142F30' },
  backRow: { flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 48 },
  backText: { color: '#142F30', fontSize: 14, fontWeight: '600' },
  smallNote: { color: '#5D6E6D', fontSize: 13, lineHeight: 20, marginVertical: 12 },
  stateIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E4EDE8' },
  stateTitle: { color: '#142F30', fontSize: 23, fontWeight: '700', lineHeight: 29 },
  stateCopy: { color: '#5D6E6D', fontSize: 15, lineHeight: 23 },
  linkButton: { minHeight: 48, justifyContent: 'center' },
  linkText: { color: '#142F30', fontSize: 14, fontWeight: '600' },
  notice: { backgroundColor: '#E9F3F9', padding: 16, borderRadius: 16, marginTop: 16, gap: 6 },
  noticeTitle: { color: '#235F87', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  noticeCopy: { color: '#235F87', fontSize: 13, lineHeight: 20 },
});
