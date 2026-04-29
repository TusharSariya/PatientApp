import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import {
  GestureInputProvider,
  useGestureTextInput,
} from '../src/GestureInputProvider';
import { getGestures } from '../src/database';
import { isTouchGestureData, matchGesture } from '../src/gestureRecognizer';

jest.mock('../src/database', () => ({
  getGestures: jest.fn(),
}));

jest.mock('../src/gestureRecognizer', () => ({
  isTouchGestureData: jest.fn(),
  matchGesture: jest.fn(),
}));

jest.mock('../src/GesturePad', () => {
  const React = require('react');
  const { Text, TouchableOpacity, View } = require('react-native');

  return function MockGesturePad({ onGestureComplete, onDrawingChange }) {
    return (
      <View>
        <TouchableOpacity
          onPress={() => {
            onDrawingChange?.(true);
            onDrawingChange?.(false);
            onGestureComplete?.({ type: 'cold' });
          }}
        >
          <Text>Draw Cold</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            onDrawingChange?.(true);
            onDrawingChange?.(false);
            onGestureComplete?.({ type: 'fever' });
          }}
        >
          <Text>Draw Fever</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            onDrawingChange?.(true);
            onDrawingChange?.(false);
            onGestureComplete?.({ type: 'unknown' });
          }}
        >
          <Text>Draw Unknown</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            onDrawingChange?.(true);
            onDrawingChange?.(false);
            onGestureComplete?.(null);
          }}
        >
          <Text>Draw Invalid</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

function Harness({ initialValue = 'Symptoms' }) {
  const [value, setValue] = React.useState(initialValue);
  const gestureInput = useGestureTextInput({
    label: 'Notes',
    value,
    setValue,
  });

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
      <TouchableOpacity onPress={gestureInput.openGestureInput}>
        <Text>Open Gesture Input</Text>
      </TouchableOpacity>
      <Text testID="notes-value">{value}</Text>
    </View>
  );
}

describe('GestureInputProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    getGestures.mockResolvedValue([
      { id: 1, word: 'cold', data: 'cold-gesture' },
      { id: 2, word: 'fever', data: 'fever-gesture' },
    ]);
    isTouchGestureData.mockReturnValue(true);
    matchGesture.mockImplementation((gesture) => {
      if (gesture?.type === 'cold') return { word: 'cold' };
      if (gesture?.type === 'fever') return { word: 'fever' };
      return null;
    });
  });

  function renderHarness(initialValue) {
    render(
      <GestureInputProvider>
        <Harness initialValue={initialValue} />
      </GestureInputProvider>
    );
  }

  async function openGestureSheet() {
    fireEvent.press(screen.getByText('Open Gesture Input'));
    await waitFor(() => expect(screen.getByText('Gesture Input')).toBeTruthy());
  }

  test('opens with current field content shown in live preview', async () => {
    renderHarness('Symptoms');
    await openGestureSheet();

    expect(getGestures).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Live Field Preview')).toBeTruthy();
    expect(screen.getAllByText('Symptoms').length).toBeGreaterThan(0);
  });

  test('streams matched gestures into active field while sheet stays open', async () => {
    renderHarness('Symptoms');
    await openGestureSheet();

    fireEvent.press(screen.getByText('Draw Cold'));

    await waitFor(() => {
      expect(screen.getByTestId('notes-value').props.children).toBe('Symptoms cold');
    });
    expect(screen.getByText(/"cold" inserted/)).toBeTruthy();
    expect(screen.getByText('Gesture Input')).toBeTruthy();
  });

  test('undo gesture restores previous field value', async () => {
    renderHarness('Symptoms');
    await openGestureSheet();

    fireEvent.press(screen.getByText('Draw Cold'));
    await waitFor(() => {
      expect(screen.getByTestId('notes-value').props.children).toBe('Symptoms cold');
    });

    fireEvent.press(screen.getByText('Undo Gesture'));
    expect(screen.getByTestId('notes-value').props.children).toBe('Symptoms');
  });

  test('invert gesture toggles last inserted phrase with "no" prefix', async () => {
    renderHarness('Symptoms');
    await openGestureSheet();

    fireEvent.press(screen.getByText('Draw Cold'));
    await waitFor(() => {
      expect(screen.getByTestId('notes-value').props.children).toBe('Symptoms cold');
    });

    fireEvent.press(screen.getByText('Invert Gesture'));
    expect(screen.getByTestId('notes-value').props.children).toBe('Symptoms no cold');
    expect(screen.getByText(/"no cold" applied/)).toBeTruthy();

    fireEvent.press(screen.getByText('Invert Gesture'));
    expect(screen.getByTestId('notes-value').props.children).toBe('Symptoms cold');
    expect(screen.getByText(/"cold" applied/)).toBeTruthy();
  });

  test('shows no-match and invalid capture states', async () => {
    renderHarness('Symptoms');
    await openGestureSheet();

    fireEvent.press(screen.getByText('Draw Unknown'));
    await waitFor(() => expect(screen.getByText('No Matching Gesture')).toBeTruthy());

    fireEvent.press(screen.getByText('Draw Invalid'));
    await waitFor(() => expect(screen.getByText('Gesture Too Small')).toBeTruthy());
  });
});
