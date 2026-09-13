import { AuthIntro, authStageForm } from '../ui/auth/AuthPresentation';
import { AuthSheet } from '../ui/auth/AuthSheet';
import { PublicLegalModal } from '../ui/legal/LegalDocuments';
import type { LegalDocumentKind } from '../contracts/legal';
import { authTheme as authColors } from '../ui/auth/authTheme';
import { useEffect, useRef, useState } from 'react';
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
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  AppleLogo,
  EnvelopeSimple,
  GoogleLogo,
  LockKey,
  MapPin,
  Phone,
  User,
} from 'phosphor-react-native';

import { AuthField, PrimaryButton } from '../ui/auth/AuthControls';

import { authClientService } from '../data/authClientService';
import { useAuthAvailability } from '../hooks/useAuthAvailability';
import { useAuthFormCommand } from '../hooks/useAuthFormCommand';
import { EntryWelcome } from '../ui/entry/EntryWelcome';
import { entryIntentClientService } from '../data/entryIntentClientService';
import { sesijaSada } from '../store/sesija';
import { useEntrySplashReady } from '../hooks/useEntrySplashReady';

type Rezim = 'LOGIN' | 'SIGNUP';
type Faza = 'EMAIL' | 'PHONE' | 'OTP' | 'RECOVERY' | 'SIGNUP_NEXT_STEP' | 'RECOVERY_SENT';

function MethodButton({
  title,
  icon,
  onPress,
  disabled,
  unavailable,
}: {
  title: string;
  icon: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  unavailable?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={unavailable ? 'Ovaj način prijave trenutno nije dostupan.' : undefined}
      accessibilityState={{ disabled: !!(disabled || unavailable) }}
      onPress={unavailable ? undefined : onPress}
      disabled={disabled || unavailable}
      style={({ pressed }) => [styles.method, unavailable && styles.methodUnavailable, pressed && !disabled && !unavailable && styles.methodPressed]}
    >
      <View style={styles.methodIcon} accessible={false} importantForAccessibility="no-hide-descendants">{icon}</View>
      <View style={styles.methodCopy}>
        <Text style={[styles.methodText, unavailable && styles.methodUnavailableText]}>{title}</Text>
        {unavailable ? <Text style={styles.methodStatus}>Trenutno nije dostupno</Text> : null}
      </View>
    </Pressable>
  );
}

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ form?: string }>();
  const [otvoren, setOtvoren] = useState(params.form === 'login' || params.form === 'recovery');
  const [entrySeen, setEntrySeen] = useState(!otvoren);
  useEffect(() => { if (!otvoren) setEntrySeen(true); }, [otvoren]);
  const { onLayout: onFormLayout } = useEntrySplashReady({ enabled: otvoren });
  const [rezim, setRezim] = useState<Rezim>('LOGIN');
  const [faza, setFaza] = useState<Faza>(params.form === 'recovery' ? 'RECOVERY' : 'EMAIL');
  // Presentation only: a choice becomes visible after its owned prepare succeeds.
  const [preparedIntent, setPreparedIntent] = useState<{ intent: 'REQUESTER' | 'WORKER'; accountRevision: number } | null>(null);
  const session = sesijaSada();
  const selectedIntent = !session.user && preparedIntent?.accountRevision === session.accountRevision ? preparedIntent.intent : null;
  const intentLabel = selectedIntent === 'REQUESTER' ? 'Meni treba' : selectedIntent === 'WORKER' ? 'Ja mogu' : null;

  const [ime, setIme] = useState('');
  const [prezime, setPrezime] = useState('');
  const [grad, setGrad] = useState('');
  const [email, setEmail] = useState('');
  const [lozinka, setLozinka] = useState('');
  const [potvrda, setPotvrda] = useState('');
  const [telefon, setTelefon] = useState('');
  const [otp, setOtp] = useState('');
  const [saglasnost, setSaglasnost] = useState(false);
  const [legalDocument, setLegalDocument] = useState<LegalDocumentKind | null>(null);
  const [confirmationRequired, setConfirmationRequired] = useState(true);

  const commands = useAuthFormCommand();
  const radi = commands.busy;
  const availability = useAuthAvailability(otvoren);
  const methods = availability.status === 'ready' ? availability.data : null;
  const [greska, setGreska] = useState<string | null>(null);
  const [poruka, setPoruka] = useState<string | null>(null);

  const handledRouteForm = useRef(params.form);
  useEffect(() => {
    if (handledRouteForm.current === params.form) return;
    handledRouteForm.current = params.form;
    if (params.form !== 'login' && params.form !== 'recovery') return;
    // Native query parameters may arrive after mount; warm links also reuse
    // this screen. Consume each change once, without interrupting an Auth write
    // or replaying the parameter over a form the person selected themselves.
    commands.changeForm(() => {
      setPreparedIntent(null);
      setRezim('LOGIN');
      setFaza(params.form === 'recovery' ? 'RECOVERY' : 'EMAIL');
      setLozinka(''); setPotvrda(''); setGreska(null); setPoruka(null);
      setOtvoren(true);
    });
  }, [params.form, commands.changeForm]);

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
      setPreparedIntent(null);
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
      setPreparedIntent({ intent, accountRevision: sesijaSada().accountRevision });
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

  async function zatraziOporavak() {
    if (!availability.current()?.passwordRecovery) return;
    await commands.run(async () => {
      setGreska(null); setPoruka(null);
      await authClientService.requestPasswordRecovery(email);
    }, () => {
      setLozinka(''); setPotvrda(''); setFaza('RECOVERY_SENT');
    }, prijaviGresku);
  }

  const naslov =
    faza === 'PHONE'
      ? rezim === 'SIGNUP' ? 'Napravite nalog telefonom' : 'Prijavite se telefonom'
      : faza === 'OTP'
        ? 'Unesite kod'
        : faza === 'RECOVERY'
          ? 'Vratite pristup nalogu.'
          : faza === 'RECOVERY_SENT' ? 'Proverite email'
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
        : faza === 'RECOVERY'
          ? methods?.passwordRecovery ? 'Unesite email koji koristite za USKOČI.' : 'Ova mogućnost još nije dostupna u aplikaciji.'
          : faza === 'RECOVERY_SENT' ? 'Zahtev za oporavak je prihvaćen.'
          : faza === 'SIGNUP_NEXT_STEP'
            ? confirmationRequired ? 'Pratite uputstvo za potvrdu registracije.' : 'Vratite se na prijavu.'
            : rezim === 'SIGNUP'
              ? 'Unesite osnovne podatke za nalog.'
              : 'Unesite email i lozinku.';

  const recoveryStage = faza === 'RECOVERY' || faza === 'RECOVERY_SENT';
  const stageComposition = recoveryStage || (rezim === 'SIGNUP' && (faza === 'EMAIL' || faza === 'SIGNUP_NEXT_STEP'));
  const formStyle = [styles.form, stageComposition && authStageForm];

  return (
    <><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    <AuthSheet visible={otvoren} expanded={rezim === 'SIGNUP'} backdrop={entrySeen ? <EntryWelcome
      onRequester={() => izaberiNameru('REQUESTER')} onWorker={() => izaberiNameru('WORKER')}
      onSignIn={() => otvori('LOGIN')} onSignUp={() => otvori('SIGNUP')} busy={radi || otvoren} error={otvoren ? null : greska} /> : null}>
    <View onLayout={onFormLayout} style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Nazad" disabled={radi}
          onPress={() => commands.changeForm(() => {
            if (faza !== 'EMAIL' || rezim !== 'LOGIN') { setFaza('EMAIL'); setRezim('LOGIN'); }
            else setOtvoren(false);
            setGreska(null); setPoruka(null);
          })} style={({ pressed }) => [styles.backButton, pressed && styles.methodPressed]}><ArrowLeft size={22} color={authColors.ink} /></Pressable>
        <View style={styles.headerTitles}>
          {faza === 'EMAIL' && rezim === 'LOGIN' && intentLabel ? <Text style={styles.headerEyeline}>{intentLabel}</Text> : null}
          <Text style={styles.headerTitle}>{recoveryStage ? 'Oporavak pristupa' : rezim === 'SIGNUP' ? 'Registracija' : 'Prijava'}</Text>
        </View>
      </View>
      <View style={{ flex: 1, minHeight: 0 }}>
        <ScrollView key={`${rezim}:${faza}`} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.sheetScroll, { paddingBottom: Math.max(28, insets.bottom + 16) }]}>
          <View style={styles.formColumn}>
            <AuthIntro composition={stageComposition ? 'stage' : 'hero'} title={faza === 'EMAIL' && rezim === 'LOGIN' ? 'Dobro došao.' : naslov}
              copy={faza === 'EMAIL' && rezim === 'LOGIN' ? selectedIntent === 'WORKER' ? 'Nastavi do Prijava, Zadataka i Dogovora.' : 'Nastavi do svojih Zadataka i Dogovora.' : podnaslov}
              eyebrow={faza === 'RECOVERY' || faza === 'RECOVERY_SENT' ? 'BEZBEDAN POVRATAK' : faza === 'EMAIL' && rezim === 'LOGIN' && intentLabel ? `${intentLabel.toUpperCase()} · ISTI NALOG` : undefined} />
            {poruka ? <View style={[styles.banner, styles.bannerOk]}><Text style={styles.bannerOkText}>{poruka}</Text></View> : null}

            {availability.status === 'loading' ? (
              <View accessibilityRole="progressbar" style={formStyle}>
                <ActivityIndicator color={authColors.muted} />
                <Text style={styles.stateCopy}>Proveravamo dostupne načine prijave…</Text>
              </View>
            ) : availability.status === 'error' ? (
              <View style={formStyle}>
                <Text style={styles.stateCopy}>Ne možemo da proverimo dostupne načine prijave. Proverite vezu i pokušajte ponovo.</Text>
                <PrimaryButton title="Pokušajte ponovo" busy={radi} onPress={() => void availability.retry()} />
              </View>
            ) : null}

            {faza === 'EMAIL' && methods ? (
              <>
                {methods.emailPassword ? <View style={formStyle}>
                  {rezim === 'SIGNUP' && methods.emailSignup ? (
                    <>
                      <AuthField
                        label="Ime"
                        value={ime}
                        onChangeText={(value) => commands.changeForm(() => setIme(value))}
                        editable={!radi}
                        autoCapitalize="words"
                        placeholder="Ime"
                        icon={<User size={21} color={authColors.muted} />}
                      />
                      <AuthField
                        label="Prezime"
                        value={prezime}
                        onChangeText={(value) => commands.changeForm(() => setPrezime(value))}
                        editable={!radi}
                        autoCapitalize="words"
                        placeholder="Prezime"
                        icon={<User size={21} color={authColors.muted} />}
                      />
                      <AuthField
                        label="Grad"
                        value={grad}
                        onChangeText={(value) => commands.changeForm(() => setGrad(value))}
                        editable={!radi}
                        autoCapitalize="words"
                        placeholder="Vaš grad"
                        icon={<MapPin size={21} color={authColors.muted} />}
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
                    icon={<EnvelopeSimple size={21} color={authColors.muted} />}
                  />
                  <AuthField
                    key={`password:${rezim}`}
                    label="Lozinka"
                    value={lozinka}
                    onChangeText={(value) => commands.changeForm(() => setLozinka(value))}
                    editable={!radi}
                    placeholder="Unesite lozinku"
                    secure
                    icon={<LockKey size={21} color={authColors.muted} />}
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
                        icon={<LockKey size={21} color={authColors.muted} />}
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
                          Prihvatam <Text style={styles.legalLink} accessibilityRole="link" onPress={event => {
                            event.stopPropagation(); if (!radi) setLegalDocument('TERMS');
                          }}>Uslove korišćenja</Text> i potvrđujem da sam pročitao/la <Text style={styles.legalLink} accessibilityRole="link" onPress={event => {
                            event.stopPropagation(); if (!radi) setLegalDocument('PRIVACY');
                          }}>Politiku privatnosti</Text>.
                        </Text>
                      </Pressable>
                    </>
                  ) : null}

                  <View style={styles.feedback} accessibilityLiveRegion="polite">
                    {greska ? <Text accessibilityRole="alert" style={styles.bannerErrorText}>{greska}</Text> : null}
                  </View>

                  {rezim === 'LOGIN' ? (
                    <Pressable accessibilityRole="button" disabled={radi} onPress={() => commands.changeForm(() => { setFaza('RECOVERY'); setLozinka(''); setPotvrda(''); setGreska(null); setPoruka(null); })} style={styles.forgot}>
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
                <View style={styles.methods}>
                  <Text style={styles.methodHeading}>Drugi načini prijave</Text>
                  {/* Server settings alone cannot make the pending OAuth client ready. */}
                  <MethodButton title="Google" icon={<GoogleLogo size={23} color={authColors.muted} />} unavailable />
                  <MethodButton title="Apple" icon={<AppleLogo size={23} color={authColors.muted} />} unavailable />
                  <MethodButton
                    title="Telefon"
                    icon={<Phone size={23} color={methods.phoneOtp ? '#174B43' : authColors.muted} />}
                    disabled={radi}
                    unavailable={!methods.phoneOtp}
                    onPress={() => commands.changeForm(() => { setFaza('PHONE'); setGreska(null); setPoruka(null); })}
                  />
                </View>


              </>
            ) : null}

            {faza === 'PHONE' && methods?.phoneOtp ? (
              <View style={formStyle}>
                <Pressable disabled={radi} onPress={nazadNaEmail} style={styles.backRow}>
                  <ArrowLeft size={16} color={authColors.muted} />
                  <Text style={styles.backText}>Nazad na prijavu</Text>
                </Pressable>
                <AuthField
                  label="Broj telefona"
                  value={telefon}
                  onChangeText={(value) => commands.changeForm(() => setTelefon(value))}
                  editable={!radi}
                  keyboardType="phone-pad"
                  placeholder="+381 6x xxx xxxx"
                  icon={<Phone size={21} color={authColors.muted} />}
                />
                <Text style={styles.smallNote}>Poslaćemo Vam jednokratni kod.</Text>
                <PrimaryButton title="Pošaljite kod" onPress={() => void posaljiTelefon()} busy={radi} />
              </View>
            ) : null}

            {faza === 'OTP' && methods?.phoneOtp ? (
              <View style={formStyle}>
                <Pressable disabled={radi} onPress={() => commands.changeForm(() => setFaza('PHONE'))} style={styles.backRow}>
                  <ArrowLeft size={16} color={authColors.muted} />
                  <Text style={styles.backText}>Promenite broj</Text>
                </Pressable>
                <View style={styles.stateIcon}><Phone size={28} color={authColors.muted} /></View>
                <Text style={styles.stateTitle}>Unesite kod</Text>
                <Text style={styles.stateCopy}>Unesite primljeni kod. Ako ne stigne, možete zatražiti novi.</Text>
                <AuthField
                  label="Kod"
                  value={otp}
                  onChangeText={(value) => commands.changeForm(() => setOtp(value))}
                  editable={!radi}
                  keyboardType="number-pad"
                  placeholder="123456"
                  icon={<LockKey size={21} color={authColors.muted} />}
                />
                <PrimaryButton title="Potvrdite kod" onPress={() => void potvrdiOtp()} busy={radi} />
                <Pressable disabled={radi} onPress={() => void posaljiTelefon()} style={styles.linkButton}>
                  <Text style={styles.linkText}>Pošaljite novi kod</Text>
                </Pressable>
              </View>
            ) : null}

            {(faza === 'PHONE' || faza === 'OTP') && methods && !methods.phoneOtp ? (
              <View style={formStyle}>
                <Text style={styles.stateCopy}>Prijava telefonom trenutno nije dostupna.</Text>
                <PrimaryButton title="Nazad na prijavu" onPress={nazadNaEmail} busy={radi} />
              </View>
            ) : null}

            {faza === 'RECOVERY' && methods ? (
              <View style={formStyle}>
                <View style={styles.stateIcon}><LockKey size={28} color={authColors.muted} /></View>
                {methods.passwordRecovery ? <>
                  <AuthField label="Email" value={email} onChangeText={value => commands.changeForm(() => setEmail(value))}
                    editable={!radi} keyboardType="email-address" placeholder="ime@primer.rs" />
                  <Text style={styles.stateCopy}>Otvorićete link iz emaila i izabrati novu lozinku. Vaši Zadaci i Dogovori ostaju na istom nalogu.</Text>
                  <PrimaryButton title="Pošaljite link" busy={radi} onPress={() => void zatraziOporavak()} />
                </> : <Text style={styles.stateCopy}>Oporavak lozinke još nije dostupan u aplikaciji. Možete se vratiti na prijavu.</Text>}
                <Pressable accessibilityRole="button" disabled={radi} style={styles.linkButton} onPress={nazadNaEmail}>
                  <Text style={styles.linkText}>Nazad na prijavu</Text>
                </Pressable>
              </View>
            ) : null}

            {faza === 'RECOVERY_SENT' ? <View style={formStyle}>
              <View style={styles.stateIcon}><EnvelopeSimple size={28} color={authColors.muted} /></View>
              <Text style={styles.stateCopy}>Ako nalog sa ovim emailom postoji, dobićete link za novu lozinku. Proverite i neželjenu poštu.</Text>
              <Text style={styles.smallNote}>{email.trim()}</Text>
              <PrimaryButton title="Nazad na prijavu" onPress={nazadNaEmail} />
              <Pressable accessibilityRole="button" style={styles.linkButton} onPress={() => commands.changeForm(() => {
                setFaza('RECOVERY'); setGreska(null); setPoruka(null);
              })}><Text style={styles.linkText}>Izmenite email ili ponovite zahtev</Text></Pressable>
            </View> : null}

            {faza === 'SIGNUP_NEXT_STEP' ? (
              <View style={formStyle}>
                <View style={styles.stateIcon}><EnvelopeSimple size={28} color={authColors.muted} /></View>
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
        {faza === 'EMAIL' && methods?.emailPassword ? <View style={[styles.authFooter, { paddingBottom: Math.max(16, insets.bottom) }]}>
          <View style={styles.footerColumn}>
            <PrimaryButton
              title={rezim === 'SIGNUP' ? 'Napravite nalog' : 'Prijavite se'}
              disabled={rezim === 'SIGNUP' && !methods.emailSignup}
              onPress={() => void emailAkcija()}
              busy={radi}
            />
            {methods.emailSignup ? <Pressable accessibilityRole="button"
              accessibilityState={{ disabled: radi }} disabled={radi}
              onPress={() => commands.changeForm(() => { setRezim(rezim === 'LOGIN' ? 'SIGNUP' : 'LOGIN'); setGreska(null); setPoruka(null); })}
              style={styles.alternateAction}>
              <Text style={styles.alternateLabel}>{rezim === 'LOGIN' ? 'Napravi nalog' : 'Već imaš nalog? Prijavi se'}</Text>
            </Pressable> : null}
          </View>
        </View> : null}
      </View>
    </View>
    </AuthSheet>
    </KeyboardAvoidingView>
    <PublicLegalModal kind={legalDocument} onClose={() => setLegalDocument(null)} /></>
  );
}

const styles = StyleSheet.create({
  authFooter: { borderTopWidth: 1, borderTopColor: '#345D50', backgroundColor: authColors.surface, paddingTop: 12, paddingHorizontal: 22 },
  footerColumn: { width: '100%', maxWidth: 412, alignSelf: 'center' },
  screen: { flex: 1, backgroundColor: 'transparent' },
  header: { width: '100%', maxWidth: 460, alignSelf: 'center', flexDirection: 'row', minHeight: 72, alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 12 },
  backButton: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, borderColor: '#527469', backgroundColor: authColors.input, alignItems: 'center', justifyContent: 'center' },
  headerTitles: { flex: 1 },
  headerEyeline: { color: authColors.accentLight, fontSize: 12, lineHeight: 17, marginBottom: 3 },
  headerTitle: { textAlign: 'left', fontSize: 18, lineHeight: 25, letterSpacing: -.3, fontWeight: '600', color: authColors.ink },
  sheetScroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 22, paddingTop: 4 },
  formColumn: { width: '100%', maxWidth: 412 },
  alternateAction: { minHeight: 48, paddingVertical: 10, paddingHorizontal: 2, justifyContent: 'center', alignSelf: 'center' },
  alternateLabel: { color: authColors.accentLight, fontSize: 14, lineHeight: 21, fontWeight: '600', textAlign: 'center' },
  form: { gap: 14, backgroundColor: 'transparent', borderWidth: 0, padding: 0, marginTop: 0 },
  feedback: { marginTop: -6 },
  banner: { marginBottom: 12, borderRadius: 14, padding: 12 },
  bannerOk: { backgroundColor: authColors.soft },
  bannerOkText: { color: authColors.ink, fontSize: 14, lineHeight: 21 },
  bannerErrorText: { color: authColors.error, fontSize: 14, lineHeight: 21 },
  forgot: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-end', marginTop: -6 },
  forgotText: { color: authColors.accentLight, fontSize: 14, fontWeight: '600', lineHeight: 21 },
  methods: { marginTop: 20, gap: 10 },
  methodHeading: { color: authColors.muted, fontSize: 13, lineHeight: 20, fontWeight: '600', marginBottom: 2 },
  method: { minHeight: 56, borderRadius: 16, borderWidth: 1, borderColor: '#DCE3DE', backgroundColor: '#FFFFFF', flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center', padding: 14 },
  methodPressed: { opacity: 0.76 },
  methodIcon: { width: 24, height: 24, flexShrink: 0 },
  methodCopy: { flex: 1, minWidth: 0, gap: 3 },
  methodText: { color: '#143D35', fontSize: 16, lineHeight: 23, fontWeight: '600' },
  methodUnavailable: { backgroundColor: authColors.input, borderColor: authColors.line },
  methodUnavailableText: { color: authColors.ink },
  methodStatus: { color: authColors.muted, fontSize: 13, lineHeight: 20 },
  consent: { flexDirection: 'row', gap: 12, minHeight: 48, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 15, backgroundColor: authColors.input },
  checkbox: { width: 24, height: 24, borderWidth: 1, borderColor: authColors.muted, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: authColors.surface },
  checkboxChecked: { backgroundColor: authColors.accent },
  checkmark: { color: authColors.buttonInk, fontSize: 16, fontWeight: '700' },
  consentText: { flex: 1, color: authColors.muted, fontSize: 13, lineHeight: 21 },
  legalLink: { color: authColors.ink, textDecorationLine: 'underline' },
  backRow: { flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 48 },
  backText: { color: authColors.accentLight, fontSize: 14, fontWeight: '600' },
  smallNote: { color: authColors.muted, fontSize: 13, lineHeight: 20, marginVertical: 12 },
  stateIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E4EDE8' },
  stateTitle: { color: authColors.ink, fontSize: 23, fontWeight: '700', lineHeight: 29 },
  stateCopy: { color: authColors.muted, fontSize: 15, lineHeight: 23 },
  linkButton: { minHeight: 48, justifyContent: 'center' },
  linkText: { color: authColors.accentLight, fontSize: 14, fontWeight: '600' },
  notice: { backgroundColor: authColors.soft, padding: 16, borderRadius: 16, marginTop: 16, gap: 6 },
  noticeTitle: { color: authColors.ink, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  noticeCopy: { color: authColors.muted, fontSize: 13, lineHeight: 20 },
});
