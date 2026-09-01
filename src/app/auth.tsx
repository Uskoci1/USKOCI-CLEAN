import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LockKey, EnvelopeSimple, Phone, ArrowLeft } from 'phosphor-react-native';

import { supabaseKlijent } from '../data/supabaseClient';
import { T } from '../ui/Text';
import { Press } from '../ui/Press';
import { palette, radius, space, touch } from '../theme/tokens';

type Rezim = 'LOGIN' | 'SIGNUP' | 'PHONE' | 'OTP' | 'RECOVERY';

export default function AuthScreen() {
  const supabase = useMemo(() => supabaseKlijent(), []);
  const [rezim, setRezim] = useState<Rezim>('LOGIN');
  const [email, setEmail] = useState('');
  const [lozinka, setLozinka] = useState('');
  const [telefon, setTelefon] = useState('');
  const [otp, setOtp] = useState('');
  const [radi, setRadi] = useState(false);
  const [greska, setGreska] = useState<string | null>(null);
  const [poruka, setPoruka] = useState<string | null>(null);

  async function izvrsi() {
    setRadi(true);
    setGreska(null);
    setPoruka(null);
    try {
      if (rezim === 'LOGIN') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: lozinka });
        if (error) throw error;
      } else if (rezim === 'SIGNUP') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: lozinka });
        if (error) throw error;
        if (!data.session) setPoruka('Nalog je kreiran. Proverite email ako je potvrda uključena.');
      } else if (rezim === 'PHONE') {
        const { error } = await supabase.auth.signInWithOtp({ phone: telefon.trim() });
        if (error) throw error;
        setRezim('OTP');
        setPoruka('Kod je poslat na broj telefona.');
      } else if (rezim === 'OTP') {
        const { error } = await supabase.auth.verifyOtp({ phone: telefon.trim(), token: otp.trim(), type: 'sms' });
        if (error) throw error;
      } else if (rezim === 'RECOVERY') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (error) throw error;
        setPoruka('Ako nalog postoji, poslat je link za oporavak lozinke.');
      }
    } catch (error) {
      setGreska(error instanceof Error ? error.message : 'Prijava trenutno nije uspela.');
    } finally {
      setRadi(false);
    }
  }

  const naslov =
    rezim === 'LOGIN' ? 'Dobro došli' :
    rezim === 'SIGNUP' ? 'Napravite nalog' :
    rezim === 'PHONE' ? 'Prijava telefonom' :
    rezim === 'OTP' ? 'Unesite kod' :
    'Oporavak naloga';

  const emailMode = rezim === 'LOGIN' || rezim === 'SIGNUP' || rezim === 'RECOVERY';
  const passwordMode = rezim === 'LOGIN' || rezim === 'SIGNUP';
  const phoneMode = rezim === 'PHONE' || rezim === 'OTP';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.forest900 }}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
        >
          <View style={{ paddingHorizontal: space.xl, paddingTop: space.huge, paddingBottom: space.xxl, gap: space.md }}>
            <T variant="display" tone="onDark">USKOČI</T>
            <T variant="body" tone="onDarkMuted">Meni treba. Ja mogu.</T>
          </View>

          <View
            style={{
              backgroundColor: palette.surface,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: space.xl,
              gap: space.base,
            }}
          >
            {rezim !== 'LOGIN' && (
              <Press
                accessibilityRole="button"
                accessibilityLabel="Nazad na prijavu"
                onPress={() => { setRezim('LOGIN'); setGreska(null); setPoruka(null); }}
                style={{ width: touch.min, height: touch.min, alignItems: 'center', justifyContent: 'center' }}
              >
                <ArrowLeft size={20} color={palette.ink} />
              </Press>
            )}

            <View style={{ gap: space.xs }}>
              <T variant="title">{naslov}</T>
              <T variant="meta" tone="muted">
                Jedan nalog koristi i Naručilac i Uskočer prostor.
              </T>
            </View>

            {emailMode && (
              <View style={{ gap: space.xs }}>
                <T variant="label" tone="muted">EMAIL</T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderColor: palette.line100, borderRadius: radius.md, paddingHorizontal: space.md }}>
                  <EnvelopeSimple size={18} color={palette.teal500} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    placeholder="ime@primer.rs"
                    placeholderTextColor={palette.inkMuted}
                    style={{ flex: 1, minHeight: touch.min, fontSize: 16, color: palette.ink }}
                  />
                </View>
              </View>
            )}

            {passwordMode && (
              <View style={{ gap: space.xs }}>
                <T variant="label" tone="muted">LOZINKA</T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderColor: palette.line100, borderRadius: radius.md, paddingHorizontal: space.md }}>
                  <LockKey size={18} color={palette.teal500} />
                  <TextInput
                    value={lozinka}
                    onChangeText={setLozinka}
                    secureTextEntry
                    textContentType={rezim === 'SIGNUP' ? 'newPassword' : 'password'}
                    placeholder="Vaša lozinka"
                    placeholderTextColor={palette.inkMuted}
                    style={{ flex: 1, minHeight: touch.min, fontSize: 16, color: palette.ink }}
                  />
                </View>
              </View>
            )}

            {phoneMode && (
              <View style={{ gap: space.xs }}>
                <T variant="label" tone="muted">TELEFON</T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderColor: palette.line100, borderRadius: radius.md, paddingHorizontal: space.md }}>
                  <Phone size={18} color={palette.teal500} />
                  <TextInput
                    value={telefon}
                    onChangeText={setTelefon}
                    editable={rezim !== 'OTP'}
                    keyboardType="phone-pad"
                    textContentType="telephoneNumber"
                    placeholder="+381..."
                    placeholderTextColor={palette.inkMuted}
                    style={{ flex: 1, minHeight: touch.min, fontSize: 16, color: palette.ink }}
                  />
                </View>
              </View>
            )}

            {rezim === 'OTP' && (
              <View style={{ gap: space.xs }}>
                <T variant="label" tone="muted">KOD</T>
                <TextInput
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  maxLength={8}
                  placeholder="123456"
                  placeholderTextColor={palette.inkMuted}
                  style={{ minHeight: touch.min, borderWidth: 1, borderColor: palette.line100, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 18, letterSpacing: 4, color: palette.ink }}
                />
              </View>
            )}

            {greska && (
              <View style={{ backgroundColor: palette.dangerBg, borderRadius: radius.md, padding: space.md }}>
                <T variant="meta" tone="danger">{greska}</T>
              </View>
            )}
            {poruka && (
              <View style={{ backgroundColor: palette.successBg, borderRadius: radius.md, padding: space.md }}>
                <T variant="meta" tone="success">{poruka}</T>
              </View>
            )}

            <Press
              accessibilityRole="button"
              accessibilityLabel="Nastavi"
              disabled={radi}
              haptic="medium"
              onPress={() => void izvrsi()}
              style={{ minHeight: 52, borderRadius: radius.md, backgroundColor: palette.orange, alignItems: 'center', justifyContent: 'center' }}
            >
              {radi ? <ActivityIndicator color={palette.onOrange} /> : (
                <T variant="action" tone="onOrange">
                  {rezim === 'SIGNUP' ? 'Napravi nalog' : rezim === 'OTP' ? 'Potvrdi kod' : rezim === 'RECOVERY' ? 'Pošalji link' : 'Nastavi'}
                </T>
              )}
            </Press>

            {rezim === 'LOGIN' && (
              <>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Press
                    accessibilityRole="button"
                    onPress={() => setRezim('PHONE')}
                    style={{ flex: 1, minHeight: touch.min, borderWidth: 1, borderColor: palette.line100, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <T variant="action">Telefon</T>
                  </Press>
                  <Press
                    accessibilityRole="button"
                    onPress={() => setRezim('SIGNUP')}
                    style={{ flex: 1, minHeight: touch.min, borderWidth: 1, borderColor: palette.line100, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <T variant="action">Registracija</T>
                  </Press>
                </View>

                <Press accessibilityRole="button" onPress={() => setRezim('RECOVERY')} style={{ minHeight: touch.min, alignItems: 'center', justifyContent: 'center' }}>
                  <T variant="action" tone="orange">Zaboravili ste lozinku?</T>
                </Press>

                <View style={{ height: 1, backgroundColor: palette.line100, marginVertical: space.xs }} />
                <Press
                  accessibilityRole="button"
                  onPress={() => setGreska('Google prijava čeka serversku OAuth konfiguraciju. Email i telefon su funkcionalni.')}
                  style={{ minHeight: 48, borderWidth: 1, borderColor: palette.line100, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }}
                >
                  <T variant="action">Nastavi sa Google</T>
                </Press>
                {Platform.OS === 'ios' && (
                  <Press
                    accessibilityRole="button"
                    onPress={() => setGreska('Apple prijava čeka Apple/Supabase provider konfiguraciju. Ostali Auth putevi ostaju dostupni.')}
                    style={{ minHeight: 48, borderWidth: 1, borderColor: palette.ink, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <T variant="action">Nastavi sa Apple</T>
                  </Press>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
