import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import {
  GestureInputProvider,
  useGestureTextInput,
} from '../src/GestureInputProvider';
import { getAppSettings, getGestures, subscribeAppSettings } from '../src/database';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { clearDictationOwner } from '../src/dictationOwner';
import { drawPreset, drawStrokes } from './helpers/gesturePadSim';
import { seedColdGestureRow, seedUriGestureRow, seedUriStreamGestures } from './helpers/seedGestures';

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

function Harness({ initialValue = 'Symptoms' }) {
  const [value, setValue] = React.useState(initialValue);
  const gestureInput = useGestureTextInput({
    label: 'Notes',
    value,
    setValue,
  });

  return (
    <React.Fragment>
      <TextInputHarness gestureInput={gestureInput} value={value} setValue={setValue} />
    </React.Fragment>
  );
}

function TextInputHarness({ gestureInput, value, setValue }) {
  const { TextInput, TouchableOpacity, Text, View } = require('react-native');
  return (
    <View>
      <TextInput
        testID="notes-input"
        value={value}
        onChangeText={setValue}
        ref={gestureInput.ref}
        onFocus={gestureInput.onFocus}
        onBlur={gestureInput.onBlur}
        onSelectionChange={gestureInput.onSelectionChange}
        selection={gestureInput.selection}
        showSoftInputOnFocus={gestureInput.showSoftInputOnFocus}
      />
      <TouchableOpacity testID="open-gesture-input" onPress={gestureInput.openGestureInput}>
        <Text>Open Gesture Input</Text>
      </TouchableOpacity>
      <Text testID="notes-value">{value}</Text>
    </View>
  );
}

describe('GestureInputProvider', () => {
  const speechHandlers = {};

  beforeEach(() => {
    clearDictationOwner();
    jest.clearAllMocks();
    Object.keys(speechHandlers).forEach((key) => delete speechHandlers[key]);

    getAppSettings.mockResolvedValue({ currencyCode: 'INR', defaultInputMode: 'gestures' });
    getGestures.mockResolvedValue(seedColdGestureRow());
    useSpeechRecognitionEvent.mockImplementation((eventName, handler) => {
      speechHandlers[eventName] = handler;
    });
    ExpoSpeechRecognitionModule.requestPermissionsAsync.mockResolvedValue({ granted: true });
    subscribeAppSettings.mockReturnValue(jest.fn());
  });

  function renderHarness(initialValue) {
    render(
      <GestureInputProvider>
        <Harness initialValue={initialValue} />
      </GestureInputProvider>
    );
  }

  async function openGestureSheet() {
    fireEvent.press(screen.getByTestId('open-gesture-input'));
    await waitFor(() => expect(screen.getByText('Gesture Input')).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('gesture-pad')).toBeTruthy());
  }

  test('opens with current field content shown in live preview', async () => {
    renderHarness('Symptoms');
    await openGestureSheet();
    expect(getGestures).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Live Field Preview')).toBeTruthy();
    expect(screen.getAllByText('Symptoms').length).toBeGreaterThan(0);
  });

  test('shows runtime gesture instructions when gestures are available', async () => {
    renderHarness('Symptoms');
    await openGestureSheet();
    expect(screen.getByTestId('gesture-instructions')).toBeTruthy();
    expect(screen.getByText(/Tap Stream Done to lock text/)).toBeTruthy();
  });

  test('shows setup prompt when no drawable gestures exist', async () => {
    getGestures.mockResolvedValue([]);
    renderHarness('Symptoms');
    await openGestureSheet();
    expect(screen.getByTestId('gesture-instructions')).toBeTruthy();
    expect(screen.getByText(/Settings → Manage Gestures/)).toBeTruthy();
  });

  test('gesture default opens sheet when field is focused', async () => {
    renderHarness('Symptoms');
    fireEvent(screen.getByTestId('notes-input'), 'focus');
    await waitFor(() => expect(screen.getByText('Gesture Input')).toBeTruthy());
  });

  test('keyboard default focuses field without opening sheet', async () => {
    getAppSettings.mockResolvedValue({ currencyCode: 'INR', defaultInputMode: 'keyboard' });
    renderHarness('Symptoms');
    await waitFor(() => expect(screen.getByTestId('notes-input').props.showSoftInputOnFocus).toBe(true));
    fireEvent(screen.getByTestId('notes-input'), 'focus');
    expect(screen.queryByText('Gesture Input')).toBeNull();
  });

  test('voice default opens sheet and starts dictation when field is focused', async () => {
    getAppSettings.mockResolvedValue({ currencyCode: 'INR', defaultInputMode: 'voice' });
    renderHarness('Symptoms');
    await waitFor(() => expect(getAppSettings).toHaveBeenCalled());
    fireEvent(screen.getByTestId('notes-input'), 'focus');
    await waitFor(() => expect(screen.getByText('Gesture Input')).toBeTruthy());
    await waitFor(() => {
      expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith({ lang: 'en-US', interimResults: true });
    });
  });

  test('manual gesture open still works in keyboard mode', async () => {
    getAppSettings.mockResolvedValue({ currencyCode: 'INR', defaultInputMode: 'keyboard' });
    renderHarness('Symptoms');
    await openGestureSheet();
    expect(screen.getByText('Gesture Input')).toBeTruthy();
  });

  test('closes gesture sheet on swipe down', async () => {
    renderHarness('Symptoms');
    await openGestureSheet();
    const dragHandle = screen.getByTestId('gesture-sheet-drag-handle');
    fireEvent(dragHandle, 'responderGrant', { nativeEvent: { pageY: 0 } });
    fireEvent(dragHandle, 'responderMove', { nativeEvent: { pageY: 140 } });
    fireEvent(dragHandle, 'responderRelease', { nativeEvent: { pageY: 140 } });
    await waitFor(() => expect(screen.queryByText('Gesture Input')).toBeNull());
  });

  test('closes gesture sheet from done button', async () => {
    renderHarness('Symptoms');
    await openGestureSheet();
    fireEvent.press(screen.getByTestId('gesture-done'));
    await waitFor(() => expect(screen.queryByText('Gesture Input')).toBeNull());
  });

  test('streams matched gestures into active field while sheet stays open', async () => {
    renderHarness('Symptoms');
    await openGestureSheet();
    drawPreset(screen.getByTestId('gesture-pad'), 'horizontal');
    await waitFor(() => {
      expect(screen.getByTestId('notes-value').props.children).toBe('Symptoms cold');
    });
    expect(screen.getByText('Gesture Input')).toBeTruthy();
  });

  test('dictation appends words into live field preview', async () => {
    renderHarness('Symptoms');
    await openGestureSheet();
    fireEvent.press(screen.getByTestId('gesture-dictation'));
    await waitFor(() => {
      expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith({ lang: 'en-US', interimResults: true });
    });
    act(() => {
      speechHandlers.start?.();
      speechHandlers.result?.({ results: [{ transcript: 'fever' }] });
    });
    await waitFor(() => {
      expect(screen.getByTestId('notes-value').props.children).toBe('Symptoms fever');
    });
    act(() => {
      speechHandlers.result?.({ results: [{ transcript: 'fever and cough' }] });
    });
    expect(screen.getByTestId('notes-value').props.children).toBe('Symptoms fever and cough');
    act(() => {
      speechHandlers.end?.();
    });
    expect(screen.getByText('Dictation')).toBeTruthy();
  });

  test('undo gesture restores previous field value', async () => {
    renderHarness('Symptoms');
    await openGestureSheet();
    drawPreset(screen.getByTestId('gesture-pad'), 'horizontal');
    await waitFor(() => {
      expect(screen.getByTestId('notes-value').props.children).toBe('Symptoms cold');
    });
    fireEvent.press(screen.getByTestId('gesture-undo'));
    expect(screen.getByTestId('notes-value').props.children).toBe('Symptoms');
  });

  test('invert gesture toggles last inserted phrase with "no" prefix', async () => {
    renderHarness('Symptoms');
    await openGestureSheet();
    drawPreset(screen.getByTestId('gesture-pad'), 'horizontal');
    await waitFor(() => {
      expect(screen.getByTestId('notes-value').props.children).toBe('Symptoms cold');
    });
    fireEvent.press(screen.getByTestId('gesture-invert'));
    expect(screen.getByTestId('notes-value').props.children).toBe('Symptoms no cold');
    fireEvent.press(screen.getByTestId('gesture-invert'));
    expect(screen.getByTestId('notes-value').props.children).toBe('Symptoms cold');
  });

  test('inserts multi-stroke URI shortcut as expanded phrase', async () => {
    getGestures.mockResolvedValue(seedUriGestureRow());
    renderHarness('Diagnosis');
    await openGestureSheet();
    drawStrokes(screen.getByTestId('gesture-pad'), ['horizontal', 'vertical', 'diagonal']);
    await waitFor(() => {
      expect(screen.getByTestId('notes-value').props.children).toBe('Diagnosis Upper Respiratory Infection');
    });
  });

  test('retroactively upgrades U to URI in the open stream segment', async () => {
    getGestures.mockResolvedValue(seedUriStreamGestures());
    renderHarness('Diagnosis');
    await openGestureSheet();
    drawPreset(screen.getByTestId('gesture-pad'), 'horizontal');
    await waitFor(() => {
      expect(screen.getByTestId('notes-value').props.children).toBe('Diagnosis urine');
    });
    drawPreset(screen.getByTestId('gesture-pad'), 'vertical');
    drawPreset(screen.getByTestId('gesture-pad'), 'diagonal');
    await waitFor(() => {
      expect(screen.getByTestId('notes-value').props.children).toBe('Diagnosis Upper Respiratory Infection');
    });
  });

  test('stream done checkpoints open segment before next symbols', async () => {
    getGestures.mockResolvedValue(seedUriStreamGestures());
    renderHarness('Diagnosis');
    await openGestureSheet();
    drawPreset(screen.getByTestId('gesture-pad'), 'horizontal');
    await waitFor(() => {
      expect(screen.getByTestId('notes-value').props.children).toBe('Diagnosis urine');
    });
    fireEvent.press(screen.getByTestId('gesture-stream-done'));
    drawPreset(screen.getByTestId('gesture-pad'), 'horizontal');
    await waitFor(() => {
      expect(screen.getByTestId('notes-value').props.children).toBe('Diagnosis urine urine');
    });
  });

  test('ignores unmatched and invalid gestures without changing field text', async () => {
    renderHarness('Symptoms');
    await openGestureSheet();
    drawPreset(screen.getByTestId('gesture-pad'), 'vertical');
    await waitFor(() => {
      expect(screen.getByTestId('notes-value').props.children).toBe('Symptoms');
    });
    drawPreset(screen.getByTestId('gesture-pad'), 'shortInvalid');
    await waitFor(() => {
      expect(screen.getByTestId('notes-value').props.children).toBe('Symptoms');
    });
  });
});
