import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import OnDeviceModelCard, { getModelCardActions, getModelCardStatus } from '../src/gemma/OnDeviceModelCard';
import { ON_DEVICE_MODELS } from '../src/gemma/gemmaConfig';

const gemma3n = ON_DEVICE_MODELS['gemma3n-e2b'];
const e2b = ON_DEVICE_MODELS.e2b;

const idleState = {
  phase: 'idle',
  isReady: false,
  loadedVariant: null,
  variant: null,
  downloadProgress: 0,
  operation: null,
  error: null,
};

describe('OnDeviceModelCard', () => {
  test('renders badge, meta, and description', () => {
    render(
      <OnDeviceModelCard
        model={gemma3n}
        selected={false}
        cacheStatus={{ isComplete: false, isPartial: false, exists: false }}
        modelState={idleState}
        entitlementEnabled={false}
        onPress={jest.fn()}
      />
    );
    expect(screen.getByText('Gemma 3n E2B')).toBeTruthy();
    expect(screen.getByText('iOS friendly')).toBeTruthy();
    expect(screen.getByText(/Native audio/)).toBeTruthy();
  });

  test('shows selected state and calls onPress', () => {
    const onPress = jest.fn();
    render(
      <OnDeviceModelCard
        model={gemma3n}
        selected
        cacheStatus={{ isComplete: false, isPartial: false, exists: false }}
        modelState={idleState}
        entitlementEnabled={false}
        onPress={onPress}
      />
    );
    expect(screen.getByText('Selected for visits')).toBeTruthy();
    fireEvent.press(screen.getByTestId('on-device-model-card-gemma3n-e2b'));
    expect(onPress).toHaveBeenCalled();
  });

  test('getModelCardStatus reports downloading progress for active operation', () => {
    const status = getModelCardStatus(
      gemma3n,
      { isComplete: false, isPartial: true, exists: true, bytes: 100 },
      {
        ...idleState,
        phase: 'downloading',
        operation: { type: 'download', variant: 'gemma3n-e2b', progress: 0.42, attempt: 1, maxAttempts: 4 },
      }
    );
    expect(status).toBe('Downloading 42%');
  });

  test('getModelCardStatus reports Loaded when in memory', () => {
    const status = getModelCardStatus(
      e2b,
      { isComplete: true, isPartial: false, exists: true },
      { ...idleState, isReady: true, loadedVariant: 'e2b', variant: 'e2b', phase: 'ready' }
    );
    expect(status).toBe('Loaded');
  });

  test('getModelCardActions offers Download when not cached', () => {
    const actions = getModelCardActions(e2b, { isComplete: false, isPartial: false }, idleState);
    expect(actions.primary).toEqual({ label: 'Download', action: 'download', disabled: false });
  });

  test('getModelCardActions offers Load and Delete when downloaded', () => {
    const actions = getModelCardActions(
      e2b,
      { isComplete: true, isPartial: false },
      idleState
    );
    expect(actions.primary).toEqual({ label: 'Load', action: 'load', disabled: false });
    expect(actions.secondary).toEqual({ label: 'Delete', action: 'delete', destructive: true, disabled: false });
  });

  test('getModelCardActions offers Unload when loaded', () => {
    const actions = getModelCardActions(
      e2b,
      { isComplete: true, isPartial: false },
      { ...idleState, isReady: true, loadedVariant: 'e2b' }
    );
    expect(actions.primary).toEqual({ label: 'Unload', action: 'unload' });
  });

  test('download button calls onDownload without selecting card', () => {
    const onDownload = jest.fn();
    const onPress = jest.fn();
    render(
      <OnDeviceModelCard
        model={e2b}
        selected={false}
        cacheStatus={{ isComplete: false, isPartial: false, exists: false }}
        modelState={idleState}
        entitlementEnabled={false}
        onPress={onPress}
        onDownload={onDownload}
      />
    );
    fireEvent.press(screen.getByTestId('e2b-primary-action'));
    expect(onDownload).toHaveBeenCalledWith('e2b');
    expect(onPress).not.toHaveBeenCalled();
  });

  test('hides entitlement warning unless showDevWarnings is true', () => {
    const { rerender } = render(
      <OnDeviceModelCard
        model={e2b}
        selected={false}
        cacheStatus={{ isComplete: false, isPartial: false, exists: false }}
        modelState={idleState}
        entitlementEnabled={false}
        compatibility={{ iosBlocked: true, reasons: ['Needs iOS extended virtual addressing entitlement'] }}
        showDevWarnings={false}
        onPress={jest.fn()}
      />
    );
    expect(screen.queryByTestId('e2b-entitlement-warning')).toBeNull();

    rerender(
      <OnDeviceModelCard
        model={e2b}
        selected={false}
        cacheStatus={{ isComplete: false, isPartial: false, exists: false }}
        modelState={idleState}
        entitlementEnabled={false}
        compatibility={{ iosBlocked: true, reasons: ['Needs iOS extended virtual addressing entitlement'] }}
        showDevWarnings
        onPress={jest.fn()}
      />
    );
    expect(screen.getByTestId('e2b-entitlement-warning')).toBeTruthy();
  });

  test('getModelCardActions offers retry after load failure', () => {
    const actions = getModelCardActions(
      e2b,
      { isComplete: true, isPartial: false },
      {
        ...idleState,
        operation: {
          type: 'load',
          variant: 'e2b',
          error: 'Model file not found.',
        },
      }
    );
    expect(actions.primary).toEqual({ label: 'Retry load', action: 'load', disabled: false });
    expect(actions.busy).toBe(false);
  });

  test('getModelCardStatus reports load failed when operation has error', () => {
    const status = getModelCardStatus(
      e2b,
      { isComplete: true, isPartial: false },
      {
        ...idleState,
        operation: { type: 'load', variant: 'e2b', error: 'Out of memory.' },
      }
    );
    expect(status).toBe('Load failed');
  });

  test('shows progress bar on downloading card even when another variant is loaded', () => {
    render(
      <OnDeviceModelCard
        model={e2b}
        selected={false}
        cacheStatus={{ isComplete: false, isPartial: true, exists: true, bytes: 500 }}
        modelState={{
          ...idleState,
          isReady: true,
          loadedVariant: 'gemma3n-e2b',
          operation: { type: 'download', variant: 'e2b', progress: 0.25, attempt: 1, maxAttempts: 4 },
        }}
        entitlementEnabled={false}
        onPress={jest.fn()}
      />
    );
    expect(screen.getByTestId('e2b-progress-track')).toBeTruthy();
    expect(screen.getByText('Downloading 25%')).toBeTruthy();
  });
});
