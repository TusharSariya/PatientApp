import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import TestGestureScreen from '../src/TestGestureScreen';
import { getGestures } from '../src/database';
import { isTouchGestureData, matchGesture } from '../src/gestureRecognizer';

jest.mock('@react-navigation/native', () => {
  const ReactNative = jest.requireActual('@react-navigation/native');
  const React = require('react');
  return {
    ...ReactNative,
    useFocusEffect: (effect) => {
      React.useEffect(() => effect(), [effect]);
    },
  };
});

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
            onGestureComplete?.({ type: 'match' });
          }}
        >
          <Text>Draw Match</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            onDrawingChange?.(true);
            onDrawingChange?.(false);
            onGestureComplete?.({ type: 'no-match' });
          }}
        >
          <Text>Draw No Match</Text>
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

describe('TestGestureScreen', () => {
  const gestures = [
    { id: 1, word: 'cold', data: 'gesture-1' },
    { id: 2, word: 'fever', data: 'gesture-2' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    getGestures.mockResolvedValue(gestures);
    isTouchGestureData.mockReturnValue(true);
    matchGesture.mockImplementation((recorded) => (
      recorded?.type === 'match' ? gestures[0] : null
    ));
  });

  test('loads and displays readiness state', async () => {
    render(<TestGestureScreen />);

    await waitFor(() => expect(getGestures).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Ready to test against 2 touch gestures/)).toBeTruthy();
  });

  test('shows associated word for a matched gesture', async () => {
    render(<TestGestureScreen />);
    await waitFor(() => expect(screen.getByText(/Ready to test against/)).toBeTruthy());

    fireEvent.press(screen.getByText('Draw Match'));
    await waitFor(() => expect(screen.getByText('cold')).toBeTruthy());
  });

  test('shows no match state for unmatched gesture', async () => {
    render(<TestGestureScreen />);
    await waitFor(() => expect(screen.getByText(/Ready to test against/)).toBeTruthy());

    fireEvent.press(screen.getByText('Draw No Match'));
    await waitFor(() => expect(screen.getByText('No Matching Gesture')).toBeTruthy());
  });

  test('shows invalid state when gesture capture is too small', async () => {
    render(<TestGestureScreen />);
    await waitFor(() => expect(screen.getByText(/Ready to test against/)).toBeTruthy());

    fireEvent.press(screen.getByText('Draw Invalid'));
    await waitFor(() => expect(screen.getByText('Gesture Too Small')).toBeTruthy());
  });
});
