import path from 'node:path';

const { validateStatic, nativeSensitive } = require('../ota-preview-guard.cjs');
const root = path.resolve(__dirname, '../..');

describe('OTA preview source guard', () => {
  it('pins the existing EAS project, preview runtime and isolated production channel', () => {
    expect(validateStatic(root)).toEqual({
      projectId: '1e6cc490-9851-4741-9226-128612122db6',
      updateUrl: 'https://u.expo.dev/1e6cc490-9851-4741-9226-128612122db6',
      previewRuntime: 'uskoci-v1-preview-r1',
      productionRuntime: 'uskoci-v1-production-r1',
    });
  });

  it.each([
    'package.json', 'package-lock.json', 'app.json', 'app.config.js', 'eas.json',
    'plugins/withFirebaseEnrollmentDisabled.js', 'modules/uskoci-voice/android/build.gradle',
    'patches/react-native-reanimated+4.5.1.patch', 'config/firebase/google-services.json',
    'assets/brand/app-icon/icon.png', 'assets/fonts/inter/Inter-Regular.ttf', 'assets/entry-splash-mark.png',
    'android/app/src/main/AndroidManifest.xml', 'ios/USKOCI/Supporting/Expo.plist',
  ])('treats %s as native-runtime sensitive', file => {
    expect(nativeSensitive.some((pattern: RegExp) => pattern.test(file))).toBe(true);
  });

  it.each([
    'src/ui/location/LocationPointEditor.tsx', 'src/ui/v2/TaskCard.tsx',
    'src/data/marketplaceView.ts', 'assets/illustrations/task.png',
    'docs/control/ota-preview-trigger.json',
  ])('allows OTA-compatible source %s through the native classifier', file => {
    expect(nativeSensitive.some((pattern: RegExp) => pattern.test(file))).toBe(false);
  });
});
