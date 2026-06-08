import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ManageGesturesScreen from '../src/ManageGesturesScreen';
import {
  addExpansion,
  addGlyphGesture,
  addSequenceGesture,
  deleteGesture,
  getGestures,
} from '../src/database';
import { drawPreset, drawStrokes } from './helpers/gesturePadSim';
import { pressAlertButton, spyAlert } from './helpers/matrix';

jest.mock('../src/database', () => ({
  getGestures: jest.fn(),
  addGlyphGesture: jest.fn(),
  addExpansion: jest.fn(),
  addSequenceGesture: jest.fn(),
  deleteGesture: jest.fn(),
}));

describe('ManageGesturesScreen', () => {
  let alertSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = spyAlert();
    getGestures.mockResolvedValue([
      { id: 1, kind: 'glyph', symbol: 'U', word: '', data: '{"kind":"touch-path-v1","points":[1]}' },
      { id: 2, kind: 'expansion', code: 'URI', word: 'Upper Respiratory Infection', data: '{}' },
      { id: 3, kind: 'sequence', code: 'URI', word: 'Upper Respiratory Infection', data: '{"kind":"touch-sequence-v1","strokes":[]}' },
    ]);
    addGlyphGesture.mockResolvedValue(4);
    addExpansion.mockResolvedValue(5);
    addSequenceGesture.mockResolvedValue(6);
    deleteGesture.mockResolvedValue();
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  test('shows how gestures work guide', async () => {
    render(<ManageGesturesScreen navigation={{ navigate: jest.fn() }} />);
    await waitFor(() => expect(screen.getByTestId('gesture-guide-card')).toBeTruthy());
    expect(screen.getByText('How gestures work')).toBeTruthy();
    expect(screen.getByText(/Symbols — draw one stroke per letter/)).toBeTruthy();
    expect(screen.getByText(/Tap Stream Done to lock committed text/)).toBeTruthy();
  });

  test('loads and renders saved gestures by kind', async () => {
    render(<ManageGesturesScreen navigation={{ navigate: jest.fn() }} />);
    await waitFor(() => expect(getGestures).toHaveBeenCalledTimes(1));
    expect(screen.getByText('U')).toBeTruthy();
    expect(screen.getByText('URI → Upper Respiratory Infection')).toBeTruthy();
    expect(screen.getByText('URI → Upper Respiratory Infection (shortcut)')).toBeTruthy();
  });

  test('navigates to gesture test screen', async () => {
    const navigation = { navigate: jest.fn() };
    render(<ManageGesturesScreen navigation={navigation} />);
    await waitFor(() => expect(screen.getByText('Test a Gesture')).toBeTruthy());
    fireEvent.press(screen.getByText('Test a Gesture'));
    expect(navigation.navigate).toHaveBeenCalledWith('TestGesture');
  });

  test('captures and saves a glyph symbol', async () => {
    render(<ManageGesturesScreen navigation={{ navigate: jest.fn() }} />);
    await waitFor(() => expect(getGestures).toHaveBeenCalledTimes(1));

    fireEvent.press(screen.getByText('+ Add'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. U'), 'U');
    drawPreset(screen.getByTestId('gesture-pad'), 'horizontal');
    fireEvent.press(screen.getByText('Save Symbol'));

    await waitFor(() => {
      expect(addGlyphGesture).toHaveBeenCalledTimes(1);
    });
    expect(addGlyphGesture.mock.calls[0][0]).toBe('U');
  });

  test('saves a phrase expansion without drawing', async () => {
    render(<ManageGesturesScreen navigation={{ navigate: jest.fn() }} />);
    await waitFor(() => expect(getGestures).toHaveBeenCalledTimes(1));

    fireEvent.press(screen.getByText('+ Add'));
    fireEvent.press(screen.getByText('Phrase'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. URI'), 'URI');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Upper Respiratory Infection'), 'Upper Respiratory Infection');
    fireEvent.press(screen.getByText('Save Phrase'));

    await waitFor(() => {
      expect(addExpansion).toHaveBeenCalledTimes(1);
    });
    expect(addExpansion.mock.calls[0]).toEqual(['URI', 'Upper Respiratory Infection']);
  });

  test('captures and saves a multi-stroke shortcut', async () => {
    render(<ManageGesturesScreen navigation={{ navigate: jest.fn() }} />);
    await waitFor(() => expect(getGestures).toHaveBeenCalledTimes(1));

    fireEvent.press(screen.getByText('+ Add'));
    fireEvent.press(screen.getByText('Shortcut'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. URI'), 'URI');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Upper Respiratory Infection'), 'Upper Respiratory Infection');
    const pad = screen.getByTestId('gesture-pad');
    drawStrokes(pad, ['horizontal', 'vertical', 'diagonal']);
    fireEvent.press(screen.getByText('Save Shortcut'));

    await waitFor(() => {
      expect(addSequenceGesture).toHaveBeenCalledTimes(1);
    });
    expect(addSequenceGesture.mock.calls[0][0]).toBe('Upper Respiratory Infection');
    expect(addSequenceGesture.mock.calls[0][2]).toBe('URI');
    const saved = JSON.parse(addSequenceGesture.mock.calls[0][1]);
    expect(saved.strokes).toHaveLength(3);
  });

  test('deletes a gesture after alert confirmation', async () => {
    render(<ManageGesturesScreen navigation={{ navigate: jest.fn() }} />);
    await waitFor(() => expect(screen.getByText('U')).toBeTruthy());
    fireEvent.press(screen.getAllByText('🗑')[0]);
    pressAlertButton(alertSpy, 1);
    await waitFor(() => {
      expect(deleteGesture).toHaveBeenCalledWith(1);
    });
  });
});
