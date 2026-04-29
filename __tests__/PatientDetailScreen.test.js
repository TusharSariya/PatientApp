import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import PatientDetailScreen from '../src/PatientDetailScreen';

jest.mock('../src/database', () => ({
  getGestures: jest.fn().mockResolvedValue([]),
}));

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    start: jest.fn(),
    stop: jest.fn(),
  },
  useSpeechRecognitionEvent: jest.fn(),
}));

describe('PatientDetailScreen', () => {
  test('opens dedicated medicines screen from Rx tab', () => {
    const patient = {
      id: 5,
      name: 'Alice Johnson',
      phone: '555-111',
      address: 'One Street',
    };
    const navigation = { navigate: jest.fn() };

    render(<PatientDetailScreen route={{ params: { patient } }} navigation={navigation} />);

    fireEvent.press(screen.getByText('Rx'));
    fireEvent.press(screen.getByText('Open'));

    expect(navigation.navigate).toHaveBeenCalledWith('PatientMedicines', { patient });
    expect(screen.queryByText('No medicines added yet.')).toBeNull();
  });
});
