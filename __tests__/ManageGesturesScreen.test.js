import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ManageGesturesScreen from '../src/ManageGesturesScreen';
import { addGesture, deleteGesture, getGestures } from '../src/database';

jest.mock('../src/database', () => ({
  getGestures: jest.fn(),
  addGesture: jest.fn(),
  deleteGesture: jest.fn(),
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
            onGestureComplete?.({
              kind: 'touch-path-v1',
              maxTouches: 1,
              points: Array.from({ length: 8 }, (_, index) => ({ x: index, y: index, spread: 0, touches: 1 })),
            });
          }}
        >
          <Text>Capture Gesture</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

describe('ManageGesturesScreen', () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    getGestures.mockResolvedValue([
      { id: 1, word: 'Cough', data: '{"kind":"touch-path-v1","points":[1]}' },
      { id: 2, word: 'Fever', data: '{"kind":"touch-path-v1","points":[2]}' },
    ]);
    addGesture.mockResolvedValue(3);
    deleteGesture.mockResolvedValue();
  });

  afterAll(() => {
    alertSpy.mockRestore();
  });

  test('loads and renders saved gestures', async () => {
    render(<ManageGesturesScreen navigation={{ navigate: jest.fn() }} />);

    await waitFor(() => {
      expect(getGestures).toHaveBeenCalledTimes(1);
    });

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

  test('captures and saves a new gesture', async () => {
    render(<ManageGesturesScreen navigation={{ navigate: jest.fn() }} />);
    await waitFor(() => expect(getGestures).toHaveBeenCalledTimes(1));

    fireEvent.press(screen.getByText('+ Add'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Cough'), '  Cold ');
    fireEvent.press(screen.getByText('Capture Gesture'));
    fireEvent.press(screen.getByText('Save Gesture'));

    await waitFor(() => {
      expect(addGesture).toHaveBeenCalledTimes(1);
    });

    expect(addGesture.mock.calls[0][0]).toBe('Cold');
    expect(() => JSON.parse(addGesture.mock.calls[0][1])).not.toThrow();
  });

  test('deletes a gesture after alert confirmation', async () => {
    alertSpy.mockImplementationOnce((title, message, buttons) => {
      const deleteAction = buttons.find(button => button.text === 'Delete');
      deleteAction.onPress();
    });

    render(<ManageGesturesScreen navigation={{ navigate: jest.fn() }} />);
    await waitFor(() => expect(screen.getByText('Cough')).toBeTruthy());

    fireEvent.press(screen.getAllByText('🗑')[0]);

    await waitFor(() => {
      expect(deleteGesture).toHaveBeenCalledWith(1);
    });
  });
});
