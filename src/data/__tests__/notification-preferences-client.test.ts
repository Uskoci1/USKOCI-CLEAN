import { createNotificationPreferencesService } from '../notificationPreferencesClientService';
import type { NotificationSettings } from '../../contracts/notificationPreferences';

jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn() }));

const A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const timestamp = '2026-09-07T09:00:00.000Z';
const defaults = (): NotificationSettings => ({ in_app_enabled: true, push_enabled: false,
  opportunities_enabled: true, responses_enabled: true, dogovor_enabled: true, execution_enabled: true,
  recovery_enabled: true, account_enabled: true, quiet_hours_enabled: false,
  quiet_start: null, quiet_end: null, quiet_timezone: 'Europe/Belgrade', urgent_overrides_quiet_hours: false });
const raw = (settings = defaults(), revision = 0) => ({ userId: A, roleContext: 'REQUESTER',
  exists: revision > 0, revision, updatedAt: revision > 0 ? timestamp : null, settings });
const ok = (data: unknown) => ({ data, error: null });

describe('notification preferences owner/CAS transport', () => {
  it('reads absent defaults without creating a row or silently opting into push', async () => {
    const rpc = jest.fn().mockResolvedValue(ok(raw()));
    const result = await createNotificationPreferencesService(rpc).read(A, 'REQUESTER');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('rpc_get_notification_preferences', { p_expected_user_id: A, p_role: 'REQUESTER' });
    expect(result).toMatchObject({ exists: false, revision: 0, updatedAt: null, settings: { push_enabled: false } });
  });

  it('accepts an existing legacy preference at revision zero', async () => {
    const rpc = jest.fn().mockResolvedValue(ok({ ...raw(), exists: true, updatedAt: timestamp }));
    await expect(createNotificationPreferencesService(rpc).read(A, 'REQUESTER')).resolves.toMatchObject({ exists: true, revision: 0 });
  });

  it('carries the captured account and complete payload through save and exact retry', async () => {
    const settings = { ...defaults(), dogovor_enabled: false, quiet_hours_enabled: true,
      quiet_start: '23:00', quiet_end: '07:15:10.120000' };
    const acknowledged = { ...settings, quiet_start: '23:00:00', quiet_end: '07:15:10.12' };
    const rpc = jest.fn().mockResolvedValue(ok(raw(acknowledged, 4)));
    const service = createNotificationPreferencesService(rpc);
    const first = await service.save(A, 'REQUESTER', settings, 3);
    const retried = await service.save(A, 'REQUESTER', settings, 3);
    expect(retried).toEqual(first);
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
    expect(rpc.mock.calls[0][1]).toEqual({ p_expected_user_id: A, p_role: 'REQUESTER',
      p_settings: acknowledged, p_expected_revision: 3 });
  });

  it('snapshots settings before dispatch so caller edits cannot change the pending write', async () => {
    let finish!: (result: ReturnType<typeof ok>) => void;
    const rpc = jest.fn((_name: string, _args: Record<string, unknown>) =>
      new Promise<ReturnType<typeof ok>>(resolve => { finish = resolve; }));
    const settings = defaults();
    const pending = createNotificationPreferencesService(rpc).save(A, 'REQUESTER', settings, 0);
    settings.push_enabled = true;
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_settings: { push_enabled: false } });
    finish(ok(raw(defaults(), 1)));
    await expect(pending).resolves.toMatchObject({ settings: { push_enabled: false } });
  });

  it.each([
    { ...raw(), userId: B },
    { ...raw(), roleContext: 'WORKER' },
    { ...raw(), revision: Number.MAX_SAFE_INTEGER + 1 },
    { ...raw(), exists: false, revision: 1 },
    { ...raw(), exists: true, updatedAt: null },
    { ...raw(), settings: { ...defaults(), push_enabled: null } },
    { ...raw(), settings: { ...defaults(), unexpected: true } },
  ])('rejects a foreign or malformed server projection %#', async data => {
    await expect(createNotificationPreferencesService(jest.fn().mockResolvedValue(ok(data))).read(A, 'REQUESTER'))
      .rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it.each([
    { ...defaults(), quiet_hours_enabled: true },
    { ...defaults(), quiet_start: '24:00' },
    { ...defaults(), quiet_end: '07:60' },
    { ...defaults(), quiet_start: '01:02:03.1234567' },
    { ...defaults(), quiet_timezone: ' Europe/Belgrade' },
  ])('rejects structurally invalid edits before any request %#', async settings => {
    const rpc = jest.fn();
    await expect(createNotificationPreferencesService(rpc).save(A, 'REQUESTER', settings, 0))
      .rejects.toMatchObject({ code: 'INVALID_SETTINGS' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(['40001', '28000', '22023'])('surfaces server conflict/owner/validation errors without an automatic new write: %s', async code => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: { code, message: 'internal detail must not reach UI' } });
    const expected = { '40001': 'CONFLICT', '28000': 'AUTH_CONTEXT_CHANGED', '22023': 'INVALID_SETTINGS' }[code];
    await expect(createNotificationPreferencesService(rpc).save(A, 'REQUESTER', defaults(), 0))
      .rejects.toMatchObject({ code: expected, message: expected });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('rejects a save acknowledgment with altered values or a different revision', async () => {
    for (const data of [raw({ ...defaults(), push_enabled: true }, 1), raw(defaults(), 2)]) {
      await expect(createNotificationPreferencesService(jest.fn().mockResolvedValue(ok(data))).save(A, 'REQUESTER', defaults(), 0))
        .rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    }
  });

  it('reports uncertain network outcomes without inventing success or incrementing the revision', async () => {
    const rpc = jest.fn().mockRejectedValue(new Error('network lost'));
    await expect(createNotificationPreferencesService(rpc).save(A, 'REQUESTER', defaults(), 4))
      .rejects.toMatchObject({ code: 'UNAVAILABLE' });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1].p_expected_revision).toBe(4);
  });
});
