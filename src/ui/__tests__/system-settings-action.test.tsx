import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Linking } from 'react-native';
import { SystemSettingsAction } from '../system/SystemSettingsAction';

jest.mock('../v2/V2Action', () => ({ V2Action: (props: unknown) => require('react').createElement('Action', props) }));
let tree: ReactTestRenderer;
const action = () => tree.root.findByType('Action' as React.ElementType);
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
beforeEach(() => jest.useFakeTimers());
afterEach(() => { act(() => tree?.unmount()); jest.restoreAllMocks(); jest.useRealTimers(); });

test('failed native launch is explained at the action and an explicit retry only opens OS settings', async () => {
  const open = jest.spyOn(Linking, 'openSettings').mockRejectedValueOnce(Error('native unavailable')).mockResolvedValue(undefined);
  await act(async () => { tree = create(<SystemSettingsAction />); });
  await act(async () => { action().props.onPress(); await flush(); });
  expect(action().props.error).toContain('Otvaranje podešavanja nije potvrđeno.');
  expect(action().props.loading).toBe(false);
  await act(async () => { action().props.onPress(); await flush(); });
  expect(open).toHaveBeenCalledTimes(2);
  expect(action().props.error).toBeNull();
  expect(action().props.success).toBeUndefined(); // Opening is not permission consent.
});

test('rapid presses launch once and a synchronous bridge error is retryable', async () => {
  let finish!: () => void;
  const open = jest.fn().mockImplementationOnce(() => { throw Error('sync'); })
    .mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  await act(async () => { tree = create(<SystemSettingsAction open={open} />); });
  act(() => action().props.onPress());
  expect(action().props.error).toBeTruthy();
  const launch = action().props.onPress;
  act(() => { launch(); launch(); launch(); });
  expect(open).toHaveBeenCalledTimes(2);
  expect(action().props.loading).toBe(true);
  await act(async () => { finish(); await flush(); });
  expect(action().props.loading).toBe(false);
});

test('an unanswered native call times out and its late failure cannot replace the retry result', async () => {
  const scheduled = jest.spyOn(global, 'setTimeout'), cleared = jest.spyOn(global, 'clearTimeout');
  let reject!: (error: Error) => void;
  const open = jest.fn().mockImplementationOnce(() => new Promise<void>((_, no) => { reject = no; })).mockResolvedValue(undefined);
  await act(async () => { tree = create(<SystemSettingsAction open={open} />); });
  act(() => action().props.onPress());
  const deadline = scheduled.mock.results[scheduled.mock.calls.findIndex(call => call[1] === 10000)].value;
  act(() => jest.advanceTimersByTime(10000));
  expect(action().props.loading).toBe(false);
  expect(action().props.error).toBeTruthy();
  await act(async () => { action().props.onPress(); await flush(); reject(Error('old')); await flush(); });
  expect(open).toHaveBeenCalledTimes(2);
  expect(action().props.error).toBeNull();
  expect(cleared).toHaveBeenCalledWith(deadline);
});

test('unmount retires the pending launch and old press without updating another action', async () => {
  const scheduled = jest.spyOn(global, 'setTimeout'), cleared = jest.spyOn(global, 'clearTimeout');
  let reject!: (error: Error) => void;
  const open = jest.fn(() => new Promise<void>((_, no) => { reject = no; }));
  await act(async () => { tree = create(<SystemSettingsAction open={open} />); });
  const oldPress = action().props.onPress;
  act(() => { oldPress(); tree.unmount(); });
  const deadline = scheduled.mock.results[scheduled.mock.calls.findIndex(call => call[1] === 10000)].value;
  await act(async () => { reject(Error('old')); oldPress(); await flush(); });
  expect(open).toHaveBeenCalledTimes(1);
  expect(cleared).toHaveBeenCalledWith(deadline);
});
