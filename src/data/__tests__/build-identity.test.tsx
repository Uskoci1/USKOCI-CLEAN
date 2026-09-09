import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { readBuildIdentity } from '../buildIdentity';
import { BuildIdentity } from '../../ui/BuildIdentity';

const mockConfig = { schemaVersion: 1, version: '1.0.0', sourceCommit: 'a'.repeat(40), sourceDirty: false, backendTarget: 'local' };
jest.mock('expo-constants', () => ({ __esModule: true, default: { get expoConfig() { return { extra: { uskociBuild: mockConfig } }; } } }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View', 'Pressable', 'Text'].includes(String(key)) ? key : Reflect.get(target, key); } });
});

it('uses only the explicitly supported public identity fields', () => {
  expect(readBuildIdentity({ ...mockConfig, secret: 'private', backendRelease: 'untrusted-live-claim' })).toEqual({
    version: '1.0.0', sourceCommit: 'a'.repeat(40), sourceDirty: false, backendTarget: 'local',
  });
});
it.each([null, {}, { ...mockConfig, schemaVersion: 2 }])('does not invent identity when unavailable: %p', raw => {
  expect(readBuildIdentity(raw)).toEqual({ version: null, sourceCommit: null, sourceDirty: null, backendTarget: 'unconfigured' });
});
it('refuses unbounded identity or endpoint fields rather than echoing arbitrary config', () => {
  expect(readBuildIdentity({ schemaVersion: 1, version: '1'.repeat(100) + '.2.3', sourceCommit: 'private-token', sourceDirty: 'false', backendTarget: 'https://private' }))
    .toEqual({ version: null, sourceCommit: null, sourceDirty: null, backendTarget: 'unconfigured' });
});
it('expands in place with an accessible button and no account or network mutation', async () => {
  let tree!: ReactTestRenderer;
  try {
    await act(async () => { tree = create(<BuildIdentity />); });
    const button = () => tree.root.findByType('Pressable' as React.ElementType);
    expect(button().props.accessibilityState).toEqual({ expanded: false });
    expect(JSON.stringify(tree.toJSON())).not.toContain('Lokalno test okruženje');
    await act(async () => button().props.onPress());
    expect(button().props.accessibilityState).toEqual({ expanded: true });
    expect(JSON.stringify(tree.toJSON())).toContain('Lokalno test okruženje');
    expect(JSON.stringify(tree.toJSON())).toContain('a'.repeat(40));
    await act(async () => button().props.onPress());
    expect(button().props.accessibilityState).toEqual({ expanded: false });
  } finally { await act(async () => tree?.unmount()); }
});
