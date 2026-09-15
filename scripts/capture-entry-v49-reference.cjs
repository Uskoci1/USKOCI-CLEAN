// Evidence tool only: executes the exact supplied reference in real Chrome.
// No browser, HTML runtime or demo business state is used by the native app.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..'), source = path.resolve(process.argv[2]);
const sourceSha256 = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
if (sourceSha256 !== 'e272a5bf81971765d871bdf8ad9e16a02b9a731bec835477f0cda09415f2dcdc') throw Error('Wrong reference source.');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
    await page.route('**/*', route => route.request().url().startsWith('file:') ? route.continue() : route.abort());
    await page.goto(pathToFileURL(source).href);
    await page.addStyleTag({ content: '#phone{width:390px!important;height:844px!important;max-width:none!important;max-height:none!important;}' });
    await page.waitForTimeout(5000);
    const readLayout = () => page.evaluate(() => {
      s37Layout(true);
      const root = document.querySelector('#phone'), cs = getComputedStyle(root), n = key => parseFloat(cs.getPropertyValue(key));
      return { width: root.clientWidth, viewportHeight: root.clientHeight,
        brand: root.querySelector('.entrybrand').offsetHeight,
        copy: Math.max(...[...root.querySelectorAll('.s36-copy')].map(e => e.offsetHeight)),
        note: Math.max(...[...root.querySelectorAll('.s37-annotation')].map(e => e.offsetHeight)),
        photoY: n('--s37-photo-y'), photoH: n('--s37-photo-h'), photoW: n('--s38-photo-w'),
        copyY: n('--s37-copy-y'), noteY: n('--s37-note-y'), noteW: n('--s37-note-w'), footY: n('--home-foot-y') };
    });
    const result = { sourceSha256, browser: await browser.version(), layout: await readLayout(), intro: [], intent: [] };
    const out = path.join(root, 'artifacts/v5-native-smoke'); fs.mkdirSync(out, { recursive: true });
    await page.locator('#phone').screenshot({ path: path.join(out, 'v49-reference390-entry.png') });
    for (const timeMs of [0, 3500, 3730, 3840, 3970, 4020, 4150, 4210, 4270, 4340, 4380]) {
      const frame = await page.evaluate(t => {
        cancelAnimationFrame(R.intro.raf); R.intro.playing = false; R.intro.manual = false; R.intro.done = false;
        rIntroFrame(t);
        const root = document.querySelector('#phone'), read = selector => {
          const cs = getComputedStyle(root.querySelector(selector)), m = new DOMMatrix(cs.transform);
          return { opacity: Number(cs.opacity), y: m.m42 };
        };
        return { copy: read('.r .s36-copy'), photo: read('.r .s37-photo-well'), note: read('.r .s37-annotation'), seam: read('.s39-seam').opacity };
      }, timeMs);
      result.intro.push({ timeMs, ...frame });
    }
    await page.evaluate(() => { window.USKOCI_DEMO.v37.showHome(true); window.USKOCI_DEMO.v37.startSweep('r'); });
    for (const timeMs of [0, 120, 300, 500, 680, 720, 760]) {
      result.intent.push({ timeMs, ...await page.evaluate(t => {
        s36SweepFrame(t / 760);
        const root = document.querySelector('#phone'), get = selector => getComputedStyle(root.querySelector(selector));
        const matrix = selector => new DOMMatrix(get(selector).transform);
        return { sceneTravel: matrix('.s36-panel.r').m41, photoScale: matrix('.r .s37-photo-well').m11,
          photoY: matrix('.r .s37-photo-well').m42, copyY: matrix('.r .s36-copy').m42,
          noteY: matrix('.r .s37-annotation').m42, noteOpacity: Number(get('.r .s37-annotation').opacity),
          otherOpacity: Number(get('.s36-panel.w').opacity), footerOpacity: Number(get('.entryfoot').opacity),
          seamOpacity: Number(get('.s39-seam').opacity), doorwayClip: get('.s37-doorway').clipPath };
      }, timeMs) });
      if (timeMs === 500) await page.locator('#phone').screenshot({ path: path.join(out, 'v49-reference390-requester500.png') });
    }
    await page.evaluate(() => { s36CancelSweep(); window.USKOCI_DEMO.v37.showHome(false); state.large = true; document.querySelector('#phone').classList.add('large-text'); s37Layout(true); });
    result.largeLayout = await readLayout();
    await page.locator('#phone').screenshot({ path: path.join(out, 'v49-reference390-large200.png') });
    const dest = path.join(root, 'src/data/__tests__/fixtures/entry-v49-chrome.json');
    fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ browser: result.browser, sourceSha256, layout: result.layout, largeLayout: result.largeLayout,
      introFrames: result.intro.length, intentFrames: result.intent.length }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
