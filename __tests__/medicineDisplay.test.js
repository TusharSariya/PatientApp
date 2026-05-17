import { formatMedicineSubtitle, medicineToDraftForm } from '../src/medicineDisplay';

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
      duration: '5 days',
      route: 'Oral',
      instructions: 'Take with food',
    });
  });
});
