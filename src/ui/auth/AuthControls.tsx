import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Eye, EyeSlash } from 'phosphor-react-native';
import { authTheme as c } from './authTheme';

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
  icon,
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
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, focused && styles.focused, !editable && styles.fieldDisabled]}>
      {icon ? <View style={styles.icon} accessible={false} importantForAccessibility="no-hide-descendants">{icon}</View> : null}
      <View style={styles.inputColumn}>
        <Text style={[styles.fieldLabel, focused && styles.focusedLabel]}>{label}</Text>
        <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText}
          editable={editable} autoCapitalize={autoCapitalize} autoCorrect={false}
          keyboardType={keyboardType} placeholder={placeholder} placeholderTextColor={c.placeholder}
          secureTextEntry={secure && !vidljivo} style={styles.fieldInput}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          selectionColor={c.accentLight}
          autoComplete={keyboardType === 'email-address' ? 'email' : secure ? newPassword ? 'new-password' : 'current-password' : 'off'}
        />
      </View>
        {secure ? <Pressable accessibilityRole="button" disabled={!editable}
          accessibilityState={{ disabled: !editable }}
          accessibilityLabel={vidljivo ? 'Sakrij lozinku' : 'Prikaži lozinku'}
          onPress={() => setVidljivo(x => !x)} style={({ pressed }) => [styles.passToggle, pressed && styles.togglePressed]}>
          {vidljivo ? <EyeSlash size={21} color={c.muted} /> : <Eye size={21} color={c.muted} />}
        </Pressable> : null}
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
      {busy ? <ActivityIndicator color={c.buttonInk} /> : <Text style={styles.primaryText}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.input,
    borderWidth: 1, borderColor: c.line, borderRadius: 18, minHeight: 66, paddingLeft: 15 },
  icon: { width: 22, alignItems: 'center' },
  inputColumn: { flex: 1, minWidth: 0, paddingVertical: 9 },
  fieldLabel: { color: c.muted, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  fieldInput: { minWidth: 0, minHeight: 30, paddingHorizontal: 0, paddingRight: 12, paddingVertical: 2, color: c.ink, fontSize: 16, lineHeight: 23 },
  focused: { borderColor: c.accentLight },
  focusedLabel: { color: c.accentLight },
  fieldDisabled: { opacity: .65 },
  passToggle: { width: 48, minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 3 },
  togglePressed: { backgroundColor: c.soft },
  primary: { minHeight: 54, borderRadius: 17, borderWidth: 1, borderColor: '#FFAD63', backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 18 },
  primaryText: { color: c.buttonInk, fontSize: 16, lineHeight: 23, fontWeight: '700' },
  primaryPressed: { backgroundColor: '#FFA342' },
  disabled: { opacity: 0.45 },
});
