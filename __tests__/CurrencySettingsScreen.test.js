import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import CurrencySettingsScreen from '../src/CurrencySettingsScreen';
import { getAppSettings, saveAppSettings } from '../src/database';

jest.mock('../src/database', () => ({
  getAppSettings: jest.fn(),
  saveAppSettings: jest.fn(),
}));

describe('CurrencySettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAppSettings.mockResolvedValue({ currencyCode: 'INR' });
    saveAppSettings.mockResolvedValue({ currencyCode: 'USD' });
  });

  test('shows currency options and saves selection', async () => {
    render(<CurrencySettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Indian Rupee')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('currency-option-USD'));

    await waitFor(() => {
      expect(saveAppSettings).toHaveBeenCalledWith({ currencyCode: 'USD' });
    });
  });
});
