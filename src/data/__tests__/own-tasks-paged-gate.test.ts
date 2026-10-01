import { OWN_TASKS_PAGED_BUILT, ownTasksPagedBuilt } from '../ownTasksPagedGate';

/**
 * EX-04 S1 (A09): "Moji zadaci" read a page at a time only in a build compiled with ONE flag; any other value, a missing value or a look-alike keeps the
 * whole-list read byte for byte, so a build that meets a backend without the package never asks for a page.
 */
describe('the build flag of the paged "Moji zadaci" read', () => {
  const original = process.env.EXPO_PUBLIC_EX04_OWN_TASKS_PAGED;
  afterEach(() => { if (original === undefined) delete process.env.EXPO_PUBLIC_EX04_OWN_TASKS_PAGED; else process.env.EXPO_PUBLIC_EX04_OWN_TASKS_PAGED = original; });

  it('is on for exactly the compiled value', () => {
    expect(OWN_TASKS_PAGED_BUILT).toBe('1');
    expect(ownTasksPagedBuilt('1')).toBe(true);
  });

  it.each([undefined, null, '', '0', 'true', 'TRUE', ' 1', '1 ', 'on', 1, true, false])('is off for %p', value => {
    expect(ownTasksPagedBuilt(value)).toBe(false);
  });

  it('reads the build environment when no value is given, and is off by default (Jest, web, every build before the backend has the package)', () => {
    delete process.env.EXPO_PUBLIC_EX04_OWN_TASKS_PAGED;
    expect(ownTasksPagedBuilt()).toBe(false);
    process.env.EXPO_PUBLIC_EX04_OWN_TASKS_PAGED = '1';
    expect(ownTasksPagedBuilt()).toBe(true);
    process.env.EXPO_PUBLIC_EX04_OWN_TASKS_PAGED = 'yes';
    expect(ownTasksPagedBuilt()).toBe(false);
  });
});
