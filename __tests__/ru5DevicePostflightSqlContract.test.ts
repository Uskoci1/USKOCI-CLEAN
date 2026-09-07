import { readFileSync } from 'fs';
import { resolve } from 'path';

// Source-contract guards only; actual SQL and UI proof still run against disposable Supabase.
const driver = readFileSync(resolve(__dirname, '../scripts/ru5_android_device_ui_journey.py'), 'utf8');
const ddl = readFileSync(resolve(__dirname, '../supabase/migrations/20260829183609_clean_response_foundation.sql'), 'utf8');
const assertion = driver.split('def assert_worker_submit():')[1].split('\ndef assert_final_selection(')[0];
const columns = new Set([...ddl.split('\n);')[0].matchAll(/^  ([a-z_]+) (?:uuid|text|integer|timestamptz)\b/gm)]
  .map((match) => match[1]));
const unknownResponseColumns = (source: string) => [...new Set([...source.matchAll(/\br\.([a-z_]+)\b/g)]
  .map((match) => match[1]))].filter((column) => !columns.has(column));

describe('RU5 physical proof response postflight schema contract', () => {
  it('reads physical response columns, not projection state names', () => {
    expect(columns.has('status')).toBe(true);
    expect(columns.has('state')).toBe(false);
    expect(assertion).toContain('r.status');
    expect(unknownResponseColumns(assertion)).toEqual([]);
  });

  it('detects the exact historical r.state regression', () => {
    expect(unknownResponseColumns(assertion.replace('r.status', 'r.state'))).toEqual(['state']);
  });

  it('preserves the read-only Need and Worker-bound query', () => {
    expect(assertion).toContain('from public.marketplace_responses r');
    expect(assertion).toContain('join public.app_profiles p on p.id=r.worker_profile_id');
    expect(assertion).toContain("r.need_id='{NEED_ID}'::uuid");
    expect(assertion).toContain("p.account_id='{WORKER_USER_ID}'::uuid");
    const sql = assertion.split('psql(f"""')[1].split('""")')[0];
    expect(sql.trimStart()).toMatch(/^select\b/);
    expect(sql).not.toMatch(/\b(insert|update|delete|alter|create|drop|truncate)\b/i);
  });

  it('does not weaken absence, status, price or headcount assertions', () => {
    expect(assertion).toContain("if not row:");
    expect(assertion).toContain("raise AssertionError('W05 UI did not create Application')");
    expect(assertion).toContain("parts[1] not in ('SUBMITTED', 'VIEWED', 'SHORTLISTED')");
    expect(assertion).toContain("parts[2] != '3000'");
    expect(assertion).toContain("parts[3] != '1'");
    expect(assertion).toContain('raise AssertionError(f\'Unexpected W05 Application: {row}\')');
  });
});
