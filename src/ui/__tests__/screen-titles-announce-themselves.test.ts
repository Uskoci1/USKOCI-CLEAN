import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every `variant="title"` has to say what it is.
 *
 * The app's titles looked right and announced nothing: eleven of twenty-nine carried no role at
 * all, so a screen reader had no heading to land on and no way to skip between sections. The words
 * were already there and already composed — an eyebrow above, a sentence below — which is why this
 * was invisible to the eye and total to anyone not using their eyes.
 *
 * A title is one of exactly three things, and the choice is a judgement, not a sweep:
 *
 *   header        — it names a screen or a section. "Uporedi isti obim, ne samo cenu."
 *   alert         — it reports what just happened, and should be announced when it appears.
 *                   "Prijava je poslata.", "Dogovor je sklopljen."
 *   accessible={false} — it is drawn text, not language. The initials inside an avatar, where the
 *                   name is already written underneath.
 *
 * A title with none of the three is the defect this guards.
 */
const UI = join(__dirname, '..');
const APP = join(__dirname, '..', '..', 'app');

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name === 'node_modules') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sources(path));
    else if (name.endsWith('.tsx')) out.push(path);
  }
  return out;
}

/** The opening tag a `variant="title"` sits in, so the role can be read from the same element. */
function titleTags(source: string): string[] {
  const tags: string[] = [];
  for (let at = source.indexOf('variant="title"'); at !== -1; at = source.indexOf('variant="title"', at + 1)) {
    const open = source.lastIndexOf('<', at);
    const close = source.indexOf('>', at);
    if (open !== -1 && close !== -1) tags.push(source.slice(open, close + 1));
  }
  return tags;
}

describe('screen titles announce themselves', () => {
  const files = [...sources(UI), ...sources(APP)];

  it('finds the titles at all, so an empty sweep cannot pass for a clean one', () => {
    const total = files.reduce((n, f) => n + titleTags(readFileSync(f, 'utf8')).length, 0);
    expect(total).toBeGreaterThan(20);
  });

  it('gives every title a role: header, alert, or explicitly not language', () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const tag of titleTags(readFileSync(file, 'utf8'))) {
        const named = tag.includes('accessibilityRole="header"')
          || tag.includes('accessibilityRole="alert"')
          || tag.includes('accessible={false}')
          || tag.includes('accessibilityRole={');
        if (!named) offenders.push(`${file.split(/[\\/]/).slice(-2).join('/')}: ${tag.replace(/\s+/g, ' ').slice(0, 90)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
