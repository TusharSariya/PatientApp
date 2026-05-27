import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import CurrencySettingsScreen from '../src/CurrencySettingsScreen';
import { SUPPORTED_CURRENCIES } from '../src/currency';
import { getAppSettings, saveAppSettings } from '../src/database';
import { getLastAlertTitle, spyAlert } from './helpers/matrix';

jest.mock('../src/database', () => ({
  getAppSettings: jest.fn(),
  saveAppSettings: jest.fn(),
}));

describe('CurrencySettingsScreen', () => {
  let alertSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = spyAlert();
    getAppSettings.mockResolvedValue({ currencyCode: 'INR' });
    saveAppSettings.mockImplementation(async ({ currencyCode }) => ({ currencyCode, defaultInputMode: 'gestures' }));
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  test.each(
    SUPPORTED_CURRENCIES.filter((c) => c.code !== 'INR').map((c) => [c.code, c.label])
  )('shows and can select %s (%s)', async (code, label) => {
    render(<CurrencySettingsScreen />);
    await waitFor(() => expect(screen.getByText(label)).toBeTruthy());
    fireEvent.press(screen.getByTestId(`currency-option-${code}`));
    await waitFor(() => {
      expect(saveAppSettings).toHaveBeenCalledWith({ currencyCode: code });
    });
  });

  test('shows INR as initially selected without re-saving', async () => {
    render(<CurrencySettingsScreen />);
    await waitFor(() => expect(screen.getByText('Indian Rupee')).toBeTruthy());
    fireEvent.press(screen.getByTestId('currency-option-INR'));
    expect(saveAppSettings).not.toHaveBeenCalled();
  });

  test('shows save error alert', async () => {
    saveAppSettings.mockRejectedValue(new Error('fail'));
    render(<CurrencySettingsScreen />);
    await waitFor(() => expect(screen.getByText('Indian Rupee')).toBeTruthy());
    fireEvent.press(screen.getByTestId('currency-option-USD'));
    await waitFor(() => {
      expect(getLastAlertTitle(alertSpy)).toBe('Error');
    });
  });
});
