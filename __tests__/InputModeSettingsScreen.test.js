import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import InputModeSettingsScreen from '../src/InputModeSettingsScreen';
import { getAppSettings, saveAppSettings } from '../src/database';

jest.mock('../src/database', () => ({
  getAppSettings: jest.fn(),
  saveAppSettings: jest.fn(),
}));

describe('InputModeSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAppSettings.mockResolvedValue({ currencyCode: 'INR', defaultInputMode: 'gestures' });
    saveAppSettings.mockImplementation(async ({ defaultInputMode }) => ({
      currencyCode: 'INR',
      defaultInputMode,
    }));
  });

  test('loads and shows input mode options', async () => {
    render(<InputModeSettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Gestures')).toBeTruthy();
    });

    expect(screen.getByText('Voice')).toBeTruthy();
    expect(screen.getByText('Keyboard')).toBeTruthy();
    expect(screen.getByTestId('input-mode-option-gestures')).toBeTruthy();
  });

  test('saves selected input mode', async () => {
    render(<InputModeSettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Keyboard')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('input-mode-option-keyboard'));

    await waitFor(() => {
      expect(saveAppSettings).toHaveBeenCalledWith({ defaultInputMode: 'keyboard' });
    });
  });
});
