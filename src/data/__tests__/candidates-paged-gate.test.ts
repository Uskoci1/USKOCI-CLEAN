import { CANDIDATES_PAGED_BUILT, candidatesPagedBuilt } from '../candidatesPagedGate';
import { ownApplicationsPagedBuilt } from '../ownApplicationsPagedGate';
import { ownTasksPagedBuilt } from '../ownTasksPagedGate';

/**
 * EX-04 S4 (A11): the applications to a task are read a page at a time only in a build compiled with ONE flag; any other value, a missing value or a look-alike keeps the whole-list read
 * byte for byte, so a build that meets a backend without the package never asks for a page. The three lists have a flag each, so each package can be switched off alone.
 */
describe('the build flag of the paged candidate read', () => {
  const keys = ['EXPO_PUBLIC_EX04_CANDIDATES_PAGED', 'EXPO_PUBLIC_EX04_OWN_APPLICATIONS_PAGED', 'EXPO_PUBLIC_EX04_OWN_TASKS_PAGED'];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const restore = (key: string, value: string | undefined) => { if (value === undefined) delete process.env[key]; else process.env[key] = value; };
  afterEach(() => { keys.forEach(key => restore(key, original[key])); });

  it('is on for exactly the compiled value', () => {
    expect(CANDIDATES_PAGED_BUILT).toBe('1');
    expect(candidatesPagedBuilt('1')).toBe(true);
  });

  it.each([undefined, null, '', '0', 'true', 'TRUE', ' 1', '1 ', 'on', 1, true, false])('is off for %p', value => {
    expect(candidatesPagedBuilt(value)).toBe(false);
  });

  it('reads the build environment when no value is given, and is off by default (Jest, web, every build before the backend has the package)', () => {
    delete process.env.EXPO_PUBLIC_EX04_CANDIDATES_PAGED;
    expect(candidatesPagedBuilt()).toBe(false);
    process.env.EXPO_PUBLIC_EX04_CANDIDATES_PAGED = '1';
    expect(candidatesPagedBuilt()).toBe(true);
    process.env.EXPO_PUBLIC_EX04_CANDIDATES_PAGED = 'yes';
    expect(candidatesPagedBuilt()).toBe(false);
  });

  it('is its own flag: the other two paged lists do not switch the candidates, and the other way round', () => {
    keys.forEach(key => delete process.env[key]);
    process.env.EXPO_PUBLIC_EX04_OWN_TASKS_PAGED = '1'; process.env.EXPO_PUBLIC_EX04_OWN_APPLICATIONS_PAGED = '1';
    expect(ownTasksPagedBuilt()).toBe(true); expect(ownApplicationsPagedBuilt()).toBe(true); expect(candidatesPagedBuilt()).toBe(false);
    keys.forEach(key => delete process.env[key]);
    process.env.EXPO_PUBLIC_EX04_CANDIDATES_PAGED = '1';
    expect(candidatesPagedBuilt()).toBe(true); expect(ownTasksPagedBuilt()).toBe(false); expect(ownApplicationsPagedBuilt()).toBe(false);
  });
});
