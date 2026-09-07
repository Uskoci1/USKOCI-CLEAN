const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

// Metro can read thousands of warm-cache entries concurrently even with one
// transform worker. Bound Windows disk opens without replacing Expo's cache,
// changing cached values, or swallowing a cache error. Other hosts stay default.
if (process.platform === 'win32') {
  let active = 0;
  const queue = [];
  const limit = 32;
  function drain() {
    while (active < limit && queue.length) {
      const { operation, resolve, reject } = queue.shift();
      active += 1;
      Promise.resolve().then(operation).then(resolve, reject).finally(() => {
        active -= 1;
        drain();
      });
    }
  }
  function bounded(operation) {
    return new Promise((resolve, reject) => {
      queue.push({ operation, resolve, reject });
      drain();
    });
  }
  config.cacheStores = config.cacheStores.map(store => ({
    name: store.name ?? store.constructor.name,
    get: key => bounded(() => store.get(key)),
    set: (key, value) => bounded(() => store.set(key, value)),
    clear: () => store.clear(),
  }));
}
module.exports = config;
