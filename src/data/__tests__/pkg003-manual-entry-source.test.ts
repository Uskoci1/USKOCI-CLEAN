import fs from 'node:fs';
import path from 'node:path';

const source = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('PKG-003 one New Task entry and manual authority boundaries', () => {
  it('keeps AI-first as primary while exposing a provider-independent manual branch from the same New Task entry', () => {
    const potrebe = source('src/app/(app)/potrebe.tsx');
    const chooser = source('src/app/(app)/novi-zadatak.tsx');
    const manual = source('src/app/(app)/rucni-zadatak.tsx');

    expect(potrebe).toContain("router.navigate('/novi-zadatak')");
    expect(chooser).toContain("router.replace('/nova')");
    expect(chooser).toContain('aiNeedV2Izvor.openConversation(openRequestId)');
    expect(chooser).toContain("pathname: '/rucni-zadatak'");
    expect(chooser.indexOf('Nastavi razgovorom')).toBeLessThan(chooser.indexOf('Unesi ručno'));

    expect(manual).toContain("pathname: '/mesto-zadatka'");
    expect(manual).toContain("pathname: '/fotografije-zadatka'");
    expect(manual).toContain("pathname: '/pregled-zadatka'");
    expect(manual).not.toContain("'/pregled-nacrta'");
  });

  it('never turns manual fallback into the legacy proposer, provider dispatch, second Need writer or publisher', () => {
    const client = source('src/data/manualNeedFactClientService.ts');
    const chooser = source('src/app/(app)/novi-zadatak.tsx');
    const manual = source('src/app/(app)/rucni-zadatak.tsx');
    const sql = source('supabase/candidates/pkg003_manual_need_fact_v2.sql');
    const combined = `${client}\n${chooser}\n${manual}`;

    expect(client).toContain("rpc: 'rpc_set_manual_need_fact_v2'");
    expect(combined).not.toContain('rpc_ai_propose_fact');
    expect(combined).not.toContain('sendMessage(');
    expect(combined).not.toContain('uskoci-ai-interview');

    expect(sql).toContain("v_conv.purpose <> 'NEED_INTAKE'");
    expect(sql).toContain("v_conv.fact_schema_version <> 'NEED_FACT_V2'");
    expect(sql).toContain("v_conv.status <> 'OPEN'");
    expect(sql).toContain("'CONFIRMED', 'EXPLICIT_USER_ANSWER', 'NEED_DRAFT'");
    expect(sql).toContain('CLIENT_REQUEST_ID_REUSED_WITH_DIFFERENT_SNAPSHOT');
    expect(sql).toContain('MANUAL_FACT_USE_LOCATION_EDITOR');
    expect(sql).toContain('MANUAL_FACT_USE_MEDIA_EDITOR');
    expect(sql).toContain('grant execute on function public.rpc_set_manual_need_fact_v2');
    expect(sql).not.toMatch(/insert\s+into\s+public\.needs/i);
    expect(sql).not.toContain('rpc_publish_need_canonical');
    expect(sql).not.toContain('rpc_ai_propose_fact');
  });

  it('registers both manual routes as hidden tab routes, never as new visible navigation zones', () => {
    const layout = source('src/app/(app)/_layout.tsx');
    expect(layout).toContain('<Tabs.Screen name="novi-zadatak" options={{ href: null }} />');
    expect(layout).toContain('<Tabs.Screen name="rucni-zadatak" options={{ href: null }} />');
  });
});
