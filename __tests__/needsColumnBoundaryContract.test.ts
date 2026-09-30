import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * PKG-045b restricts `public.needs` to a 38-column allowlist for `authenticated` (no whole-row read, no `requester_account_id`,
 * `remaining_search_closed_by_account_id` or `remaining_search_close_reason`). Every client read of the table, direct or embedded in another
 * table's select, must stay inside that list, or an installed build breaks the moment the restriction is applied to the backend.
 */
const ALLOWED = new Set(['id', 'requester_profile_id', 'status', 'title', 'description', 'category', 'approximate_city', 'approximate_area',
  'approximate_lat', 'approximate_lng', 'schedule_kind', 'starts_at', 'ends_at', 'required_slots', 'mode', 'requester_price_rsd', 'required_skills',
  'required_tools', 'required_vehicles', 'verified_identity_required', 'urgent', 'public_photo_paths', 'revision', 'published_at', 'created_at',
  'updated_at', 'response_deadline', 'urgent_activated_at', 'urgent_expires_at', 'urgent_policy_version', 'minimum_experience_years',
  'execution_location_mode', 'approx_geog', 'required_licenses', 'remaining_search_closed_at', 'task_country_code', 'task_timezone', 'price_basis']);
const PRIVATE = ['requester_account_id', 'remaining_search_closed_by_account_id', 'remaining_search_close_reason'];

const root = join(__dirname, '..', 'src');
const sources: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== '__tests__' && name !== 'node_modules') walk(path); }
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) sources.push(path);
  }
};
walk(root);

const columnsOf = (list: string) => list.split(',').map(part => part.trim()).filter(Boolean).map(part => part.replace(/^[\w]+:/, ''));
/** Every column the file asks of `needs`: `.from('needs').select('a,b')` and `needs!inner(a,b)` / `needs(a,b)` inside another select. */
const needsReads = (text: string) => {
  const reads: string[][] = [];
  for (const match of text.matchAll(/\.from\(\s*['"`]needs['"`]\s*\)\s*\.select\(\s*(['"`])([\s\S]*?)\1/g)) reads.push(columnsOf(match[2]!));
  for (const match of text.matchAll(/\bneeds(?:![\w]+)?\(([^()]*)\)/g)) reads.push(columnsOf(match[1]!));
  return reads;
};

describe('client reads of public.needs stay inside the PKG-045b column allowlist', () => {
  it('finds the two production reads (a guard that finds nothing proves nothing)', () => {
    const found = sources.flatMap(path => needsReads(readFileSync(path, 'utf8')).map(columns => `${relative(root, path).replace(/\\/g, '/')}:${columns.length}`));
    expect(found.sort()).toEqual(['data/myApplicationsClientService.ts:6', 'data/ru4Production.ts:1']);
  });

  it('never selects a private column, a whole row or a wildcard', () => {
    for (const path of sources) {
      const text = readFileSync(path, 'utf8');
      for (const columns of needsReads(text)) {
        for (const column of columns) expect({ file: relative(root, path).replace(/\\/g, '/'), column, allowed: ALLOWED.has(column) }).toMatchObject({ allowed: true });
      }
    }
  });

  it('mentions the private columns nowhere in production source', () => {
    const offenders = sources.filter(path => PRIVATE.some(column => readFileSync(path, 'utf8').includes(column))).map(path => relative(root, path).replace(/\\/g, '/'));
    expect(offenders).toEqual([]);
  });

  it('keeps its allowlist equal to the candidate grant, while the candidate is in the repository', () => {
    const candidate = join(__dirname, '..', 'supabase', 'candidates', 'pkg045b_task_column_privileges_p0.sql');
    if (!existsSync(candidate)) return;
    const grant = /grant select \(([^)]*)\) on public\.needs to authenticated;/.exec(readFileSync(candidate, 'utf8'));
    expect(grant).not.toBeNull();
    expect(new Set(columnsOf(grant![1]!))).toEqual(ALLOWED);
    expect(ALLOWED.size).toBe(38);
  });
});
