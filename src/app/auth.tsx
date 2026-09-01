import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  ArrowLeft,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  LockKey,
  MapPin,
  Phone,
  User,
  X,
} from 'phosphor-react-native';

import { supabaseKlijent } from '../data/supabaseClient';
import { ReferenceEntryHero } from '../ui/referenceEntry/ReferenceEntryHero';

type Rezim = 'LOGIN' | 'SIGNUP';
type Faza = 'EMAIL' | 'PHONE' | 'OTP' | 'RECOVERY' | 'VERIFY_EMAIL';
type Kontekst = 'default' | 'requester' | 'worker';

const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const ABSOLUTE_FILL = {
  position: 'absolute' as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

function AuthSheetBackground() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id="authVertical" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#1B5A50" stopOpacity={0.995} />
          <Stop offset="0.52" stopColor="#0A302B" stopOpacity={0.995} />
          <Stop offset="1" stopColor="#04211D" stopOpacity={0.998} />
        </LinearGradient>
        <RadialGradient id="authGlow" cx="88%" cy="4%" r="42%">
          <Stop offset="0" stopColor="#3E907E" stopOpacity={0.22} />
          <Stop offset="0.64" stopColor="#3E907E" stopOpacity={0.04} />
          <Stop offset="1" stopColor="#3E907E" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#authVertical)" />
      <Rect width="100%" height="100%" fill="url(#authGlow)" />
    </Svg>
  );
}

function OrangeButtonBackground() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id="authOrange" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FF9A35" />
          <Stop offset="1" stopColor="#FF7908" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#authOrange)" />
    </Svg>
  );
}

function IvoryButtonBackground() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id="authIvory" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FBF2E5" />
          <Stop offset="1" stopColor="#F4E7D4" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#authIvory)" />
    </Svg>
  );
}

function GoogleMark() {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24">
      <Path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.4 2.9-7.3Z" fill="#4285F4" />
      <Path d="M12 22c2.7 0 5-.9 6.7-2.5L15.4 17c-.9.6-2.1 1-3.4 1-2.6 0-4.9-1.8-5.7-4.2H2.9v2.6A10 10 0 0 0 12 22Z" fill="#34A853" />
      <Path d="M6.3 13.8A6 6 0 0 1 6 12c0-.6.1-1.2.3-1.8V7.6H2.9A10 10 0 0 0 2 12c0 1.6.4 3 1 4.4l3.3-2.6Z" fill="#FBBC05" />
      <Path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 12 2a10 10 0 0 0-9.1 5.6l3.4 2.6C7.1 7.8 9.4 6 12 6Z" fill="#EA4335" />
    </Svg>
  );
}

function AppleMark() {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24">
      <Path
        d="M17.1 12.5c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.7-1.7-3.3-1.7-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 6.9 1.1 9.2.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3.1-.7s1.9.7 3.1.7c1.3 0 2.1-1.1 2.8-2.2.9-1.3 1.2-2.6 1.2-2.7-.1 0-2.6-1-2.6-3.8ZM14.8 5.9c.6-.8 1.1-1.9 1-3-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2-.5 2.7-1.3Z"
        fill="#174B43"
      />
    </Svg>
  );
}

function AuthField({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  secure,
  keyboardType,
  autoCapitalize = 'none',
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon: React.ReactNode;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
}) {
  const [vidljivo, setVidljivo] = useState(false);
  return (
    <View style={styles.field}>
      <View style={styles.fieldIcon}>{icon}</View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="rgba(248,235,215,0.30)"
        secureTextEntry={secure && !vidljivo}
        style={[styles.fieldInput, secure && { paddingRight: 42 }]}
      />
      {secure ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={vidljivo ? 'Sakrij lozinku' : 'Prikaži lozinku'}
          onPress={() => setVidljivo((x) => !x)}
          style={styles.passToggle}
        >
          {vidljivo ? <EyeSlash size={18} color="#BBD2CC" /> : <Eye size={18} color="#BBD2CC" />}
        </Pressable>
      ) : null}
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
      <OrangeButtonBackground />
      {busy ? <ActivityIndicator color="#082621" /> : <Text style={styles.primaryText}>{title}</Text>}
    </Pressable>
  );
}

function MethodButton({
  title,
  icon,
  onPress,
}: {
  title: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.method, pressed && styles.methodPressed]}
    >
      <IvoryButtonBackground />
      <View style={styles.methodIcon}>{icon}</View>
      <Text style={styles.methodText}>{title}</Text>
    </Pressable>
  );
}

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const supabase = useMemo(() => supabaseKlijent(), []);
  const [otvoren, setOtvoren] = useState(false);
  const [kontekst, setKontekst] = useState<Kontekst>('default');
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

  const [radi, setRadi] = useState(false);
  const [greska, setGreska] = useState<string | null>(null);
  const [poruka, setPoruka] = useState<string | null>(null);

  const sheet = useSharedValue(0);

  useEffect(() => {
    sheet.value = withTiming(otvoren ? 1 : 0, {
      duration: otvoren ? 320 : 260,
      easing: EASE,
    });
  }, [otvoren, sheet]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, sheet.value * (320 / 240)),
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheet.value, [0, 1], [0.7, 1]),
    transform: [{ translateY: interpolate(sheet.value, [0, 1], [900, 0]) }],
  }));

  function otvori(context: Kontekst = 'default') {
    setKontekst(context);
    setRezim('LOGIN');
    setFaza('EMAIL');
    setGreska(null);
    setPoruka(null);
    setOtvoren(true);
  }

  function nazadNaEmail() {
    setFaza('EMAIL');
    setGreska(null);
    setPoruka(null);
  }

  async function emailAkcija() {
    setRadi(true);
    setGreska(null);
    setPoruka(null);
    try {
      if (rezim === 'LOGIN') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: lozinka,
        });
        if (error) throw error;
      } else {
        if (!ime.trim() || !prezime.trim() || !grad.trim()) {
          throw new Error('Unesite ime, prezime i grad.');
        }
        if (lozinka.length < 6) throw new Error('Lozinka mora imati najmanje 6 znakova.');
        if (lozinka !== potvrda) throw new Error('Lozinke se ne poklapaju.');
        if (!saglasnost) throw new Error('Potrebno je prihvatiti Uslove korišćenja i Politiku privatnosti.');

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: lozinka,
          options: {
            data: {
              first_name: ime.trim(),
              last_name: prezime.trim(),
              city: grad.trim(),
            },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setFaza('VERIFY_EMAIL');
          return;
        }
      }
    } catch (error) {
      setGreska(error instanceof Error ? error.message : 'Prijava trenutno nije uspela.');
    } finally {
      setRadi(false);
    }
  }

  async function posaljiTelefon() {
    setRadi(true);
    setGreska(null);
    setPoruka(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: telefon.trim() });
      if (error) throw error;
      setFaza('OTP');
      setPoruka('Kod je poslat na broj telefona.');
    } catch (error) {
      setGreska(error instanceof Error ? error.message : 'Kod trenutno nije mogao da bude poslat.');
    } finally {
      setRadi(false);
    }
  }

  async function potvrdiOtp() {
    setRadi(true);
    setGreska(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: telefon.trim(),
        token: otp.trim(),
        type: 'sms',
      });
      if (error) throw error;
    } catch (error) {
      setGreska(error instanceof Error ? error.message : 'Kod nije prihvaćen.');
    } finally {
      setRadi(false);
    }
  }

  async function oporavak() {
    setRadi(true);
    setGreska(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      setFaza('VERIFY_EMAIL');
      setPoruka('Ako nalog postoji, poslat je link za oporavak lozinke.');
    } catch (error) {
      setGreska(error instanceof Error ? error.message : 'Link trenutno nije mogao da bude poslat.');
    } finally {
      setRadi(false);
    }
  }

  const naslov =
    faza === 'PHONE'
      ? rezim === 'SIGNUP' ? 'Napravite nalog telefonom' : 'Prijavite se telefonom'
      : faza === 'OTP'
        ? 'Unesite kod'
        : faza === 'RECOVERY'
          ? 'Nova lozinka'
          : faza === 'VERIFY_EMAIL'
            ? 'Potvrdite email'
            : rezim === 'SIGNUP'
              ? 'Napravite nalog'
              : 'Prijavite se emailom';

  const podnaslov =
    faza === 'PHONE'
      ? 'Unesite broj telefona.'
      : faza === 'OTP'
        ? 'Poslali smo kod na Vaš broj.'
        : faza === 'RECOVERY'
          ? 'Unesite email za oporavak pristupa.'
          : faza === 'VERIFY_EMAIL'
            ? 'Proverite poruku koju smo Vam poslali.'
            : rezim === 'SIGNUP'
              ? 'Unesite osnovne podatke za nalog.'
              : 'Unesite email i lozinku.';

  const continuity =
    kontekst === 'requester'
      ? 'Sačuvali smo Vašu Potrebu. Posle prijave vraćamo Vas na isti Pregled.'
      : kontekst === 'worker'
        ? 'Posle prijave vraćamo Vas na istu Priliku — bez gubitka konteksta.'
        : null;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ReferenceEntryHero
        onSignIn={() => otvori('default')}
        onRequester={() => otvori('requester')}
        onWorker={() => otvori('worker')}
      />

      <Animated.View
        pointerEvents={otvoren ? 'auto' : 'none'}
        style={[styles.backdrop, backdropStyle]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zatvori prijavu"
          onPress={() => setOtvoren(false)}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <KeyboardAvoidingView
        pointerEvents={otvoren ? 'box-none' : 'none'}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={StyleSheet.absoluteFill}
      >
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(18, insets.bottom + 8) },
            sheetStyle,
          ]}
        >
          <AuthSheetBackground />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetScroll}
          >
            <View style={styles.sheetTop}>
              <View style={styles.drag} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zatvori"
                onPress={() => setOtvoren(false)}
                style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
              >
                <X size={21} color="#F8EBD7" />
              </Pressable>
            </View>

            <View style={styles.authHead}>
              <Text style={styles.authTitle}>{naslov}</Text>
              <Text style={styles.authSubtitle}>{podnaslov}</Text>
            </View>

            {continuity ? (
              <View style={styles.continuity}>
                <Text style={styles.continuityPlus}>＋</Text>
                <Text style={styles.continuityText}>{continuity}</Text>
              </View>
            ) : null}

            {greska ? <View style={[styles.banner, styles.bannerError]}><Text style={styles.bannerErrorText}>{greska}</Text></View> : null}
            {poruka ? <View style={[styles.banner, styles.bannerOk]}><Text style={styles.bannerOkText}>{poruka}</Text></View> : null}

            {faza === 'EMAIL' ? (
              <>
                <View style={styles.form}>
                  {rezim === 'SIGNUP' ? (
                    <>
                      <AuthField
                        label="Ime"
                        value={ime}
                        onChangeText={setIme}
                        autoCapitalize="words"
                        placeholder="Ime"
                        icon={<User size={21} color="#9FC3BA" />}
                      />
                      <AuthField
                        label="Prezime"
                        value={prezime}
                        onChangeText={setPrezime}
                        autoCapitalize="words"
                        placeholder="Prezime"
                        icon={<User size={21} color="#9FC3BA" />}
                      />
                      <AuthField
                        label="Grad"
                        value={grad}
                        onChangeText={setGrad}
                        autoCapitalize="words"
                        placeholder="Pretražite grad"
                        icon={<MapPin size={21} color="#9FC3BA" />}
                      />
                    </>
                  ) : null}

                  <AuthField
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    placeholder="ime@primer.rs"
                    icon={<EnvelopeSimple size={21} color="#9FC3BA" />}
                  />
                  <AuthField
                    label="Lozinka"
                    value={lozinka}
                    onChangeText={setLozinka}
                    placeholder="Unesite lozinku"
                    secure
                    icon={<LockKey size={21} color="#9FC3BA" />}
                  />

                  {rezim === 'SIGNUP' ? (
                    <>
                      <AuthField
                        label="Potvrdite lozinku"
                        value={potvrda}
                        onChangeText={setPotvrda}
                        placeholder="Ponovite lozinku"
                        secure
                        icon={<LockKey size={21} color="#9FC3BA" />}
                      />
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: saglasnost }}
                        onPress={() => setSaglasnost((x) => !x)}
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
                    onPress={() => void emailAkcija()}
                    busy={radi}
                  />

                  {rezim === 'LOGIN' ? (
                    <Pressable onPress={() => { setFaza('RECOVERY'); setGreska(null); setPoruka(null); }} style={styles.forgot}>
                      <Text style={styles.forgotText}>Zaboravili ste lozinku?</Text>
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.authSwitch}>
                  <Text style={styles.authSwitchQuestion}>
                    {rezim === 'SIGNUP' ? 'Već imate nalog?' : 'Nemate nalog?'}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setRezim((x) => x === 'LOGIN' ? 'SIGNUP' : 'LOGIN');
                      setGreska(null);
                      setPoruka(null);
                    }}
                    style={styles.authSwitchButton}
                  >
                    <Text style={styles.authSwitchButtonText}>
                      {rezim === 'SIGNUP' ? 'Prijavite se' : 'Napravite nalog'}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.dividerRow}>
                  <View style={styles.divider} />
                  <Text style={styles.dividerText}>ili nastavite preko</Text>
                  <View style={styles.divider} />
                </View>

                <View style={styles.methods}>
                  <MethodButton
                    title="Google"
                    icon={<GoogleMark />}
                    onPress={() => setGreska('Google prijava čeka serversku OAuth konfiguraciju. Email i telefon su funkcionalni.')}
                  />
                  <MethodButton
                    title="Apple"
                    icon={<AppleMark />}
                    onPress={() => setGreska('Apple prijava čeka Apple/Supabase provider konfiguraciju.')}
                  />
                  <MethodButton
                    title="Telefon"
                    icon={<Phone size={23} color="#174B43" />}
                    onPress={() => { setFaza('PHONE'); setGreska(null); setPoruka(null); }}
                  />
                </View>

                <Text style={styles.authLegal}>
                  <Text style={styles.authLegalLink}>Uslovi korišćenja</Text> · <Text style={styles.authLegalLink}>Politika privatnosti</Text>
                </Text>
              </>
            ) : null}

            {faza === 'PHONE' ? (
              <View style={styles.form}>
                <Pressable onPress={nazadNaEmail} style={styles.backRow}>
                  <ArrowLeft size={16} color="#D8EAE5" />
                  <Text style={styles.backText}>Nazad na prijavu</Text>
                </Pressable>
                <AuthField
                  label="Broj telefona"
                  value={telefon}
                  onChangeText={setTelefon}
                  keyboardType="phone-pad"
                  placeholder="+381 6x xxx xxxx"
                  icon={<Phone size={21} color="#9FC3BA" />}
                />
                <Text style={styles.smallNote}>Poslaćemo Vam jednokratni kod.</Text>
                <PrimaryButton title="Pošaljite kod" onPress={() => void posaljiTelefon()} busy={radi} />
              </View>
            ) : null}

            {faza === 'OTP' ? (
              <View style={styles.form}>
                <Pressable onPress={() => setFaza('PHONE')} style={styles.backRow}>
                  <ArrowLeft size={16} color="#D8EAE5" />
                  <Text style={styles.backText}>Promenite broj</Text>
                </Pressable>
                <View style={styles.stateIcon}><Phone size={28} color="#DDF0EA" /></View>
                <Text style={styles.stateTitle}>Unesite kod</Text>
                <Text style={styles.stateCopy}>Poslali smo kod na Vaš broj. Ako ne stigne, možete zatražiti novi.</Text>
                <AuthField
                  label="Kod"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  placeholder="123456"
                  icon={<LockKey size={21} color="#9FC3BA" />}
                />
                <PrimaryButton title="Potvrdite kod" onPress={() => void potvrdiOtp()} busy={radi} />
                <Pressable onPress={() => void posaljiTelefon()} style={styles.linkButton}>
                  <Text style={styles.linkText}>Pošaljite novi kod</Text>
                </Pressable>
              </View>
            ) : null}

            {faza === 'RECOVERY' ? (
              <View style={styles.form}>
                <Pressable onPress={nazadNaEmail} style={styles.backRow}>
                  <ArrowLeft size={16} color="#D8EAE5" />
                  <Text style={styles.backText}>Nazad</Text>
                </Pressable>
                <View style={styles.stateIcon}><LockKey size={28} color="#DDF0EA" /></View>
                <Text style={styles.stateTitle}>Zaboravili ste lozinku?</Text>
                <Text style={styles.stateCopy}>Unesite email na koji želite da dobijete link za novu lozinku.</Text>
                <AuthField
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  placeholder="ime@primer.rs"
                  icon={<EnvelopeSimple size={21} color="#9FC3BA" />}
                />
                <PrimaryButton title="Pošaljite link" onPress={() => void oporavak()} busy={radi} />
              </View>
            ) : null}

            {faza === 'VERIFY_EMAIL' ? (
              <View style={styles.form}>
                <View style={styles.stateIcon}><EnvelopeSimple size={28} color="#DDF0EA" /></View>
                <Text style={styles.stateTitle}>Proverite email</Text>
                <Text style={styles.stateCopy}>Poslali smo Vam poruku. Otvorite je i potvrdite email.</Text>
                <PrimaryButton title="Nastavite" onPress={nazadNaEmail} />
              </View>
            ) : null}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0E3D37',
  },
  backdrop: {
    ...ABSOLUTE_FILL,
    zIndex: 310,
    backgroundColor: 'rgba(1,20,18,0.68)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 320,
    maxHeight: '92%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(248,235,215,0.15)',
    shadowColor: '#000',
    shadowOpacity: 0.36,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: -18 },
    elevation: 24,
  },
  sheetScroll: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 6,
  },
  sheetTop: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drag: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(248,235,215,0.34)',
  },
  close: {
    position: 'absolute',
    right: 0,
    top: -4,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(248,235,215,0.14)',
    backgroundColor: 'rgba(3,33,29,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePressed: {
    transform: [{ scale: 0.95 }],
  },
  authHead: {
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 14,
  },
  authTitle: {
    color: '#F8EBD7',
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  authSubtitle: {
    marginTop: 8,
    color: 'rgba(248,235,215,0.78)',
    fontSize: 14,
    lineHeight: 20,
  },
  continuity: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 2,
    marginBottom: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(151,183,174,0.11)',
    borderWidth: 1,
    borderColor: 'rgba(151,183,174,0.24)',
  },
  continuityPlus: {
    color: '#A9D4C9',
    fontSize: 18,
    lineHeight: 18,
    fontWeight: '700',
  },
  continuityText: {
    flex: 1,
    color: '#DDEDE7',
    fontSize: 12.5,
    lineHeight: 17,
  },
  banner: {
    marginHorizontal: 2,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  bannerError: {
    backgroundColor: 'rgba(255,180,169,0.09)',
    borderColor: 'rgba(255,180,169,0.22)',
  },
  bannerErrorText: {
    color: '#FFD3CD',
    fontSize: 12,
    lineHeight: 17,
  },
  bannerOk: {
    backgroundColor: 'rgba(191,231,211,0.10)',
    borderColor: 'rgba(191,231,211,0.22)',
  },
  bannerOkText: {
    color: '#D7F1E4',
    fontSize: 12,
    lineHeight: 17,
  },
  form: {
    gap: 12,
  },
  field: {
    position: 'relative',
    minHeight: 58,
    borderWidth: 1,
    borderColor: 'rgba(151,183,174,0.35)',
    borderRadius: 16,
    backgroundColor: 'rgba(2,30,27,0.46)',
    paddingTop: 18,
    paddingRight: 13,
    paddingBottom: 7,
    paddingLeft: 45,
  },
  fieldIcon: {
    position: 'absolute',
    left: 14,
    top: 19,
    width: 21,
    height: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    position: 'absolute',
    left: 45,
    top: 8,
    color: '#AFCAC3',
    fontSize: 10,
    lineHeight: 11,
    fontWeight: '700',
    letterSpacing: 0.35,
  },
  fieldInput: {
    height: 30,
    padding: 0,
    color: '#F8EBD7',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
  },
  passToggle: {
    position: 'absolute',
    right: 9,
    top: 11,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF7908',
    shadowOpacity: 0.22,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
  primaryPressed: {
    transform: [{ scale: 0.988 }],
  },
  primaryText: {
    color: '#082621',
    fontSize: 15,
    lineHeight: 17,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.45,
  },
  forgot: {
    alignSelf: 'flex-end',
    marginTop: -4,
    paddingVertical: 7,
  },
  forgotText: {
    color: '#F3C49B',
    fontSize: 11.5,
    fontWeight: '800',
  },
  authSwitch: {
    marginTop: 14,
    marginBottom: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  authSwitchQuestion: {
    color: 'rgba(248,235,215,0.66)',
    fontSize: 12.5,
  },
  authSwitchButton: {
    padding: 8,
  },
  authSwitchButtonText: {
    color: '#FF9A3C',
    fontSize: 12.5,
    fontWeight: '800',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 2,
    marginTop: 8,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    flex: 1,
    backgroundColor: 'rgba(248,235,215,0.12)',
  },
  dividerText: {
    color: 'rgba(248,235,215,0.48)',
    fontSize: 11,
  },
  methods: {
    flexDirection: 'row',
    gap: 9,
  },
  method: {
    flex: 1,
    minHeight: 76,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(248,235,215,0.58)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  methodPressed: {
    transform: [{ scale: 0.975 }],
  },
  methodIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodText: {
    color: '#0B332E',
    fontSize: 11.5,
    lineHeight: 12,
    fontWeight: '800',
  },
  authLegal: {
    marginTop: 14,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: 'rgba(248,235,215,0.09)',
    color: 'rgba(248,235,215,0.50)',
    fontSize: 10.5,
    lineHeight: 15,
    textAlign: 'center',
  },
  authLegalLink: {
    color: 'rgba(248,235,215,0.82)',
  },
  consent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: 'rgba(2,30,27,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(248,235,215,0.08)',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(248,235,215,0.34)',
    backgroundColor: 'rgba(2,30,27,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#FF8A1F',
    borderColor: '#FF8A1F',
  },
  checkmark: {
    color: '#082621',
    fontWeight: '900',
    fontSize: 12,
  },
  consentText: {
    flex: 1,
    paddingTop: 1,
    color: 'rgba(248,235,215,0.72)',
    fontSize: 10.5,
    lineHeight: 14.5,
  },
  legalLink: {
    color: '#F7EBDD',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  backText: {
    color: '#D8EAE5',
    fontSize: 12,
    fontWeight: '800',
  },
  smallNote: {
    marginTop: -2,
    color: 'rgba(248,235,215,0.58)',
    fontSize: 10.5,
    lineHeight: 15,
  },
  stateIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: 'rgba(151,183,174,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(248,235,215,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 1,
  },
  stateTitle: {
    color: '#FFFFFF',
    fontSize: 23,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.25,
  },
  stateCopy: {
    maxWidth: 320,
    color: 'rgba(248,235,215,0.72)',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 3,
  },
  linkButton: {
    paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  linkText: {
    color: '#FFAA5D',
    fontSize: 12,
    fontWeight: '800',
  },
});
