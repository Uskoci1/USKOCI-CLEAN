// EX-06 S04: the dispatch configuration (private.marketplace_config) the wave reads: dispatch_normal (wave sizes, target responses, window minutes), dispatch_urgent and the urgent activation
// policy. Pure module. The DEV values below were read by read-only SELECT on canonical DEV (project leqcwgzvjsxugfgzdmth) on 2026-10-02 09:45 UTC (ledger 221, no write, no personal data):
// sha256 of the jsonb text (the S03 convention of lib/pins.mjs configQuery) and the three numbers. The proof reads the chain's rows with the S03 configQuery(), drives its scenarios with the
// CHAIN's own values (a wave is as large as the chain's config says) and reports whether the chain's rows equal DEV's (informational: a difference never makes the run fail, it weakens what a
// case says about DEV and the report says so).
export const DEV_CONFIG = Object.freeze({
  readAtUtc: '2026-10-02 09:45',
  dispatch_normal: Object.freeze({sha256: '641f2847f81e208b150b74d0ac283b91f792d877615f0493d633be1486b9c23e', waveSizes: Object.freeze([5, 5, 10, 20]), targetResponses: 3, windowMinutes: 15}),
  dispatch_urgent: Object.freeze({sha256: 'fd5e96ff03305b65afe1981057231cc72b620b093b2b9818fc6018760f71ad48', waveSizes: Object.freeze([10, 10, 20]), targetResponses: 3, windowMinutes: 3}),
  urgent_activation_policy: Object.freeze({sha256: '939d9f0ed998ca62be94e62b05602d006a29c177bdecba8b1e7aed3386614571'}),
});

const KEYS = ['dispatch_normal', 'dispatch_urgent', 'urgent_activation_policy'];
const positiveInteger = text => (/^[1-9][0-9]*$/.test(String(text)) ? Number(text) : null);

/**
 * Pure: the configuration of a chain from the rows of lib/pins.mjs configQuery() ({key, sha256, wave_sizes, target_responses, window_minutes}).
 * Returns {ok, problems, waveSizes, windowMinutes, targetResponses, equalsDev (dispatch_normal), rows: [{key, sha256, devSha256, equalsDev}]}. ok is false when dispatch_normal is missing or has a value
 * the wave could not use (the proof then stops: its expectations come from this row).
 */
export function readConfig(rows) {
  const problems = [];
  const byKey = new Map((Array.isArray(rows) ? rows : []).map(row => [row.key, row]));
  const normal = byKey.get('dispatch_normal');
  let waveSizes = null, windowMinutes = null, targetResponses = null;
  if (!normal) {
    problems.push('the row dispatch_normal of private.marketplace_config does not exist on the chain');
  } else {
    const sizes = normal.wave_sizes;
    if (!Array.isArray(sizes) || sizes.length === 0 || !sizes.every(item => Number.isInteger(item) && item > 0)) problems.push('dispatch_normal.waveSizes is not a non-empty list of positive integers: ' + JSON.stringify(sizes));
    else waveSizes = [...sizes];
    windowMinutes = positiveInteger(normal.window_minutes);
    targetResponses = positiveInteger(normal.target_responses);
    if (windowMinutes === null) problems.push('dispatch_normal.windowMinutes is not a positive integer: ' + JSON.stringify(normal.window_minutes));
    if (targetResponses === null) problems.push('dispatch_normal.targetResponses is not a positive integer: ' + JSON.stringify(normal.target_responses));
  }
  const compared = KEYS.map(key => {
    const row = byKey.get(key);
    return {key, sha256: row?.sha256 ?? null, devSha256: DEV_CONFIG[key].sha256, equalsDev: row?.sha256 === DEV_CONFIG[key].sha256};
  });
  return {ok: problems.length === 0, problems, waveSizes, windowMinutes, targetResponses, equalsDev: compared[0].equalsDev, rows: compared};
}
