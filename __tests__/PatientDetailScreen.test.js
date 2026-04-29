import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import PatientDetailScreen from '../src/PatientDetailScreen';
import { useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { clearDictationOwner } from '../src/dictationOwner';

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
  const speechHandlers = {};

  beforeEach(() => {
    clearDictationOwner();
    Object.keys(speechHandlers).forEach((key) => {
      delete speechHandlers[key];
    });
    useSpeechRecognitionEvent.mockImplementation((eventName, handler) => {
      speechHandlers[eventName] = handler;
    });
  });

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

  test('dictation inserts into existing field text instead of overwriting', async () => {
    const patient = {
      id: 5,
      name: 'Alice Johnson',
      phone: '555-111',
      address: 'One Street',
    };

    render(<PatientDetailScreen route={{ params: { patient } }} navigation={{ navigate: jest.fn() }} />);

    const notesInput = screen.getByPlaceholderText('—');
    fireEvent.changeText(notesInput, 'existing');
    fireEvent(notesInput, 'selectionChange', { nativeEvent: { selection: { start: 8, end: 8 } } });
    fireEvent.press(screen.getByText('🎙'));
    await waitFor(() => expect(speechHandlers.start).toBeTruthy());

    act(() => {
      speechHandlers.start?.();
      speechHandlers.result?.({ results: [{ transcript: 'fever' }] });
    });

    expect(screen.getByPlaceholderText('—').props.value).toBe('existing fever');
  });
});
