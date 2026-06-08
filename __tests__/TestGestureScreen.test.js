import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import TestGestureScreen from '../src/TestGestureScreen';
import { getGestures } from '../src/database';
import { drawPreset, drawStrokes } from './helpers/gesturePadSim';
import { seedColdAndFeverGestureRows, seedUriStreamGestures } from './helpers/seedGestures';

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
    expect(screen.getByText(/Practice symbol streams and phrase expansion/)).toBeTruthy();
    expect(screen.getByTestId('gesture-test-walkthrough')).toBeTruthy();
    expect(screen.getByText(/Tap Stream Done to checkpoint/)).toBeTruthy();
  });

  test('shows matched shortcut output for sequence gestures', async () => {
    render(<TestGestureScreen />);
    await waitFor(() => expect(screen.getByTestId('gesture-pad')).toBeTruthy());
    drawPreset(screen.getByTestId('gesture-pad'), 'horizontal');
    await waitFor(() => expect(screen.getByText('1 → cold')).toBeTruthy());
  });

  test('shows stream buffer and retroactive URI expansion', async () => {
    getGestures.mockResolvedValue(seedUriStreamGestures());
    render(<TestGestureScreen />);
    await waitFor(() => expect(screen.getByTestId('gesture-pad')).toBeTruthy());
    drawPreset(screen.getByTestId('gesture-pad'), 'horizontal');
    await waitFor(() => {
      expect(screen.getByTestId('test-gesture-stream-buffer').props.children.join('')).toContain('U');
      expect(screen.getByText('U → urine')).toBeTruthy();
    });
    drawStrokes(screen.getByTestId('gesture-pad'), ['vertical', 'diagonal']);
    await waitFor(() => {
      expect(screen.getByText('URI → Upper Respiratory Infection')).toBeTruthy();
    });
  });

  test('stream done checkpoints output', async () => {
    getGestures.mockResolvedValue(seedUriStreamGestures());
    render(<TestGestureScreen />);
    await waitFor(() => expect(screen.getByTestId('gesture-pad')).toBeTruthy());
    drawPreset(screen.getByTestId('gesture-pad'), 'horizontal');
    await waitFor(() => expect(screen.getByText('U → urine')).toBeTruthy());
    fireEvent.press(screen.getByTestId('test-gesture-stream-done'));
    await waitFor(() => expect(screen.getByText(/Committed: urine/)).toBeTruthy());
  });

  test('shows empty gestures message', async () => {
    getGestures.mockResolvedValue([]);
    render(<TestGestureScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Add symbols or shortcuts from Manage Gestures first/)).toBeTruthy();
    });
  });
});
