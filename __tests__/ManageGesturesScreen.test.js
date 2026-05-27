import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ManageGesturesScreen from '../src/ManageGesturesScreen';
import { addGesture, deleteGesture, getGestures } from '../src/database';
import { drawPreset } from './helpers/gesturePadSim';
import { pressAlertButton, spyAlert } from './helpers/matrix';

jest.mock('../src/database', () => ({
  getGestures: jest.fn(),
  addGesture: jest.fn(),
  deleteGesture: jest.fn(),
}));

describe('ManageGesturesScreen', () => {
  let alertSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = spyAlert();
    getGestures.mockResolvedValue([
      { id: 1, word: 'Cough', data: '{"kind":"touch-path-v1","points":[1]}' },
      { id: 2, word: 'Fever', data: '{"kind":"touch-path-v1","points":[2]}' },
    ]);
    addGesture.mockResolvedValue(3);
    deleteGesture.mockResolvedValue();
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  test('loads and renders saved gestures', async () => {
    render(<ManageGesturesScreen navigation={{ navigate: jest.fn() }} />);
    await waitFor(() => expect(getGestures).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Cough')).toBeTruthy();
    expect(screen.getByText('Fever')).toBeTruthy();
  });

  test('navigates to gesture test screen', async () => {
    const navigation = { navigate: jest.fn() };
    render(<ManageGesturesScreen navigation={navigation} />);
    await waitFor(() => expect(screen.getByText('Test a Gesture')).toBeTruthy());
    fireEvent.press(screen.getByText('Test a Gesture'));
    expect(navigation.navigate).toHaveBeenCalledWith('TestGesture');
  });

  test('captures and saves a new gesture using real GesturePad', async () => {
    render(<ManageGesturesScreen navigation={{ navigate: jest.fn() }} />);
    await waitFor(() => expect(getGestures).toHaveBeenCalledTimes(1));

    fireEvent.press(screen.getByText('+ Add'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Cough'), '  Cold ');
    const pad = screen.getByTestId('gesture-pad');
    drawPreset(pad, 'horizontal');
    fireEvent.press(screen.getByText('Save Gesture'));

    await waitFor(() => {
      expect(addGesture).toHaveBeenCalledTimes(1);
    });
    expect(addGesture.mock.calls[0][0]).toBe('Cold');
    expect(() => JSON.parse(addGesture.mock.calls[0][1])).not.toThrow();
  });

  test('deletes a gesture after alert confirmation', async () => {
    render(<ManageGesturesScreen navigation={{ navigate: jest.fn() }} />);
    await waitFor(() => expect(screen.getByText('Cough')).toBeTruthy());
    fireEvent.press(screen.getAllByText('🗑')[0]);
    pressAlertButton(alertSpy, 1);
    await waitFor(() => {
      expect(deleteGesture).toHaveBeenCalledWith(1);
    });
  });

  test('delete alert cancel does not delete', async () => {
    render(<ManageGesturesScreen navigation={{ navigate: jest.fn() }} />);
    await waitFor(() => expect(screen.getByText('Cough')).toBeTruthy());
    fireEvent.press(screen.getAllByText('🗑')[0]);
    pressAlertButton(alertSpy, 0);
    expect(deleteGesture).not.toHaveBeenCalled();
  });
});
