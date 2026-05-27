import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import IntervalDaysStepper from '../src/IntervalDaysStepper';

describe('IntervalDaysStepper', () => {
  test.each([
    ['minus-5', 15, 10],
    ['minus-1', 15, 14],
    ['plus-1', 15, 16],
    ['plus-5', 15, 20],
  ])('%s changes value from %i to %i', (buttonId, start, expected) => {
    const onChange = jest.fn();
    render(<IntervalDaysStepper value={start} onChange={onChange} testIDPrefix="interval" />);
    fireEvent.press(screen.getByTestId(`interval-${buttonId}`));
    expect(onChange).toHaveBeenCalledWith(expected);
  });

  test('clamps at minimum 1', () => {
    const onChange = jest.fn();
    render(<IntervalDaysStepper value={1} onChange={onChange} testIDPrefix="interval" />);
    fireEvent.press(screen.getByTestId('interval-minus-1'));
    fireEvent.press(screen.getByTestId('interval-minus-5'));
    expect(onChange).not.toHaveBeenCalled();
  });

  test('clamps at maximum 30', () => {
    const onChange = jest.fn();
    render(<IntervalDaysStepper value={30} onChange={onChange} testIDPrefix="interval" />);
    fireEvent.press(screen.getByTestId('interval-plus-1'));
    fireEvent.press(screen.getByTestId('interval-plus-5'));
    expect(onChange).not.toHaveBeenCalled();
  });

  test('decrement-5 from 3 clamps to 1', () => {
    const onChange = jest.fn();
    render(<IntervalDaysStepper value={3} onChange={onChange} testIDPrefix="interval" />);
    fireEvent.press(screen.getByTestId('interval-minus-5'));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  test('increment-5 from 28 clamps to 30', () => {
    const onChange = jest.fn();
    render(<IntervalDaysStepper value={28} onChange={onChange} testIDPrefix="interval" />);
    fireEvent.press(screen.getByTestId('interval-plus-5'));
    expect(onChange).toHaveBeenCalledWith(30);
  });
});
