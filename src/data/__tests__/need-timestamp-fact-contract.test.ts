import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { decodeAiTaskReview, type AiTaskReviewEnvelope } from '../aiTaskReviewClientService';

/**
 * The shape of a TIMESTAMPTZ fact is a contract between two validators that cannot see each
 * other: Postgres writes the value, the client decides whether the whole review envelope is
 * readable. On 2026-09-18 they disagreed. `rpc_ai_open_need_edit_conversation_v2` seeded
 * `need.starts_at` as `v_need.starts_at::text`, which Postgres renders with a space instead of
 * `T` and a `+00` offset instead of `+00:00`. The server's own validator accepted it, the
 * client's rejected it, and because one bad fact discards the entire envelope, every attempt to
 * review a saved draft for publishing rendered a blank screen.
 *
 * These tests pin the exact strings on both sides so the two validators cannot drift again.
 */

const OWNER = '11111111-1111-4111-8111-111111111111';
const CONVERSATION = '22222222-2222-4222-8222-222222222222';
const REVIEW = '33333333-3333-4333-8333-333333333333';
const NEED = '55555555-5555-4555-8555-555555555555';

/** What `to_jsonb(timestamptz)` renders. Proven against canonical DEV on 2026-09-18. */
const ISO_FROM_POSTGRES = '2026-09-18T08:00:00+00:00';
/** What `to_jsonb(timestamptz::text)` rendered, taken verbatim from the live envelope that broke. */
const POSTGRES_TEXT = '2026-09-18 08:00:00+00';

const fact = (key: string, value: string) => ({
  id: null, key, value, displayValue: value, privacyClass: 'PUBLIC', source: 'SYSTEM_DERIVED', status: 'CONFIRMED',
});

/** A complete, otherwise-valid envelope whose only variable is the timestamp string. */
const envelope = (startsAt: string) => ({
  reviewId: REVIEW, accountId: OWNER, conversationId: CONVERSATION, schemaVersion: 'NEED_FACT_V2',
  draftId: NEED, draftRevision: 1,
  displayedContentDigest: 'a'.repeat(64), factsRevision: 'b'.repeat(64), sourceTurnRevision: 0,
  geographyRevision: 'c'.repeat(64), expiresAt: '2026-10-01T00:00:00Z', responseDeadline: null,
  publicProjection: [fact('need.starts_at', startsAt), fact('need.title', 'Prevoz i prenos stvari')],
  ownerPrivateProjection: [],
  location: { taskCountryCode: 'RS', geography: { mode: 'REMOTE' }, exactAddress: null, accessNotes: null, resolvedLocation: null },
  missingRequired: [], canAccept: true, safety: 'REVIEW',
});

it('decodes an envelope whose timestamp is the ISO 8601 string Postgres to_jsonb produces', () => {
  const decoded = decodeAiTaskReview(envelope(ISO_FROM_POSTGRES), OWNER) as AiTaskReviewEnvelope | null;
  expect(decoded).not.toBeNull();
  expect(decoded!.publicProjection.map(f => f.key)).toEqual(['need.starts_at', 'need.title']);
  expect(decoded!.publicProjection[0].value).toBe(ISO_FROM_POSTGRES);
});

it('rejects the Postgres text rendering, and discards the whole envelope when it does', () => {
  // Not merely the one field: the decoder returns null, so the review screen has nothing to draw.
  // This is the amplification that turned a two-character formatting slip into a blank screen.
  expect(decodeAiTaskReview(envelope(POSTGRES_TEXT), OWNER)).toBeNull();
});

it.each([
  ['space instead of T', '2026-09-18 08:00:00+00:00'],
  ['offset without minutes', '2026-09-18T08:00:00+00'],
  ['no offset at all', '2026-09-18T08:00:00'],
  ['date only', '2026-09-18'],
])('rejects a timestamp with %s', (_why, value) => {
  expect(decodeAiTaskReview(envelope(value), OWNER)).toBeNull();
});

it.each([
  ['UTC as Z', '2026-09-18T08:00:00Z'],
  ['positive offset', '2026-09-18T10:00:00+02:00'],
  ['negative offset', '2026-09-18T04:00:00-04:00'],
  ['fractional seconds', '2026-09-18T08:00:00.123456Z'],
])('accepts a timestamp with %s', (_why, value) => {
  expect(decodeAiTaskReview(envelope(value), OWNER)).not.toBeNull();
});

it('no candidate that seeds a draft casts a timestamp fact to text', () => {
  // `supabase/migrations` is the frozen source-147 inventory that the legal source-admission
  // harness pins; changes applied to canonical DEV are recorded in `supabase/candidates`
  // instead. So the candidate is the artifact to assert against.
  const dir = join(__dirname, '..', '..', '..', 'supabase', 'candidates');
  const seeds = /when 'need\.(starts_at|ends_at)' then/;
  const candidates = readdirSync(dir)
    .filter(name => name.endsWith('.sql'))
    .map(name => [name, readFileSync(join(dir, name), 'utf8')] as const)
    .filter(([, sql]) => seeds.test(sql));

  expect(candidates.length).toBeGreaterThan(0);

  for (const [name, sql] of candidates) {
    for (const column of ['starts_at', 'ends_at'] as const) {
      // The assertion is about the executable seeding statement, not about prose: the candidate
      // that fixes this necessarily quotes `starts_at::text` in its own comments and in the
      // guards that check for it, so a whole-file match would fail on the fix itself.
      const found = sql.match(new RegExp(`when 'need\\.${column}' then[\\s\\S]*?end if;`));
      expect(found).not.toBeNull();
      expect(`${name}: ${found![0]}`).toContain(`to_jsonb(v_need.${column})`);
      expect(`${name}: ${found![0]}`).not.toContain(`v_need.${column}::text`);
    }
  }
});
