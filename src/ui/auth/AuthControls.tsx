import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Eye, EyeSlash } from 'phosphor-react-native';

export function AuthField({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
  autoCapitalize = 'none',
  editable = true,
  newPassword = false,
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
  newPassword?: boolean;
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
          autoComplete={keyboardType === 'email-address' ? 'email' : secure ? newPassword ? 'new-password' : 'current-password' : 'off'}
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

export function PrimaryButton({
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
      accessibilityLabel={title}
      accessibilityState={{ busy: !!busy, disabled: !!(disabled || busy) }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        (disabled || busy) && styles.disabled,
        pressed && !disabled && !busy && styles.primaryPressed,
      ]}
    >
      {busy ? <ActivityIndicator color="#143D35" /> : <Text style={styles.primaryText}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  fieldLabel: { color: '#143D35', fontSize: 13, lineHeight: 19.5, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ADC2B7', borderRadius: 12, minHeight: 48 },
  fieldInput: { flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 12, paddingVertical: 12, color: '#143D35', fontSize: 16, lineHeight: 22.4 },
  passToggle: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  primary: { minHeight: 52, borderRadius: 16, backgroundColor: '#FF7908', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 18 },
  primaryText: { color: '#13382F', fontSize: 15, lineHeight: 21, fontWeight: '700' },
  primaryPressed: { opacity: 0.76 },
  disabled: { opacity: 0.45 },
});
