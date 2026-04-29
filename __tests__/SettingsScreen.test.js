import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import SettingsScreen from '../src/SettingsScreen';

describe('SettingsScreen', () => {
  test('navigates to manage gestures', () => {
    const navigation = { navigate: jest.fn() };
    render(<SettingsScreen navigation={navigation} />);

    fireEvent.press(screen.getByText('Manage Gestures'));
    expect(navigation.navigate).toHaveBeenCalledWith('ManageGestures');
  });
});
