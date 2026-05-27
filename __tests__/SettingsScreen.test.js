import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import SettingsScreen from '../src/SettingsScreen';
import { makeNavigation } from './helpers/matrix';

describe('SettingsScreen', () => {
  test.each([
    ['settings-row-clinic', 'ClinicProfile'],
    ['settings-row-currency', 'CurrencySettings'],
    ['settings-row-inputMode', 'InputModeSettings'],
    ['settings-row-gestures', 'ManageGestures'],
  ])('%s navigates to %s', (testID, route) => {
    const navigation = makeNavigation();
    render(<SettingsScreen navigation={navigation} />);
    fireEvent.press(screen.getByTestId(testID));
    expect(navigation.navigate).toHaveBeenCalledWith(route);
  });
});
