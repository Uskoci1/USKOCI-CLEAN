import * as SplashScreen from 'expo-splash-screen';

// Router owns native auto-hide. Set the exit options before importing its entry
// so an early navigation-ready callback cannot start the default 400ms fade.
// An unavailable cosmetic bridge must never stop recovery or Auth startup.
try {
  SplashScreen.setOptions({ duration: 0, fade: false });
} catch {
  // useEntrySplashReady still has its finite readiness/skip boundary.
}
