// Isolated renderer of real presentation components. No app entry or server connection.
const fs = require('node:fs');
const path = require('node:path');
const Metro = require('metro');
const config = require('../../metro.config.cjs');
const root = path.resolve(__dirname, '../..');
config.maxWorkers = 2;
config.resolver.platforms = [...config.resolver.platforms, 'web'];
config.watchFolders = [root, __dirname, fs.realpathSync(path.join(root, 'node_modules'))];
config.resolver.useWatchman = false;
config.fileMapCacheDirectory = path.join(__dirname, '.metro-cache');
fs.mkdirSync(config.fileMapCacheDirectory, { recursive: true });
config.cacheVersion += ':native-presentation-review';
config.reporter = { update(event) { if (event.type === 'bundling_error') console.error(event.error?.message ?? 'Bundle error'); } };
config.resolver.resolveRequest = (context, name, platform) => {
  context = { ...context, preferNativePlatform: false, mainFields: ['browser', 'module', 'main'] };
  if (name === 'react-native') return context.resolveRequest(context, 'react-native-web', platform);
  if (/(ContextPhotos|InboxBell|loadInterWeb|useHoldToTalk)$/.test(name)) {
    return { type: 'sourceFile', filePath: path.join(__dirname, 'preview-boundaries.tsx') };
  }
  return context.resolveRequest(context, name, platform);
};
Metro.runBuild(config, {
  entry: path.join(__dirname, 'review.tsx'), platform: 'web', dev: false, minify: false,
  bundleOut: path.join(__dirname, 'review.bundle.js'),
}).then(() => console.log('Native presentation review built. No app entry or backend.')).catch(error => {
  console.error(error.message); process.exitCode = 1;
});
