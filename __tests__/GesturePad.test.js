import React from 'react';
import { render, screen } from '@testing-library/react-native';

import GesturePad from '../src/GesturePad';
import { drawPath, drawPreset, layoutGesturePad } from './helpers/gesturePadSim';

describe('GesturePad', () => {
  test('shows empty prompt before layout and drawing', () => {
    render(<GesturePad />);
    expect(screen.getByText('Draw your gesture here')).toBeTruthy();
  });

  test('does not emit gestures before layout is measured', () => {
    const onGestureComplete = jest.fn();
    render(<GesturePad onGestureComplete={onGestureComplete} />);
    const pad = screen.getByTestId('gesture-pad');
    drawPath(pad, [{ x: 20, y: 20, spread: 0, touches: 1 }], { layout: false });
    expect(onGestureComplete).not.toHaveBeenCalled();
  });

  test('completes a single-finger horizontal gesture after layout', () => {
    const onGestureChange = jest.fn();
    const onGestureComplete = jest.fn();
    const onDrawingChange = jest.fn();
    render(
      <GesturePad
        onGestureChange={onGestureChange}
        onGestureComplete={onGestureComplete}
        onDrawingChange={onDrawingChange}
      />
    );
    const pad = screen.getByTestId('gesture-pad');
    drawPreset(pad, 'horizontal');

    expect(onDrawingChange).toHaveBeenCalledWith(true);
    expect(onDrawingChange).toHaveBeenCalledWith(false);
    expect(onGestureChange.mock.calls.some((call) => call[0]?.kind === 'touch-path-v1')).toBe(true);
    expect(onGestureComplete).toHaveBeenCalled();
    expect(onGestureComplete.mock.calls[0][0]?.kind).toBe('touch-path-v1');
  });

  test('completes a multi-touch gesture path', () => {
    const onGestureComplete = jest.fn();
    render(<GesturePad onGestureComplete={onGestureComplete} />);
    drawPreset(screen.getByTestId('gesture-pad'), 'multiTouch');
    expect(onGestureComplete).toHaveBeenCalled();
    expect(onGestureComplete.mock.calls[0][0].maxTouches).toBeGreaterThanOrEqual(2);
  });

  test('disabled pad ignores drawing', () => {
    const onGestureComplete = jest.fn();
    render(<GesturePad disabled onGestureComplete={onGestureComplete} />);
    expect(screen.getByText('No compatible gestures available')).toBeTruthy();
    drawPreset(screen.getByTestId('gesture-pad'), 'horizontal');
    expect(onGestureComplete).not.toHaveBeenCalled();
  });

  test('resetKey clears drawing state', () => {
    const onGestureChange = jest.fn();
    const { rerender } = render(<GesturePad resetKey={0} onGestureChange={onGestureChange} />);
    const pad = screen.getByTestId('gesture-pad');
    drawPreset(pad, 'horizontal');
    expect(onGestureChange).toHaveBeenCalled();

    onGestureChange.mockClear();
    rerender(<GesturePad resetKey={1} onGestureChange={onGestureChange} />);
    expect(onGestureChange).toHaveBeenCalledWith(null, []);
  });

  test('short invalid path completes with null gesture', () => {
    const onGestureComplete = jest.fn();
    render(<GesturePad onGestureComplete={onGestureComplete} />);
    drawPreset(screen.getByTestId('gesture-pad'), 'shortInvalid');
    expect(onGestureComplete).toHaveBeenCalledWith(null, expect.any(Array));
  });

  test('respects custom padHeight', () => {
    render(<GesturePad padHeight={180} />);
    const pad = screen.getByTestId('gesture-pad');
    layoutGesturePad(pad);
    expect(pad.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ height: 180 })])
    );
  });

  test('fill mode uses flex layout class', () => {
    render(<GesturePad fill />);
    expect(screen.getByTestId('gesture-pad').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ flex: 1 })])
    );
  });
});
