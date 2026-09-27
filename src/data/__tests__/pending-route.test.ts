import { pendingRoute } from '../../store/pendingRoute';
const owner = { accountId: 'account-a', accountRevision: 1, sessionEpoch: 1 };

/**
 * A link or a push into a protected route bounces through sign-in. Until this existed the
 * destination was used only to choose the form and then dropped, so a tapped Dogovor became the tab
 * home. These are the rules that keep that from being a new way to lose someone: it answers once,
 * it never answers with the sign-in flow itself, and it does not answer at all after long enough
 * that the person has stopped expecting it.
 */
describe('where the person was going', () => {
  afterEach(() => pendingRoute.clear());

  it('consumes an already delivered cold destination once without resurrecting an Auth fallback', () => {
    const delivery = pendingRoute.remember('/obavestenja');
    pendingRoute.delivered(delivery, owner);
    expect(pendingRoute.takeDecision(owner)).toEqual({ kind: 'DELIVERED' });
    expect(pendingRoute.takeDecision(owner)).toBeNull();
  });
  it('retiring an old push cannot erase a newer destination, including another Inbox tap', () => {
    const old = pendingRoute.remember('/obavestenja');
    pendingRoute.remember('/obavestenja');
    pendingRoute.delivered(old, owner);
    expect(pendingRoute.takeDecision(owner)).toEqual({ kind: 'ROUTE', path: '/obavestenja' });
  });
  it('a newer destination supersedes the delivered tombstone', () => {
    pendingRoute.delivered(pendingRoute.remember('/obavestenja'), owner);
    pendingRoute.remember('/dogovor/new');
    expect(pendingRoute.takeDecision(owner)).toEqual({ kind: 'ROUTE', path: '/dogovor/new' });
  });
  it.each([{ ...owner, accountId: 'account-b' }, { ...owner, accountRevision: 3 }, { ...owner, sessionEpoch: 2 }])('a retired push cannot suppress another session return: %o', current => {
    pendingRoute.delivered(pendingRoute.remember('/obavestenja'), owner);
    expect(pendingRoute.takeDecision(current)).toBeNull();
  });

  it('hands the destination back exactly once', () => {
    pendingRoute.remember('/dogovor/11111111-1111-4111-8111-111111111111');
    expect(pendingRoute.take()).toBe('/dogovor/11111111-1111-4111-8111-111111111111');
    expect(pendingRoute.take()).toBeNull();
  });

  it('keeps only the last destination, because only one of them is still being asked for', () => {
    pendingRoute.remember('/potrebe/1/pregled');
    pendingRoute.remember('/prilike/2');
    expect(pendingRoute.take()).toBe('/prilike/2');
  });

  it.each(['', '/', '/auth', '/auth?form=login', '/oporavak', '/prijave'])(
    'refuses %p, which is the sign-in flow or the shell rather than a destination', path => {
      pendingRoute.remember(path);
      expect(pendingRoute.take()).toBeNull();
    });

  it('forgets a destination the person stopped waiting for', () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    pendingRoute.remember('/dogovori');
    now.mockReturnValue(1_000_000 + 15 * 60_000 + 1);
    expect(pendingRoute.take()).toBeNull();
    now.mockRestore();
  });

  it('still answers inside the window', () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(2_000_000);
    pendingRoute.remember('/dogovori');
    now.mockReturnValue(2_000_000 + 60_000);
    expect(pendingRoute.take()).toBe('/dogovori');
    now.mockRestore();
  });
});
