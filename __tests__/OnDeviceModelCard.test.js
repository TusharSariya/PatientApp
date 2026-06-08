import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import OnDeviceModelCard, { getModelCardStatus } from '../src/gemma/OnDeviceModelCard';
import { ON_DEVICE_MODELS } from '../src/gemma/gemmaConfig';

const gemma3n = ON_DEVICE_MODELS['gemma3n-e2b'];

describe('OnDeviceModelCard', () => {
  test('renders badge, meta, and description', () => {
    render(
      <OnDeviceModelCard
        model={gemma3n}
        selected={false}
        cacheStatus={{ isComplete: false, isPartial: false, exists: false }}
        modelState={{ variant: 'e2b', phase: 'idle', isReady: false, downloadProgress: 0, attempt: 0, maxAttempts: 4 }}
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
        modelState={{ variant: 'gemma3n-e2b', phase: 'idle', isReady: false, downloadProgress: 0, attempt: 0, maxAttempts: 4 }}
        entitlementEnabled={false}
        onPress={onPress}
      />
    );
    expect(screen.getByText('Selected')).toBeTruthy();
    fireEvent.press(screen.getByTestId('on-device-model-card-gemma3n-e2b'));
    expect(onPress).toHaveBeenCalled();
  });

  test('getModelCardStatus reports downloading progress for active variant', () => {
    const status = getModelCardStatus(
      gemma3n,
      { isComplete: false, isPartial: true, exists: true, bytes: 100 },
      { variant: 'gemma3n-e2b', phase: 'downloading', isReady: false, downloadProgress: 0.42, attempt: 1, maxAttempts: 4 }
    );
    expect(status).toBe('Downloading 42%');
  });
});
