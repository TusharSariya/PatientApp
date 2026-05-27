import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { getAppSettings, getGestures, subscribeAppSettings } from '../src/database';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { clearDictationOwner } from '../src/dictationOwner';
import { drawPreset } from './helpers/gesturePadSim';
import { seedColdGestureRow } from './helpers/seedGestures';
import GestureFieldHarness, { renderGestureHarness } from './helpers/GestureFieldHarness';
import { INPUT_MODE_IDS } from './helpers/matrix';

jest.mock('../src/database', () => ({
  getAppSettings: jest.fn(),
  getGestures: jest.fn(),
  subscribeAppSettings: jest.fn(),
}));

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  },
  useSpeechRecognitionEvent: jest.fn(),
}));

describe('inputModeGestureMatrix', () => {
  const speechHandlers = {};
  let settingsListener;

  beforeEach(() => {
    clearDictationOwner();
    jest.clearAllMocks();
    Object.keys(speechHandlers).forEach((key) => delete speechHandlers[key]);

    getAppSettings.mockResolvedValue({ currencyCode: 'INR', defaultInputMode: 'gestures' });
    getGestures.mockResolvedValue(seedColdGestureRow());
    subscribeAppSettings.mockImplementation((listener) => {
      settingsListener = listener;
      return jest.fn();
    });
    useSpeechRecognitionEvent.mockImplementation((eventName, handler) => {
      speechHandlers[eventName] = handler;
    });
    ExpoSpeechRecognitionModule.requestPermissionsAsync.mockResolvedValue({ granted: true });
  });

  describe.each(INPUT_MODE_IDS)('input mode %s', (mode) => {
    beforeEach(() => {
      getAppSettings.mockResolvedValue({ currencyCode: 'INR', defaultInputMode: mode });
    });

    test('focus behavior matches mode', async () => {
      renderGestureHarness({ initialValue: 'Symptoms' });
      await waitFor(() => expect(getAppSettings).toHaveBeenCalled());

      fireEvent(screen.getByTestId('gesture-field-input'), 'focus');

      if (mode === 'keyboard') {
        expect(screen.queryByText('Gesture Input')).toBeNull();
        expect(screen.getByTestId('gesture-field-input').props.showSoftInputOnFocus).toBe(true);
      } else {
        await waitFor(() => expect(screen.getByText('Gesture Input')).toBeTruthy());
        if (mode === 'voice') {
          await waitFor(() => {
            expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalled();
          });
        }
      }
    });
  });

  describe('gestures mode interactions', () => {
    test('matched gesture inserts word', async () => {
      renderGestureHarness({ initialValue: 'Symptoms' });
      await waitFor(() => expect(getAppSettings).toHaveBeenCalled());
      fireEvent.press(screen.getByTestId('open-gesture-input'));
      await waitFor(() => expect(screen.getByTestId('gesture-pad')).toBeTruthy());
      await waitFor(() => expect(getGestures).toHaveBeenCalled());

      drawPreset(screen.getByTestId('gesture-pad'), 'horizontal');

      await waitFor(() => {
        expect(screen.getByTestId('gesture-field-input-value').props.children).toBe('Symptoms cold');
      });
    });

    test('undo and invert gesture modify text', async () => {
      renderGestureHarness({ initialValue: 'Symptoms' });
      fireEvent.press(screen.getByTestId('open-gesture-input'));
      await waitFor(() => expect(screen.getByTestId('gesture-pad')).toBeTruthy());
      drawPreset(screen.getByTestId('gesture-pad'), 'horizontal');
      await waitFor(() => {
        expect(screen.getByTestId('gesture-field-input-value').props.children).toBe('Symptoms cold');
      });

      fireEvent.press(screen.getByTestId('gesture-undo'));
      expect(screen.getByTestId('gesture-field-input-value').props.children).toBe('Symptoms');

      drawPreset(screen.getByTestId('gesture-pad'), 'horizontal');
      await waitFor(() => {
        expect(screen.getByTestId('gesture-field-input-value').props.children).toBe('Symptoms cold');
      });
      fireEvent.press(screen.getByTestId('gesture-invert'));
      expect(screen.getByTestId('gesture-field-input-value').props.children).toBe('Symptoms no cold');
    });

    test('no-match vertical path leaves text unchanged', async () => {
      renderGestureHarness({ initialValue: 'Symptoms' });
      fireEvent.press(screen.getByTestId('open-gesture-input'));
      await waitFor(() => expect(screen.getByTestId('gesture-pad')).toBeTruthy());
      drawPreset(screen.getByTestId('gesture-pad'), 'vertical');
      await waitFor(() => {
        expect(screen.getByTestId('gesture-field-input-value').props.children).toBe('Symptoms');
      });
    });

    test('done and close dismiss overlay', async () => {
      renderGestureHarness();
      fireEvent.press(screen.getByTestId('open-gesture-input'));
      await waitFor(() => expect(screen.getByText('Gesture Input')).toBeTruthy());
      fireEvent.press(screen.getByTestId('gesture-done'));
      await waitFor(() => expect(screen.queryByText('Gesture Input')).toBeNull());

      fireEvent.press(screen.getByTestId('open-gesture-input'));
      await waitFor(() => expect(screen.getByText('Gesture Input')).toBeTruthy());
      fireEvent.press(screen.getByTestId('gesture-sheet-close'));
      await waitFor(() => expect(screen.queryByText('Gesture Input')).toBeNull());
    });
  });

  describe('voice mode dictation', () => {
    beforeEach(() => {
      getAppSettings.mockResolvedValue({ currencyCode: 'INR', defaultInputMode: 'voice' });
    });

    test('dictation appends transcript', async () => {
      renderGestureHarness({ initialValue: 'Symptoms' });
      await waitFor(() => expect(getAppSettings).toHaveBeenCalled());
      fireEvent(screen.getByTestId('gesture-field-input'), 'focus');
      await waitFor(() => expect(screen.getByText('Gesture Input')).toBeTruthy());
      await waitFor(() => expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalled());

      act(() => {
        speechHandlers.start?.();
        speechHandlers.result?.({ results: [{ transcript: 'fever' }] });
      });
      await waitFor(() => {
        expect(screen.getByTestId('gesture-field-input-value').props.children).toBe('Symptoms fever');
      });
    });

    test('permission denied does not start dictation', async () => {
      ExpoSpeechRecognitionModule.requestPermissionsAsync.mockResolvedValue({ granted: false });
      renderGestureHarness();
      fireEvent.press(screen.getByTestId('open-gesture-input'));
      await waitFor(() => expect(screen.getByTestId('gesture-dictation')).toBeTruthy());
      fireEvent.press(screen.getByTestId('gesture-dictation'));
      expect(ExpoSpeechRecognitionModule.start).not.toHaveBeenCalled();
    });
  });
});
