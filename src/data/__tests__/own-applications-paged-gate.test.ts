import { OWN_APPLICATIONS_PAGED_BUILT, ownApplicationsPagedBuilt } from '../ownApplicationsPagedGate';
import { ownTasksPagedBuilt } from '../ownTasksPagedGate';

/**
 * EX-04 S2 (B10): "Moje prijave" read a page at a time only in a build compiled with ONE flag; any other value, a missing value or a look-alike keeps the whole-list read byte
 * for byte, so a build that meets a backend without the package never asks for a page. The two lists have a flag each, so each package can be switched off alone.
 */
describe('the build flag of the paged "Moje prijave" read', () => {
  const original = process.env.EXPO_PUBLIC_EX04_OWN_APPLICATIONS_PAGED, other = process.env.EXPO_PUBLIC_EX04_OWN_TASKS_PAGED;
  const restore = (key: string, value: string | undefined) => { if (value === undefined) delete process.env[key]; else process.env[key] = value; };
  afterEach(() => { restore('EXPO_PUBLIC_EX04_OWN_APPLICATIONS_PAGED', original); restore('EXPO_PUBLIC_EX04_OWN_TASKS_PAGED', other); });

  it('is on for exactly the compiled value', () => {
    expect(OWN_APPLICATIONS_PAGED_BUILT).toBe('1');
    expect(ownApplicationsPagedBuilt('1')).toBe(true);
  });

  it.each([undefined, null, '', '0', 'true', 'TRUE', ' 1', '1 ', 'on', 1, true, false])('is off for %p', value => {
    expect(ownApplicationsPagedBuilt(value)).toBe(false);
  });

  it('reads the build environment when no value is given, and is off by default (Jest, web, every build before the backend has the package)', () => {
    delete process.env.EXPO_PUBLIC_EX04_OWN_APPLICATIONS_PAGED;
    expect(ownApplicationsPagedBuilt()).toBe(false);
    process.env.EXPO_PUBLIC_EX04_OWN_APPLICATIONS_PAGED = '1';
    expect(ownApplicationsPagedBuilt()).toBe(true);
    process.env.EXPO_PUBLIC_EX04_OWN_APPLICATIONS_PAGED = 'yes';
    expect(ownApplicationsPagedBuilt()).toBe(false);
  });

  it('is its own flag: the paged tasks of S1 do not switch the applications of S2, and the other way round', () => {
    process.env.EXPO_PUBLIC_EX04_OWN_TASKS_PAGED = '1'; delete process.env.EXPO_PUBLIC_EX04_OWN_APPLICATIONS_PAGED;
    expect(ownTasksPagedBuilt()).toBe(true); expect(ownApplicationsPagedBuilt()).toBe(false);
    process.env.EXPO_PUBLIC_EX04_OWN_APPLICATIONS_PAGED = '1'; delete process.env.EXPO_PUBLIC_EX04_OWN_TASKS_PAGED;
    expect(ownApplicationsPagedBuilt()).toBe(true); expect(ownTasksPagedBuilt()).toBe(false);
  });
});
