import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import HomeScreen from '../src/HomeScreen';
import { makeNavigation } from './helpers/matrix';

describe('HomeScreen', () => {
  test.each([
    ['home-card-add-patient', 'AddPatient'],
    ['home-card-search', 'Search'],
    ['home-card-all-visits', 'AllVisits'],
    ['home-card-clinic-profile', 'ClinicProfile'],
    ['home-card-settings', 'Settings'],
  ])('%s navigates to %s', (testID, route) => {
    const navigation = makeNavigation();
    render(<HomeScreen navigation={navigation} />);
    fireEvent.press(screen.getByTestId(testID));
    expect(navigation.navigate).toHaveBeenCalledWith(route);
  });

  test('renders title and subtitle', () => {
    render(<HomeScreen navigation={makeNavigation()} />);
    expect(screen.getByText('Patient Manager')).toBeTruthy();
    expect(screen.getByText('What would you like to do?')).toBeTruthy();
  });
});
