import {
  durationToInputValue,
  formatMedicineSubtitle,
  medicineToDraftForm,
  normalizeDurationInput,
} from '../src/medicineDisplay';

describe('medicineDisplay', () => {
  test('formatMedicineSubtitle joins dosage frequency and interval', () => {
    expect(
      formatMedicineSubtitle({
        dosage: '400mg',
        frequency: '2x/day',
        interval_days: 2,
      })
    ).toBe('400mg · 2x/day · q2d');
  });

  test('normalizeDurationInput trims and limits to three characters', () => {
    expect(normalizeDurationInput('  30  ')).toBe('30');
    expect(normalizeDurationInput('1234')).toBe('123');
    expect(normalizeDurationInput(null)).toBe('');
  });

  test('durationToInputValue extracts leading digits from legacy values', () => {
    expect(durationToInputValue('5 days')).toBe('5');
    expect(durationToInputValue('30 days')).toBe('30');
    expect(durationToInputValue('14')).toBe('14');
    expect(durationToInputValue('abc')).toBe('abc');
    expect(durationToInputValue('')).toBe('');
  });

  test('medicineToDraftForm maps database row to draft shape', () => {
    expect(
      medicineToDraftForm({
        name: 'Ibuprofen',
        dosage: '400mg',
        frequency: '2x/day',
        interval_days: 1,
        duration: '5 days',
        route: 'Oral',
        instructions: 'Take with food',
      })
    ).toEqual({
      name: 'Ibuprofen',
      dosage: '400mg',
      frequency: '2x/day',
      intervalDays: 1,
      duration: '5',
      route: 'Oral',
      instructions: 'Take with food',
    });
  });
});
