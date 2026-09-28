import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..', '..');
const source = (path: string) => readFileSync(join(root, path), 'utf8');

describe('P5 matching field contract stays connected to the facts the two AI interviews collect', () => {
  const dispatch = source('supabase/migrations/20260829211632_clean_dispatch_engine.sql');
  const selection = source('supabase/migrations/20260906010000_clean_ru5_selection_eligibility_revalidation.sql');
  const materialization = source('supabase/migrations/20260910130851_clean_w02_resolved_location_authority.sql');
  const start = dispatch.indexOf('create or replace function private.match_detail');
  const end = dispatch.indexOf('create or replace function', start + 40);
  const match = dispatch.slice(start, end > start ? end : undefined);

  it('materializes task capability facts into the Need columns matching reads', () => {
    for (const pair of [
      ["need.required_skills", 'required_skills'],
      ["need.required_tools", 'required_tools'],
      ["need.required_vehicles", 'required_vehicles'],
      ["need.required_licenses", 'required_licenses'],
      ["need.people_needed", 'required_slots'],
    ] as const) {
      expect(materialization).toContain(pair[0]); expect(materialization).toContain(pair[1]);
    }
  });

  it('uses worker capabilities, availability and radius for matching instead of profile decoration', () => {
    for (const token of ['p.skills', 'p.tools', 'p.vehicles', 'p.licenses', 'p.radius_km', 'p.available_now',
      'profile_availability_rules', 'profile_availability_windows']) expect(dispatch).toContain(token);
    expect(match).not.toMatch(/p\.display_name\b|p\.bio\b/);
  });

  it('revalidates team capacity at selection rather than pretending it is a ranking score', () => {
    expect(selection).toContain('v_ver.covered_slots > v_profile.team_capacity');
    expect(selection).toContain('TEAM_CAPACITY_EXCEEDED');
    expect(selection).toContain("private.match_detail(p_need_id, v_resp.worker_profile_id)");
  });
});
