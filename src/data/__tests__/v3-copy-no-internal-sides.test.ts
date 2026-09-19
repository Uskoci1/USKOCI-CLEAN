import { readdirSync, readFileSync } from 'fs';
import { join, relative, resolve, sep } from 'path';

/**
 * Owner rule (V3, 2026-09-19): a person is never told the internal names of the two sides of a task.
 * What the app says is what the person did: "Objavio si" / "Uskočio si", and for somebody else
 * "objavio zadatak" / "uskočio". "Naručilac" and "Uskočer" are words of the engine and of its
 * documents, not of the screens. Identifiers are unaffected: in code they are written without
 * diacritics (`narucilac`, `uskocer`), and the contract of the server is not copy.
 */
const SRC = resolve(__dirname, '../..');
function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [path] : [];
  });
}
const INTERNAL = /Uskočer|uskočer|Naruči(lac|oc)|naruči(lac|oc)/;
/** A line that is only a comment explains the engine to a programmer and is never shown. */
const comment = (line: string) => /^\s*(\/\/|\*|\/\*)/.test(line);

it('no text the app can show names an internal side of a task', () => {
  const offenders = sources(SRC).flatMap(path => readFileSync(path, 'utf8').split(/\r?\n/)
    .map((line, index) => ({ line, at: `${relative(SRC, path).split(sep).join('/')}:${index + 1}` }))
    .filter(entry => !comment(entry.line) && INTERNAL.test(entry.line)).map(entry => entry.at));
  expect(offenders).toEqual([]);
});
