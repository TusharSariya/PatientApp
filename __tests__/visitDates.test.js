import {
  formatDateLabel,
  isValidIsoDate,
  startOfMonthIsoDate,
  todayIsoDate,
} from '../src/visitDates';

describe('visitDates', () => {
  test('todayIsoDate returns YYYY-MM-DD', () => {
    expect(todayIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('startOfMonthIsoDate returns first day of month', () => {
    expect(startOfMonthIsoDate(new Date('2026-05-16T12:00:00'))).toBe('2026-05-01');
  });

  test('isValidIsoDate accepts valid dates and rejects invalid', () => {
    expect(isValidIsoDate('2026-05-01')).toBe(true);
    expect(isValidIsoDate('2024-02-29')).toBe(true);
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('05-01-2026')).toBe(false);
    expect(isValidIsoDate('')).toBe(false);
  });

  test('formatDateLabel formats ISO date strings', () => {
    const label = formatDateLabel('2026-05-01');
    expect(label).toBeTruthy();
    expect(label).not.toBe('2026-05-01');
  });
});
