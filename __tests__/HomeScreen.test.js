import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import HomeScreen from '../src/HomeScreen';

describe('HomeScreen', () => {
  test('renders key actions and navigates to expected routes', () => {
    const navigation = { navigate: jest.fn() };
    render(<HomeScreen navigation={navigation} />);

    expect(screen.getByText('Patient Manager')).toBeTruthy();
    fireEvent.press(screen.getByText('New Patient'));
    fireEvent.press(screen.getByText('Search Patients'));
    fireEvent.press(screen.getByText('Settings'));

    expect(navigation.navigate).toHaveBeenNthCalledWith(1, 'AddPatient');
    expect(navigation.navigate).toHaveBeenNthCalledWith(2, 'Search');
    expect(navigation.navigate).toHaveBeenNthCalledWith(3, 'Settings');
  });
});
