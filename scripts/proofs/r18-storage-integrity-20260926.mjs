import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

// One bounded client-only repair. No database, provider, device or deployment access.
const route = 'src/app/(app)/prilike/[id]/prijava.tsx';
const journal = 'src/data/applicationCommandJournal.ts';
const routeTest = 'src/data/__tests__/application-composer-read.test.tsx';
const journalTest = 'src/data/__tests__/application-command-journal.test.ts';
const expected = {
  [route]: 'de036eeb65010a3b20dcde21620ed1717bda0a7d',
  [journal]: '8a026828852c38e05aa459827895dd13557487a3',
  [routeTest]: '8a323b3d84ef4155b64f62a694e4113353d98e93',
  [journalTest]: '7354d10ab5e2ef36004b7f07034c4b6ebec55f15',
};
const read = path => readFileSync(path, 'utf8');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const sha = value => createHash('sha256').update(value).digest('hex');
function original(path) { assert.equal(git('hash-object', path), expected[path], `Source changed: ${path}`); }
function replaceOnce(text, from, to) {
  assert.equal(text.split(from).length, 2, `Expected exactly one source anchor: ${from.slice(0, 100)}`);
  return text.replace(from, to);
}

const routeCases = String.raw`

// R18 storage integrity: real route + durable journal, with only the native storage boundary mocked.
import { applicationCommandJournal as durableJournal } from '../applicationCommandJournal';
describe('R18 storage integrity', () => {
  const storage = jest.requireMock('@react-native-async-storage/async-storage').default as {
    getItem: jest.Mock; setItem: jest.Mock; removeItem: jest.Mock;
  };
  const key = () => 'uskoci.application.command.v1.owner-a.' + mockId;
  const refusal = () => ({ ok: false, kod: 'WORKER_NOT_ELIGIBLE',
    poruka: 'Radni profil ili dostupnost ne ispunjavaju uslove Zadatka.',
    applicationRefusal: true, hardBlockers: ['MISSING_REQUIRED_TOOL'] });
  const unknown = { ok: false, kod: 'APPLICATION_SELECTION_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' };
  const rejectedOffer = async () => { mockSubmit.mockResolvedValueOnce(refusal()); await offer(); await sendOffer(); };
  const form = () => tree!.root.findAll(node => String(node.type) === 'TextInput');
  const presentation = () => tree!.root.findByType(ApplicationSelectionPresentation);

  it('failed retirement keeps the refused command and never opens a new offer until storage succeeds', async () => {
    await rejectedOffer(); const bytes = mockStorage.get(key());
    storage.removeItem.mockRejectedValueOnce(new Error('private storage failure'));
    await tap('Sastavi novu ponudu');
    expect(mockStorage.get(key())).toBe(bytes);
    expect(form()).toHaveLength(0);
    expect(press('Pregledaj ponudu')).toBeUndefined();
    expect(press('Sastavi novu ponudu')).toBeDefined();
    expect(text()).not.toContain('private storage failure');
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    await tap('Sastavi novu ponudu');
    expect(mockStorage.has(key())).toBe(false);
    expect(press('Pregledaj ponudu')).toBeDefined();
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });

  it('double reset waits for one durable removal and an old reset cannot erase the next pending offer', async () => {
    await rejectedOffer(); const first = mockSubmit.mock.calls[0][0];
    const gate = deferred();
    storage.removeItem.mockImplementationOnce(async (storageKey: string) => {
      await gate.promise; mockStorage.delete(storageKey);
    });
    const oldReset = press('Sastavi novu ponudu');
    await act(async () => { oldReset(); oldReset(); });
    expect(storage.removeItem).toHaveBeenCalledTimes(1);
    expect(form()).toHaveLength(0);
    expect(mockStorage.has(key())).toBe(true);
    await act(async () => { await presentation().props.submit(); });
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    await act(async () => gate.resolve(undefined));
    expect(press('Pregledaj ponudu')).toBeDefined();
    mockSubmit.mockResolvedValueOnce(unknown);
    await sendOffer();
    const second = mockSubmit.mock.calls[1][0];
    expect(second.clientRequestId).not.toBe(first.clientRequestId);
    const bytes = mockStorage.get(key());
    await act(async () => { oldReset(); oldReset(); });
    expect(mockStorage.get(key())).toBe(bytes);
    expect(storage.removeItem).toHaveBeenCalledTimes(1);
    expect(mockSubmit).toHaveBeenCalledTimes(2);
  });

  it('a failed retirement read cannot be mistaken for an absent journal', async () => {
    await rejectedOffer(); const bytes = mockStorage.get(key());
    storage.getItem.mockRejectedValueOnce(new Error('private disk read'));
    await tap('Sastavi novu ponudu');
    expect(form()).toHaveLength(0);
    expect(mockStorage.get(key())).toBe(bytes);
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(text()).not.toContain('private disk read');
    await tap('Sastavi novu ponudu');
    expect(press('Pregledaj ponudu')).toBeDefined();
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });

  it('a removal acknowledgement without actual deletion cannot unlock the composer', async () => {
    await rejectedOffer(); const bytes = mockStorage.get(key());
    storage.removeItem.mockResolvedValueOnce(undefined);
    await tap('Sastavi novu ponudu');
    expect(mockStorage.get(key())).toBe(bytes);
    expect(press('Pregledaj ponudu')).toBeUndefined();
    expect(form()).toHaveLength(0);
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });

  it('leaving while retirement reads storage prevents the old callback from deleting the command', async () => {
    await rejectedOffer(); const bytes = mockStorage.get(key())!;
    const gate = deferred(); storage.getItem.mockReturnValueOnce(gate.promise);
    await tap('Sastavi novu ponudu');
    mockFocused = false; await update();
    await act(async () => gate.resolve(bytes));
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(mockStorage.get(key())).toBe(bytes);
    mockFocused = true; await update();
    expect(press('Sastavi novu ponudu')).toBeDefined();
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });

  it('unknown offer survives profile return and remount with the exact original request and terms', async () => {
    mockSubmit.mockResolvedValueOnce(unknown);
    await offer(); await edit('Kratka napomena', 'Sačuvaj ovu tačnu ponudu.'); await sendOffer();
    const first = mockSubmit.mock.calls[0][0];
    await tap('Dopuni radni profil');
    mockFocused = false; await update();
    mockNeed.mockResolvedValue({ ...need(), revizija: 4 });
    mockProfile.mockResolvedValue({ id: first.radnikProfilId, stanje: 'ACTIVE', alati: ['Telefon'] });
    mockFocused = true; await update();
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(press('Sastavi novu ponudu')).toBeUndefined();
    expect(form()).toHaveLength(0);
    await act(async () => tree!.unmount()); tree = undefined; await render();
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(text()).toContain('Sačuvaj ovu tačnu ponudu.');
    await tap('Ponovi istu Prijavu');
    expect(mockSubmit.mock.calls[1][0]).toEqual(first);
  });

  it('a corrected profile does not silently replace a refused offer; only explicit reset uses fresh terms', async () => {
    await rejectedOffer(); const first = mockSubmit.mock.calls[0][0];
    await tap('Dopuni radni profil'); mockFocused = false; await update();
    mockNeed.mockResolvedValue({ ...need(), revizija: 4 });
    mockProfile.mockResolvedValue({ id: first.radnikProfilId, stanje: 'ACTIVE', alati: ['Telefon'] });
    mockFocused = true; await update();
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockStorage.get(key())!).command).toEqual(first);
    await tap('Sastavi novu ponudu');
    await sendOffer();
    expect(mockSubmit.mock.calls[1][0]).toMatchObject({ cenaRsd: first.cenaRsd, pokrivenaMesta: first.pokrivenaMesta, potrebaRevizija: 4 });
    expect(mockSubmit.mock.calls[1][0].clientRequestId).not.toBe(first.clientRequestId);
  });

  it('accepted receipt remains accepted when cleanup fails; cold recovery replays only the same command', async () => {
    storage.removeItem.mockRejectedValueOnce(new Error('private cleanup detail'));
    await offer(); await sendOffer(); const first = mockSubmit.mock.calls[0][0];
    expect(text()).toContain('Prijava je poslata.');
    expect(text()).not.toContain('private cleanup detail');
    expect(mockStorage.has(key())).toBe(true);
    await act(async () => tree!.unmount()); tree = undefined; await render();
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    await tap('Ponovi istu Prijavu');
    expect(mockSubmit.mock.calls[1][0]).toEqual(first);
    expect(mockStorage.has(key())).toBe(false);
  });

  it('a newer journal from another retained editor is not cleared by an older refused offer', async () => {
    await rejectedOffer(); const first = mockSubmit.mock.calls[0][0];
    await durableJournal.clear('owner-a', mockId!, first.clientRequestId);
    const second = { ...first, clientRequestId: first.clientRequestId + '_newer' };
    await durableJournal.save({ version: 1, accountId: 'owner-a', needId: mockId!, command: second });
    const bytes = mockStorage.get(key()); storage.removeItem.mockClear();
    await tap('Sastavi novu ponudu');
    expect(mockStorage.get(key())).toBe(bytes);
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(press('Pregledaj ponudu')).toBeUndefined();
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });
});
`;

const journalCases = String.raw`

describe('R18 storage journal boundary', () => {
  it.each([
    ['price', { cenaRsd: 9900 }], ['people', { pokrivenaMesta: 1 }],
    ['note', { napomena: 'Different terms' }], ['revision', { potrebaRevizija: 4 }],
    ['profile', { radnikProfilId: OTHER }], ['interval', { predlozeniKraj: '2026-09-20T10:00:00Z' }],
  ])('same key rejects changed %s without overwriting the stored intent', async (_label, delta) => {
    await applicationCommandJournal.save(record); const bytes = mockStorage.get(KEY);
    await expect(applicationCommandJournal.save({ ...record, command: { ...command, ...delta } }))
      .rejects.toThrow('APPLICATION_COMMAND_PAYLOAD_CHANGED');
    expect(mockStorage.get(KEY)).toBe(bytes); expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });
  it('corrupt state needs the explicit corrupt-state exit, not silent replacement by save', async () => {
    mockStorage.set(KEY, 'corrupt');
    await expect(applicationCommandJournal.save(record)).rejects.toThrow('APPLICATION_COMMAND_JOURNAL_INVALID');
    expect(mockStorage.get(KEY)).toBe('corrupt'); expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
  it('failed removal propagates and a later same-command retry can prove retirement', async () => {
    await applicationCommandJournal.save(record);
    AsyncStorage.removeItem.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(applicationCommandJournal.clear(A, NEED, command.clientRequestId)).rejects.toThrow('storage unavailable');
    expect(mockStorage.has(KEY)).toBe(true);
    await expect(applicationCommandJournal.clear(A, NEED, command.clientRequestId)).resolves.toBe(true);
    expect(mockStorage.has(KEY)).toBe(false);
  });
  it('mismatched or corrupt state is not a successful retirement', async () => {
    await applicationCommandJournal.save(record);
    await expect(applicationCommandJournal.clear(A, NEED, 'another_request_key')).resolves.toBe(false);
    mockStorage.set(KEY, 'corrupt');
    await expect(applicationCommandJournal.clear(A, NEED, command.clientRequestId)).resolves.toBe(false);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });
  it('two concurrent retirements remove once and both observe absence', async () => {
    await applicationCommandJournal.save(record);
    expect(await Promise.all([applicationCommandJournal.clear(A, NEED, command.clientRequestId),
      applicationCommandJournal.clear(A, NEED, command.clientRequestId)])).toEqual([true, true]);
    expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(1);
  });
  it('removal resolution alone is not proof that native storage became empty', async () => {
    await applicationCommandJournal.save(record);
    AsyncStorage.removeItem.mockResolvedValueOnce(undefined);
    await expect(applicationCommandJournal.clear(A, NEED, command.clientRequestId)).resolves.toBe(false);
    expect(mockStorage.has(KEY)).toBe(true);
  });
  it('a delayed old acknowledgement cannot delete a new command queued behind it', async () => {
    await applicationCommandJournal.save(record);
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    AsyncStorage.removeItem.mockImplementationOnce(async (storageKey: string) => { await gate; mockStorage.delete(storageKey); });
    const clearing = applicationCommandJournal.clear(A, NEED, command.clientRequestId);
    const second = { ...record, command: { ...command, clientRequestId: 'prijava_newer_00000000' } };
    const saving = applicationCommandJournal.save(second);
    release(); await clearing; await saving;
    await expect(applicationCommandJournal.clear(A, NEED, command.clientRequestId)).resolves.toBe(false);
    expect(JSON.parse(mockStorage.get(KEY)!)).toEqual(second);
  });
});
`;

function addTests() {
  for (const path of [route, journal, routeTest, journalTest]) original(path);
  writeFileSync(routeTest, read(routeTest) + routeCases);
  writeFileSync(journalTest, read(journalTest) + journalCases);
}
function patch() {
  original(route); original(journal);
  let j = read(journal);
  j = replaceOnce(j,
    "      // An unresolved earlier command is never silently replaced by a new key.\n      if (old.state === 'PRESENT' && old.record.command.clientRequestId !== next.command.clientRequestId) throw new Error('APPLICATION_COMMAND_UNRESOLVED');",
    "      // Preserve the exact intent, not only its request key. Corrupt state needs its explicit exit.\n      if (old.state === 'CORRUPT') throw new Error('APPLICATION_COMMAND_JOURNAL_INVALID');\n      if (old.state === 'PRESENT') {\n        if (old.record.command.clientRequestId !== next.command.clientRequestId) throw new Error('APPLICATION_COMMAND_UNRESOLVED');\n        if (commandKeys.some(key => old.record.command[key] !== next.command[key])) throw new Error('APPLICATION_COMMAND_PAYLOAD_CHANGED');\n      }");
  j = replaceOnce(j,
    "  clear: async (accountId: string, needId: string, clientRequestId: string) => queue(scope(accountId, needId), async () => {\n    const old = await read(accountId, needId);\n    if (old.state === 'PRESENT' && old.record.command.clientRequestId === clientRequestId) await AsyncStorage.removeItem(storageKey(accountId, needId));\n  }),",
    "  clear: async (accountId: string, needId: string, clientRequestId: string, current: () => boolean = () => true): Promise<boolean> => queue(scope(accountId, needId), async () => {\n    const old = await read(accountId, needId);\n    if (!current()) throw new Error('APPLICATION_COMMAND_SCOPE_CHANGED');\n    if (old.state === 'ABSENT') return true;\n    if (old.state !== 'PRESENT' || old.record.command.clientRequestId !== clientRequestId) return false;\n    await AsyncStorage.removeItem(storageKey(accountId, needId));\n    // Keep the per-scope queue until absence is observed, so a queued newer save cannot be removed by this acknowledgement.\n    return (await read(accountId, needId)).state === 'ABSENT';\n  }),");
  writeFileSync(journal, j);
  let r = read(route);
  r = replaceOnce(r,
    "const NOT_SAVED_ON_DEVICE = 'Zahtev nije sačuvan na uređaju. Oslobodi prostor i pokušaj ponovo.';",
    "const NOT_SAVED_ON_DEVICE = 'Zahtev nije sačuvan na uređaju. Oslobodi prostor i pokušaj ponovo.';\nconst NOT_RETIRED_ON_DEVICE = 'Stari zahtev nije uklonjen sa uređaja. Pokušaj ponovo; nova ponuda još nije otvorena.';");
  r = replaceOnce(r, "journaling: false, notice: null as string | null", "journaling: false, resetting: false, notice: null as string | null");
  r = replaceOnce(r, "if (current() && !session.reading && !session.pending?.inFlight) void editor.refresh();",
    "if (current() && !session.reading && !session.pending?.inFlight && !session.resetting && !session.journaling) void editor.refresh();");
  r = replaceOnce(r,
    "if (!current() || !data || !session.draft || session.pending?.inFlight || session.journaling || !accountId) return;",
    "if (!current() || !data || !session.draft || session.pending?.inFlight || session.journaling || session.resetting || session.reading || editor.busy || editor.uncertain || !accountId) return;\n    if (session.pending?.result && conclusiveApplicationRefusal(session.pending.result)) return;");
  r = replaceOnce(r,
    "  const reset = pending && refusal && !editor.uncertain ? () => {\n    if (!current() || editor.busy || pending.inFlight || session.pending !== pending || !pending.result || pending.result.ok) return;\n    if (user?.id) void applicationCommandJournal.clear(user.id, pending.command.potrebaId, pending.command.clientRequestId).catch(() => undefined);\n    session.pending = null;\n    session.draft = withTaskPrice(session.draft!, data.need);\n    setValidation(null); void editor.refresh();\n  } : undefined;",
    "  const reset = pending && refusal && !editor.uncertain ? async () => {\n    if (!current() || !user?.id || editor.busy || pending.inFlight || session.pending !== pending || pending.result !== refusal || session.resetting || session.journaling || session.reading) return;\n    const ownsReset = () => current() && session.pending === pending && pending.result === refusal && !pending.inFlight;\n    // Synchronous latch also fences two retained callbacks in the same event turn.\n    session.resetting = true; render(v => v + 1);\n    try {\n      const retired = await applicationCommandJournal.clear(user.id, pending.command.potrebaId, pending.command.clientRequestId, ownsReset);\n      if (!ownsReset()) return;\n      if (!retired) { setValidation(NOT_RETIRED_ON_DEVICE); return; }\n      session.pending = null;\n      session.draft = withTaskPrice(session.draft!, data.need);\n      setValidation(null);\n      await editor.refresh();\n    } catch { if (ownsReset()) setValidation(NOT_RETIRED_ON_DEVICE); }\n    finally {\n      session.resetting = false;\n      if (session.focused && currentAccount()) render(v => v + 1);\n    }\n  } : undefined;");
  r = replaceOnce(r, "if (current() && !editor.busy && !session.pending)", "if (current() && !editor.busy && !session.pending && !session.resetting && !session.journaling)");
  r = replaceOnce(r, "busy={editor.busy || !!pending?.inFlight}", "busy={editor.busy || !!pending?.inFlight || session.resetting || session.journaling}");
  r = replaceOnce(r, "refreshHelps={validation !== NOT_SAVED_ON_DEVICE}", "refreshHelps={validation !== NOT_SAVED_ON_DEVICE && validation !== NOT_RETIRED_ON_DEVICE}");
  writeFileSync(route, r);
  git('diff', '--check');
}
function proveBaseline(dir) {
  const result = JSON.parse(read(dir + '/baseline.json'));
  assert.ok(result.numFailedTests > 0, 'Regression must fail against the unchanged source');
  const failed = result.testResults.flatMap(suite => suite.assertionResults ?? []).filter(test => test.status === 'failed');
  assert.ok(failed.some(test => test.fullName.includes('failed retirement keeps')), 'Missing red proof for route retirement');
  assert.ok(failed.some(test => test.fullName.includes('same key rejects changed')), 'Missing red proof for exact payload');
  console.log(JSON.stringify({ baselineFailed: result.numFailedTests, baselinePassed: result.numPassedTests, confirmedOriginalDefects: true }));
}
function recordEvidence(dir) {
  const baseline = JSON.parse(read(dir + '/baseline.json'));
  const focused = JSON.parse(read(dir + '/focused.json'));
  const full = JSON.parse(read(dir + '/full.json'));
  for (const result of [focused, full]) {
    assert.equal(result.success, true); assert.equal(result.numFailedTests, 0); assert.equal(result.numPendingTests, 0);
  }
  assert.ok(full.numPassedTests > 6334); assert.equal(read(dir + '/types.ok').trim(), 'PASS');
  git('add', '--', route, journal, routeTest, journalTest);
  const testedTree = git('write-tree');
  const runtimeBlobs = Object.fromEntries([route, journal, routeTest, journalTest].map(path => [path, git('hash-object', path)]));
  const summary = result => ({ suites: result.numPassedTestSuites, passed: result.numPassedTests, failed: result.numFailedTests, pending: result.numPendingTests });
  const evidence = {
    package: 'R18_STORAGE_INTEGRITY', status: 'CLIENT_CI_PASS_DEVICE_PENDING',
    baselineSource: '9d011d332672fba36ffe621bfcb5671a529ae455', candidateBase: process.env.GITHUB_SHA,
    testedTree, runtimeBlobs, checkedAt: new Date().toISOString(), workflowRunId: process.env.GITHUB_RUN_ID,
    workflowUrl: `https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/${process.env.GITHUB_RUN_ID}`,
    types: 'PASS', baseline: summary(baseline), focused: summary(focused), full: summary(full),
    artifactHashes: Object.fromEntries(['baseline.json', 'focused.json', 'full.json'].map(path => [path, sha(read(dir + '/' + path))])),
    devApplied: false, edgeApplied: false, providerCalled: false, pushSent: false,
    freshDevRead: 'BLOCKED_BY_TOOL_NOT_VERIFIED', deviceAcceptance: 'NOT_PERFORMED',
    dashboardRemotePublication: 'NOT_PERFORMED', sqlParityClaimed: false,
  };
  const base = 'docs/implementation/release-hardening-20260926/';
  mkdirSync(base, { recursive: true });
  writeFileSync(base + 'STORAGE_INTEGRITY_CHECKS.json', JSON.stringify(evidence, null, 2) + '\n');
  const report = `# R18 — bezbedno povlačenje lokalnog zahteva\n\nStatus: **CLIENT_CI_PASS_DEVICE_PENDING**.\n\n## Potvrđeno pre izmene\n\nNovi testovi su pokrenuti na neizmenjenom kodu i pali: ${baseline.numFailedTests} padova. Reset je otvarao novu ponudu pre potvrde uklanjanja starog zahteva, gutao storage greške, a save je dopuštao promenu sadržaja pod istim request ID-em. Prolazni testovi nisu uklonjeni ili oslabljeni.\n\n## Popravka\n\nReset sada čeka dokazanu odsutnost tačnog zapisa, sa zaključavanjem dvostrukog pritiska i proverom fokusa/naloga. Greška čitanja/brisanja ili drugi sačuvani zahtev ne otvaraju novu ponudu. Per-account/Need red ne pušta noviji save dok se provera odsutnosti ne završi. Isti request ID ne može da dobije druge uslove; korumpiran zapis traži ranije postojeći eksplicitni izlaz. Uspešna serverska potvrda ostaje uspešna i kada lokalno čišćenje ne uspe; hladni oporavak ponavlja samo isti originalni zahtev.\n\n## Dokazi\n\nTypeScript PASS. Ciljano: ${focused.numPassedTests}/${focused.numTotalTests}. Ceo Jest: ${full.numPassedTests}/${full.numTotalTests}, ${full.numPassedTestSuites} grupa. [CI](${evidence.workflowUrl}). Tačan testirani tree i blobovi su u STORAGE_INTEGRITY_CHECKS.json; završni commit dodaje izveštaj, bez novih promena testiranog koda.\n\n## Granice\n\nBez DEV/Edge/SQL/provider/push izmena i bez novih test naloga. Nova read-only DEV provera u razgovoru blokirana je alatom i NIJE smatrana osveženim dokazom. Postojeći dev_snapshot.json nije menjan. Istorijski PKG-006 SQL rezultat nije dokaz live202 jednakosti. Fizički telefon, APK instalacija i store prihvatanje nisu izvedeni ovim testovima.\n\nSledeće: APK sa tačnim source bindingom; posebno odobren profil → povratak → prijava i prekid na telefonu. Media i stvarni push i dalje čekaju eksplicitno primeni. Spoljni Artifact prikaz nije objavljen; postojeća tabla je samo regenerisana.\n`;
  writeFileSync(base + 'STORAGE_INTEGRITY.md', report);
  const rowsPath = 'docs/control/redovi.json'; const rows = JSON.parse(read(rowsPath));
  const b09 = rows.redovi.find(row => row.id === 'B09'); assert.ok(b09);
  b09.problem += ' 26.09 STORAGE: reset/storage race i promena sadržaja pod istim ključem popravljeni i dokazani red→green testovima; telefon ostaje neproveren. ' + base + 'STORAGE_INTEGRITY.md';
  b09.sledece = 'Napraviti i proveriti tačan APK: profil/povratak, prekid, ponavljanje i lokalna storage greška. Ne ponavljati dokazanu client popravku niti zvati je proverom na telefonu. Dokaz: ' + base + 'STORAGE_INTEGRITY_CHECKS.json. ' + (b09.sledece ?? '');
  writeFileSync(rowsPath, JSON.stringify(rows, null, 2) + '\n');
  const nextPath = 'docs/implementation/design-system/r19-task-agreement-20260925/NEXT.md';
  let next = read(nextPath);
  next = replaceOnce(next, 'No DEV/Edge change or real push was made.\n', 'No DEV/Edge change or real push was made.\n\n   Storage follow-up: the exact journal/reset race is now covered by failing-before/passing-after tests. Read `docs/implementation/release-hardening-20260926/STORAGE_INTEGRITY.md` and `STORAGE_INTEGRITY_CHECKS.json`. Reset awaits confirmed removal, preserves scope and pending identity on errors, and the journal rejects changed payload under the same key. Exact APK/profile-return acceptance remains pending; do not reimplement this tested client fix.\n');
  writeFileSync(nextPath, next);
  let agents = read('AGENTS.md');
  agents = replaceOnce(agents, '# USKOČI — repository entry map\n', '# USKOČI — repository entry map\n\nR18 STORAGE INTEGRITY CLIENT CI PASS (2026-09-26): read `docs/implementation/release-hardening-20260926/STORAGE_INTEGRITY.md` and matching CHECKS. Reset now awaits durable retirement; double/late callbacks cannot release or erase another intent; same-key changed payload is rejected. Failing-before/passing-after tests and full Jest are recorded. Device/APK remains pending. No DEV/Edge/provider/push change; fresh DEV read was tool-blocked.\n');
  writeFileSync('AGENTS.md', agents);
  writeFileSync(dir + '/summary.json', JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ status: evidence.status, focused: evidence.focused, full: evidence.full, testedTree }));
}
const mode = process.argv[2], dir = process.argv[3] ?? '/tmp/r18-storage';
if (mode === 'tests') addTests();
else if (mode === 'patch') patch();
else if (mode === 'baseline') proveBaseline(dir);
else if (mode === 'record') recordEvidence(dir);
else throw new Error('Use tests, patch, baseline or record');
