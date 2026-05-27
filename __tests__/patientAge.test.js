import { calculateAgeInYears, formatPatientAge } from '../src/patientAge';

describe('patientAge', () => {
  const referenceDate = new Date(2026, 4, 26);

  test('calculateAgeInYears returns null for invalid dob', () => {
    expect(calculateAgeInYears('', referenceDate)).toBeNull();
    expect(calculateAgeInYears('02-14-1990', referenceDate)).toBeNull();
    expect(calculateAgeInYears('1990-13-01', referenceDate)).toBeNull();
  });

  test('calculateAgeInYears returns null for future birth date', () => {
    expect(calculateAgeInYears('2030-01-01', referenceDate)).toBeNull();
  });

  test('calculateAgeInYears before birthday in reference year', () => {
    expect(calculateAgeInYears('1990-06-15', referenceDate)).toBe(35);
  });

  test('calculateAgeInYears on or after birthday', () => {
    expect(calculateAgeInYears('1990-05-26', referenceDate)).toBe(36);
    expect(calculateAgeInYears('1990-02-14', referenceDate)).toBe(36);
  });

  test('formatPatientAge handles singular year', () => {
    expect(formatPatientAge('2025-05-27', referenceDate)).toBe('Age: 0 years');
  });

  test('formatPatientAge returns null when age cannot be calculated', () => {
    expect(formatPatientAge('invalid', referenceDate)).toBeNull();
  });

  test('formatPatientAge uses singular for age 1', () => {
    expect(formatPatientAge('2025-05-25', referenceDate)).toBe('Age: 1 year');
  });
});
