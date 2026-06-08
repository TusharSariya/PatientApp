import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import InputModeSettingsScreen from '../src/InputModeSettingsScreen';
import { INPUT_MODES } from '../src/inputMode';
import { getAppSettings, saveAppSettings } from '../src/database';
import { getLastAlertTitle, spyAlert } from './helpers/matrix';

jest.mock('../src/database', () => ({
  getAppSettings: jest.fn(),
  saveAppSettings: jest.fn(),
}));

describe('InputModeSettingsScreen', () => {
  let alertSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = spyAlert();
    getAppSettings.mockResolvedValue({ currencyCode: 'INR', defaultInputMode: 'gestures' });
    saveAppSettings.mockImplementation(async ({ defaultInputMode }) => ({
      currencyCode: 'INR',
      defaultInputMode,
    }));
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  test.each(
    INPUT_MODES.filter((mode) => mode.id !== 'gestures').map((mode) => [mode.id, mode.title])
  )('saves input mode %s', async (id, title) => {
    render(<InputModeSettingsScreen />);
    await waitFor(() => expect(screen.getByText(title)).toBeTruthy());
    fireEvent.press(screen.getByTestId(`input-mode-option-${id}`));
    await waitFor(() => {
      expect(saveAppSettings).toHaveBeenCalledWith({ defaultInputMode: id });
    });
  });

  test('does not re-save already selected gestures mode', async () => {
    render(<InputModeSettingsScreen />);
    await waitFor(() => expect(screen.getByText('Gestures')).toBeTruthy());
    fireEvent.press(screen.getByTestId('input-mode-option-gestures'));
    expect(saveAppSettings).not.toHaveBeenCalled();
  });

  test('shows gesture setup note when gestures mode is selected', async () => {
    render(<InputModeSettingsScreen />);
    await waitFor(() => expect(screen.getByTestId('gesture-input-mode-note')).toBeTruthy());
    expect(screen.getByText(/Settings → Manage Gestures/)).toBeTruthy();
    expect(screen.getByText(/Use Stream Done while writing/)).toBeTruthy();
  });

  test('hides gesture setup note when another input mode is selected', async () => {
    getAppSettings.mockResolvedValue({ currencyCode: 'INR', defaultInputMode: 'keyboard' });
    render(<InputModeSettingsScreen />);
    await waitFor(() => expect(screen.getByText('Keyboard')).toBeTruthy());
    expect(screen.queryByTestId('gesture-input-mode-note')).toBeNull();
  });

  test('shows save error alert', async () => {
    saveAppSettings.mockRejectedValue(new Error('fail'));
    render(<InputModeSettingsScreen />);
    await waitFor(() => expect(screen.getByText('Keyboard')).toBeTruthy());
    fireEvent.press(screen.getByTestId('input-mode-option-keyboard'));
    await waitFor(() => {
      expect(getLastAlertTitle(alertSpy)).toBe('Error');
    });
  });
});
