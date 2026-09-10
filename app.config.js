'use strict';
const { buildIdentity } = require('./scripts/build-identity.cjs');

// Expo supplies normalized app.json, including each disposable workflow's
// package/label overrides. Never replace those with the preview identity.
module.exports = ({ config }) => {
  const android = { ...config.android };
  const inertPlugin = './plugins/withFirebaseEnrollmentDisabled.js';
  const plugins = (config.plugins ?? []).filter(plugin =>
    (Array.isArray(plugin) ? plugin[0] : plugin) !== inertPlugin);
  const mapPlugin = '@maplibre/maplibre-react-native';
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
  return { ...config, android, plugins, extra: { ...config.extra,
    uskociBuild: buildIdentity({ root: __dirname, version: config.version }),
  } };
};
