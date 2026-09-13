import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { authTheme as c } from './authTheme';

/** Presentation only. AuthScreen retains the real command, recovery and Back guards. */
export function AuthSheet({ visible, expanded, backdrop, children }: {
  visible: boolean; expanded: boolean; backdrop: ReactNode; children: ReactNode;
}) {
  const { height, fontScale } = useWindowDimensions();
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return <View style={styles.root}>
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'none' : 'auto'}
      accessibilityElementsHidden={visible} importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>
      {backdrop}
    </View>
    {visible ? <View style={styles.overlay} accessibilityViewIsModal>
      <View testID="auth-reference-sheet" style={[styles.sheet, { maxHeight: keyboard || expanded || fontScale > 1.3 || height < 700 ? '97%' : '76%' }]}>
        <Svg pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs><LinearGradient id="auth-sheet" x1="0%" y1="0%" x2="30%" y2="100%">
            <Stop offset={0} stopColor={c.top} /><Stop offset={0.56} stopColor={c.surface} /><Stop offset={1} stopColor={c.bottom} />
          </LinearGradient></Defs><Rect width="100%" height="100%" fill="url(#auth-sheet)" />
        </Svg>
        {children}
      </View>
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FBFCFB' },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(3,35,29,.52)', justifyContent: 'flex-end', paddingTop: 16 },
  sheet: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', overflow: 'hidden',
    borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderBottomWidth: 0,
    borderColor: '#527469', backgroundColor: c.surface },
});
