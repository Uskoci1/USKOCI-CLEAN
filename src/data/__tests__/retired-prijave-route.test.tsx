import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
let mockSession: { isLoaded: boolean; session: object | null; intentReady: boolean };
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession }));
jest.mock('expo-router', () => ({ Redirect: (props: unknown) => require('react').createElement('RetiredRedirect', props as object) }));
import RetiredPrijave from '../../app/prijave';
function render() { let tree!: Renderer.ReactTestRenderer; act(() => { tree = Renderer.create(<RetiredPrijave />); }); return tree; }
describe('retired context-free candidate deep link', () => {
  it.each([false, true])('never opens a fixture while Auth is loading, session=%s', signedIn => {
    mockSession = { isLoaded: false, session: signedIn ? {} : null, intentReady: false };
    expect(render().toJSON()).toBeNull();
  });
  it('routes as soon as Auth is loaded: there is no app mode to restore first', () => {
    // Owner decision 1 (2026-09-19). The route used to hold the person on a blank screen, for up to
    // 1.5 s, until a per-account UI mode had been restored. `intentReady: false` is what an older
    // store would still report, and it no longer holds anything up.
    mockSession = { isLoaded: true, session: {}, intentReady: false };
    expect(render().root.findByType('RetiredRedirect' as never).props.href).toBe('/');
  });
  it('routes an authenticated user to Početna, not a guessed Need', () => {
    mockSession = { isLoaded: true, session: {}, intentReady: true };
    expect(render().root.findByType('RetiredRedirect' as never).props.href).toBe('/');
  });
  it('routes a guest to the existing login', () => {
    mockSession = { isLoaded: true, session: null, intentReady: true };
    expect(render().root.findByType('RetiredRedirect' as never).props.href).toEqual({ pathname: '/auth', params: { form: 'login' } });
  });
  it('has no demo Need, direct read or business action', () => {
    const source = readFileSync(join(__dirname, '../../app/prijave.tsx'), 'utf8');
    expect(source).not.toMatch(/ormar|izvor|supabase|\.rpc\(|useEffect/);
  });
});
