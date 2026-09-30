import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * PKG-045b restricts `public.needs` to a 38-column allowlist for `authenticated` (no whole-row read, no `requester_account_id`,
 * `remaining_search_closed_by_account_id` or `remaining_search_close_reason`). Every client read of the table, direct or embedded in another
 * table's select, must stay inside that list, or an installed build breaks the moment the restriction is applied to the backend.
 *
 * The scan reads the source the way PostgREST reads a request, not with one regular expression per shape: every `.from('needs')` must be followed by a chain of
 * calls whose `select` names its columns in a plain string; every `select` anywhere is parsed (aliases, casts, hints, nested embeds) and whatever it embeds of
 * `needs` is held to the same list. A shape it cannot read is a failure, never a pass.
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

/** Index just after the string or template literal that starts at `start`. */
const literalEnd = (text: string, start: number) => {
  const quote = text[start]!;
  let at = start + 1;
  while (at < text.length && text[at] !== quote) at += text[at] === '\\' ? 2 : 1;
  return at + 1;
};
/** Index just after the parenthesised group that opens at `open` (literals are read whole); -1 when it never closes. */
const groupEnd = (text: string, open: number) => {
  let depth = 0;
  for (let at = open; at < text.length; at++) {
    const c = text[at]!;
    if (c === '"' || c === "'" || c === '`') { at = literalEnd(text, at) - 1; continue; }
    if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return at + 1;
  }
  return -1;
};
/** The call chain that follows `at`: `.select('a').eq('id', x).maybeSingle()` is three calls. */
const chainAfter = (text: string, from: number) => {
  const calls: { name: string; args: string; open: number }[] = [];
  for (let at = from; ;) {
    const head = /^\s*\.\s*(\w+)\s*\(/.exec(text.slice(at, at + 200));
    if (!head) return calls;
    const open = at + head[0].length - 1, end = groupEnd(text, open);
    if (end < 0) return calls;
    calls.push({ name: head[1]!, args: text.slice(open + 1, end - 1), open });
    at = end;
  }
};
/** The columns text of a `select` whose first argument is a plain literal (an options object may follow); null for anything else, an empty call included. */
const literalSelect = (args: string) => {
  const match = /^\s*(['"`])((?:\\[\s\S]|(?!\1)[^\\])*)\1\s*(?:,[\s\S]*)?$/.exec(args);
  return match && !(match[1] === '`' && match[2]!.includes('${')) ? match[2]! : null;
};

type Item = { name: string; hints: string[]; columns: string | null; children: Item[] };
/** A PostgREST select list: `a, alias:b::text, c->key, alias:needs!fk!inner(id, x(y))` (columns, casts, JSON paths, aliases, hints and nested embeds). */
const parseSelect = (list: string): Item[] => {
  const items: Item[] = [];
  let depth = 0, start = 0;
  const push = (end: number) => {
    const part = list.slice(start, end).trim();
    if (!part) return;
    const open = part.indexOf('(');
    if (open < 0) {
      items.push({ name: part.replace(/^\w+:(?!:)/, '').split('::')[0]!.split('->')[0]!.trim(), hints: [], columns: null, children: [] });
      return;
    }
    const [name, ...hints] = part.slice(0, open).replace(/^\w+:(?!:)/, '').split('!').map(piece => piece.trim());
    items.push({ name: name!, hints, columns: part.slice(open + 1, part.lastIndexOf(')')), children: parseSelect(part.slice(open + 1, part.lastIndexOf(')'))) });
  };
  for (let at = 0; at < list.length; at++) {
    const c = list[at];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) { push(at); start = at + 1; }
  }
  push(list.length);
  return items;
};
/** An embed reaches `needs` by its table name or by the foreign key that leads there (`need_id`, `<table>_need_id_fkey`), also behind an alias. */
const pointsAtNeeds = (item: Item) => [item.name, ...item.hints].some(piece => piece === 'needs' || /(^|_)need_id(_fkey)?$/.test(piece));
/** What a list of items asks of `needs`, as `{ column }` per own column and a problem text per shape that cannot be held to the list. */
const heldToNeeds = (items: Item[], asNeeds: boolean, place: string): { column: string; problem?: string }[] => {
  const found: { column: string; problem?: string }[] = [];
  for (const item of items) {
    if (item.columns === null) {
      if (asNeeds) found.push({ column: item.name, ...(ALLOWED.has(item.name) ? {} : { problem: `${place}: column "${item.name}" is not in the allowlist` }) });
    } else if (pointsAtNeeds(item)) {
      if (item.children.length === 0) found.push({ column: '*', problem: `${place}: an embed of needs that names no column` });
      found.push(...heldToNeeds(item.children, true, `${place} > ${item.name}`));
    } else found.push(...heldToNeeds(item.children, false, `${place} > ${item.name}`));
  }
  return found;
};

/** Everything a source text asks of `needs`: the columns it names, and every shape it cannot prove to stay inside the allowlist. */
const scanNeedsReads = (text: string) => {
  const reads: string[][] = [], problems: string[] = [], handled = new Set<number>();
  const code = text.split('\n').map(line => (/^\s*(\/\/|\*|\/\*)/.test(line) ? '' : line)).join('\n');
  const check = (place: string, list: string, asNeeds: boolean) => {
    const found = heldToNeeds(parseSelect(list), asNeeds, place);
    if (found.length) reads.push(found.map(entry => entry.column));
    for (const entry of found) if (entry.problem) problems.push(entry.problem);
  };
  for (const from of code.matchAll(/\.from\(\s*(['"`])needs\1\s*\)/g)) {
    const place = `from('needs')@${from.index}`, calls = chainAfter(code, from.index! + from[0].length);
    const selects = calls.filter(call => call.name === 'select');
    if (calls.length === 0) problems.push(`${place}: not followed by a call chain, so its select cannot be read`);
    for (const select of selects) {
      handled.add(select.open);
      const list = literalSelect(select.args);
      if (list === null) problems.push(`${place}: select without a plain string of columns (an empty select is a whole row)`);
      else check(place, list, true);
    }
  }
  for (const select of code.matchAll(/\.select\s*\(/g)) {
    const open = select.index! + select[0].length - 1, end = groupEnd(code, open);
    if (end < 0 || handled.has(open)) continue;
    const list = literalSelect(code.slice(open + 1, end - 1));
    if (list !== null && /need/.test(list)) check(`select@${select.index}`, list, false);
  }
  return { reads, problems };
};

describe('the scan itself reads the shapes a regular expression let through', () => {
  const problemsOf = (text: string) => scanNeedsReads(text).problems.length;
  it('accepts a plain read of allowed columns, with aliases, casts, JSON paths and any chain after the select', () => {
    expect(scanNeedsReads(`await supabase\n  .from('needs')\n  .select('id, alias:status, title::text, price_basis')\n  .eq('id', x)\n  .maybeSingle();`))
      .toEqual({ reads: [['id', 'status', 'title', 'price_basis']], problems: [] });
    expect(scanNeedsReads(`.from("needs").select(\`id,title\`)`).problems).toEqual([]);
    expect(scanNeedsReads(`.from('needs').select('id,title', { count: 'exact' })`).problems).toEqual([]);
  });
  it('rejects a select that is not a plain literal, is empty, or interpolates', () => {
    expect(problemsOf(`.from('needs').select(COLUMNS)`)).toBe(1);
    expect(problemsOf(`.from('needs').select()`)).toBe(1);
    expect(problemsOf('.from(\'needs\').select(`id,${extra}`)')).toBe(1);
    expect(problemsOf(`const query = client.from('needs'); query.select('id');`)).toBe(1);
  });
  it('rejects a wildcard, a private column and a column outside the list, in a read or in what a write returns', () => {
    expect(problemsOf(`.from('needs').select('*')`)).toBe(1);
    expect(problemsOf(`.from('needs').select('id, requester_account_id')`)).toBe(1);
    expect(problemsOf(`.from('needs').select('id,not_a_column')`)).toBe(1);
    expect(problemsOf(`.from('needs').update({ title: 'x' }).eq('id', x).select('*')`)).toBe(1);
    expect(problemsOf(`.from('needs').insert(row).select('id,remaining_search_close_reason')`)).toBe(1);
    expect(problemsOf(`.from('needs').update({ title: 'x' }).eq('id', x)`)).toBe(0);
  });
  it('holds an embed of needs, whatever its alias, hints or nesting, to the same list', () => {
    expect(problemsOf(`.from('marketplace_responses').select('id, needs!inner(id, revision)')`)).toBe(0);
    expect(problemsOf(`.from('marketplace_responses').select('id, needs!inner(id, requester_account_id)')`)).toBe(1);
    expect(problemsOf(`.from('marketplace_responses').select('id, needs(*)')`)).toBe(1);
    expect(problemsOf(`.from('marketplace_responses').select('id, needs()')`)).toBe(1);
    expect(problemsOf(`.from('marketplace_responses').select('id, need:needs!marketplace_responses_need_id_fkey!inner(id, requester_account_id)')`)).toBe(1);
    expect(problemsOf(`.from('marketplace_responses').select('id, needs(id, requester_account_id, profiles(id))')`)).toBe(1);
    expect(problemsOf(`.from('marketplace_responses').select('id, needs(id, profiles(id, x))')`)).toBe(0);
    expect(problemsOf(`.from('agreements').select('id, need:need_id(id, requester_account_id)')`)).toBe(1);
    expect(problemsOf(`.from('agreements').select('id, profiles(id, requester_account_id)')`)).toBe(0);
  });
  it('ignores what a comment says', () => {
    expect(problemsOf(`// .from('needs').select('*')\n/** .from('needs').select() */\n * .from('needs')`)).toBe(0);
  });
});

describe('client reads of public.needs stay inside the PKG-045b column allowlist', () => {
  it('finds the two production reads (a guard that finds nothing proves nothing)', () => {
    const found = sources.flatMap(path => scanNeedsReads(readFileSync(path, 'utf8')).reads.map(columns => `${relative(root, path).replace(/\\/g, '/')}:${columns.length}`));
    expect(found.sort()).toEqual(['data/myApplicationsClientService.ts:6', 'data/ru4Production.ts:1']);
  });

  it('never selects a private column, a whole row or a wildcard, and never reads a shape it cannot prove', () => {
    for (const path of sources) {
      const { reads, problems } = scanNeedsReads(readFileSync(path, 'utf8'));
      expect({ file: relative(root, path).replace(/\\/g, '/'), problems }).toEqual({ file: relative(root, path).replace(/\\/g, '/'), problems: [] });
      for (const columns of reads) for (const column of columns) expect({ file: relative(root, path).replace(/\\/g, '/'), column, allowed: ALLOWED.has(column) }).toMatchObject({ allowed: true });
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
