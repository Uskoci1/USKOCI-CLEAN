'use strict';

// B22: the log-derived numbers of a window-5 style measurement, from the raw `adb logcat -v threadtime` file that scripts/window5_tour.py writes
// (window5_<tag>_logcat.txt) and the pid it prints (tour.pid in window5_<tag>_result.json).
//
//   node count_log.cjs <logcat file> <app pid>
//
// Plain Node (no grep, awk, bc or python, and indifferent to CRLF checkouts). Counts only the lines of the app process (third field = pid),
// except the chatty and ANR counts, which the system writes.
const fs = require('node:fs');

const [file, pid] = process.argv.slice(2);
if (!file || !/^\d+$/.test(pid ?? '')) {
  console.error('usage: node count_log.cjs <logcat file> <app pid>');
  process.exit(2);
}

const lines = fs.readFileSync(file).toString('latin1').split('\n').map(line => line.replace(/\r$/, ''));
const own = /^\S+\s+\S+\s+(\d+)\s/;
const app = lines.filter(line => own.exec(line)?.[1] === pid);

const count = (list, re) => list.filter(line => re.test(line)).length;
const distinct = (list, re) => new Set(list.flatMap(line => (line.match(re) ?? []).map(match => match.trim()))).size;
const sum = (name) => app.reduce((total, line) => total + (line.match(new RegExp(`\\b${name}=(\\d+)`, 'g')) ?? []).reduce((s, m) => s + Number(m.split('=')[1]), 0), 0);
const davey = app.flatMap(line => (line.match(/Davey! duration=(\d+)/g) ?? []).map(match => Number(match.split('=')[1])));

const rows = [
  ['appLogLines', app.length],
  ['reanimatedWarnLines', count(app, / W Reanimated *: /)],
  ['failedLines', count(app, /synchronouslyUpdateUIProps failed/)],
  ['distinctFailedTags', distinct(app, /failed for tag \d+/g)],
  ['patchLines', count(app, /USKOCI_RNR01/)],
  ['skippedTagLines', count(app, /skipped unmounted tag/)],
  ['distinctSkippedTags', distinct(app, /skipped unmounted tag \d+/g)],
  ['summaryLines', count(app, /synchronouslyUpdateUIProps summary:/)],
  ['skippedSum(lowerBound)', sum('skipped')],
  ['viewlessSum', sum('viewless')],
  ['backedOffSum', sum('backedOff')],
  ['failedSum', sum('failed')],
  ['untrackedSum', sum('untracked')],
  ['evictedSum', sum('evicted')],
  ['daveyFrames', davey.length],
  ['framesOver700ms', davey.filter(ms => ms >= 700).length],
  ['chattyCollapsedLines', count(lines, /chatty.*(identical|expire) \d+ line/)],
  ['anrLines', count(lines, /ANR in rs\.uskoci\.dev/)],
];
for (const [name, value] of rows) console.log(`${name.padEnd(28)}${value}`);
