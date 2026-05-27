import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import TestGestureScreen from '../src/TestGestureScreen';
import { getGestures } from '../src/database';
import { buildTouchGesture } from '../src/gestureRecognizer';
import { drawPreset, makeRawPath } from './helpers/gesturePadSim';
import { seedColdAndFeverGestureRows } from './helpers/seedGestures';

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

describe('TestGestureScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getGestures.mockResolvedValue(seedColdAndFeverGestureRows());
  });

  test('loads and displays readiness state', async () => {
    render(<TestGestureScreen />);
    await waitFor(() => expect(getGestures).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Ready to test against 2 touch gestures/)).toBeTruthy();
  });

  test('shows associated word for a matched gesture via real pad', async () => {
    render(<TestGestureScreen />);
    await waitFor(() => expect(screen.getByText(/Ready to test against/)).toBeTruthy());
    drawPreset(screen.getByTestId('gesture-pad'), 'horizontal');
    await waitFor(() => expect(screen.getByText('cold')).toBeTruthy());
  });

  test('shows no match state for unmatched gesture', async () => {
    const horizontal = buildTouchGesture(makeRawPath({ count: 24, stepX: 10 }));
    getGestures.mockResolvedValue([{ id: 1, word: 'cold', data: JSON.stringify(horizontal) }]);
    render(<TestGestureScreen />);
    await waitFor(() => expect(screen.getByText(/Ready to test against 1 touch gesture/)).toBeTruthy());
    drawPreset(screen.getByTestId('gesture-pad'), 'vertical');
    await waitFor(() => expect(screen.getByText('No Matching Gesture')).toBeTruthy());
  });

  test('shows invalid state when gesture capture is too small', async () => {
    render(<TestGestureScreen />);
    await waitFor(() => expect(screen.getByText(/Ready to test against/)).toBeTruthy());
    drawPreset(screen.getByTestId('gesture-pad'), 'shortInvalid');
    await waitFor(() => expect(screen.getByText('Gesture Too Small')).toBeTruthy());
  });

  test('shows empty gestures message', async () => {
    getGestures.mockResolvedValue([]);
    render(<TestGestureScreen />);
    await waitFor(() => {
      expect(screen.getByText(/No gestures saved yet/)).toBeTruthy();
    });
  });

  test('clear result resets idle state', async () => {
    render(<TestGestureScreen />);
    await waitFor(() => expect(screen.getByText(/Ready to test against/)).toBeTruthy());
    drawPreset(screen.getByTestId('gesture-pad'), 'horizontal');
    await waitFor(() => expect(screen.getByText('cold')).toBeTruthy());
    fireEvent.press(screen.getByText('Clear Result'));
    expect(screen.getByText(/Draw a saved gesture/i)).toBeTruthy();
  });
});
