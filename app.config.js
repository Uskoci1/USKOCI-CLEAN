'use strict';
const { buildIdentity } = require('./scripts/build-identity.cjs');

// Expo supplies normalized app.json, including each disposable workflow's
// package/label overrides. Never replace those with the preview identity.
// The Google Play identity (owner, 2026-09-23: "rs.uskoci"). Only the EAS production profile, the store app bundle,
// takes it; the preview APK and every CI build keep the package they are given. A package is permanent in Play Console.
const STORE_PACKAGE = 'rs.uskoci';
const NEARBY_PERMISSION = 'USKOČI koristi jednu lokaciju kada pritisneš „U blizini”, da prikaže mapu zadataka oko tebe.';

module.exports = ({ config }) => {
  const android = { ...config.android };
  if (process.env.EAS_BUILD_PROFILE === 'production') android.package = STORE_PACKAGE;
  android.permissions = [...new Set([...(android.permissions ?? []),
    'android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION'])];
  const ios = { ...config.ios, infoPlist: { ...config.ios?.infoPlist,
    NSLocationWhenInUseUsageDescription: NEARBY_PERMISSION,
  } };
  const inertPlugin = './plugins/withFirebaseEnrollmentDisabled.js';
  const plugins = (config.plugins ?? []).filter(plugin =>
    (Array.isArray(plugin) ? plugin[0] : plugin) !== inertPlugin);
  const mapPlugin = '@maplibre/maplibre-react-native';
  const photoPlugin = 'expo-image-picker';
  const locationPlugin = 'expo-location';
  if (!plugins.some(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) === locationPlugin)) {
    // A single foreground observation on explicit Nearby. No background tracking, service or motion permission.
    plugins.push([locationPlugin, {
      locationWhenInUsePermission: NEARBY_PERMISSION,
      locationAlwaysPermission: false,
      locationAlwaysAndWhenInUsePermission: false,
      motionUsagePermission: false,
      isIosBackgroundLocationEnabled: false,
      isAndroidBackgroundLocationEnabled: false,
      isAndroidForegroundServiceEnabled: false,
      isAndroidMotionActivityEnabled: false,
    }]);
  }
  if (!plugins.some(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) === photoPlugin)) {
    plugins.push([photoPlugin, {
      photosPermission: 'Izaberi fotografiju za svoj zadatak ili profil.',
      cameraPermission: 'USKOČI koristi kameru kada želiš da dodaš fotografiju zadatka ili profila.',
      microphonePermission: 'Drži mikrofon za razgovor sa USKOČI asistentom. Puštanje završava transkript koji možeš da izmeniš; poruku šalješ tek kada izabereš Pošalji.',
    }]);
  }
  if (!plugins.some(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) === mapPlugin)) {
    plugins.push(mapPlugin);
  }
  if (android.package === 'rs.uskoci.preview') {
    android.googleServicesFile = './config/firebase/google-services.json';
    plugins.push(inertPlugin);
  } else {
    // Preview Firebase has no Android client for proof/dev/unknown packages.
    delete android.googleServicesFile;
  }
  return { ...config, android, ios, plugins, extra: { ...config.extra,
    uskociBuild: buildIdentity({ root: __dirname, version: config.version }),
  } };
};
