'use strict';
const { buildIdentity } = require('./scripts/build-identity.cjs');

// Expo supplies normalized app.json, including each disposable workflow's
// package/label overrides. Never replace those with the preview identity.
module.exports = ({ config }) => {
  const android = { ...config.android };
  android.permissions = [...new Set([...(android.permissions ?? []),
    'android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION'])];
  const ios = { ...config.ios, infoPlist: { ...config.ios?.infoPlist,
    NSLocationWhenInUseUsageDescription: 'USKOČI uzima jednu lokaciju kada u aktivnom Dogovoru izabereš deljenje sa naručiocem.',
  } };
  const inertPlugin = './plugins/withFirebaseEnrollmentDisabled.js';
  const plugins = (config.plugins ?? []).filter(plugin =>
    (Array.isArray(plugin) ? plugin[0] : plugin) !== inertPlugin);
  const mapPlugin = '@maplibre/maplibre-react-native';
  const photoPlugin = 'expo-image-picker';
  if (!plugins.some(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) === photoPlugin)) {
    plugins.push([photoPlugin, {
      photosPermission: 'Izaberi fotografiju za svoj zadatak ili profil.',
      cameraPermission: 'USKOČI koristi kameru kada želiš da dodaš fotografiju zadatka ili profila.',
      microphonePermission: 'Drži mikrofon za razgovor sa USKOČI asistentom. Puštanje šalje poruku, a ne objavljuje zadatak.',
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
