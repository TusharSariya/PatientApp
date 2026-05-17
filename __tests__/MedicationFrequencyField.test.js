import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import MedicationFrequencyField, {
  formatPresetFrequency,
  isPresetFrequency,
} from '../src/MedicationFrequencyField';

describe('MedicationFrequencyField', () => {
  test('formatPresetFrequency and isPresetFrequency', () => {
    expect(formatPresetFrequency(2)).toBe('2x/day');
    expect(isPresetFrequency('3x/day')).toBe(true);
    expect(isPresetFrequency('PRN')).toBe(false);
  });

  test('selects preset and custom values', () => {
    const onChange = jest.fn();
    render(<MedicationFrequencyField value="" onChange={onChange} />);

    fireEvent.press(screen.getByTestId('frequency-preset-2'));
    expect(onChange).toHaveBeenCalledWith('2x/day');

    fireEvent.changeText(screen.getByTestId('frequency-custom'), '5x/day');
    expect(onChange).toHaveBeenCalledWith('5x/day');
  });

  test('shows custom text when value is not a preset', () => {
    render(<MedicationFrequencyField value="PRN" onChange={jest.fn()} />);
    expect(screen.getByTestId('frequency-custom').props.value).toBe('PRN');
  });
});
