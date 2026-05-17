import { formatMoney, getCurrencyOption, isValidCurrencyCode } from '../src/currency';

describe('currency', () => {
  test('defaults to Indian Rupee formatting', () => {
    const formatted = formatMoney(150, 'INR');
    expect(formatted).toContain('150');
    expect(formatted).toMatch(/₹|INR/);
  });

  test('formats USD amounts', () => {
    const formatted = formatMoney(12.5, 'USD');
    expect(formatted).toContain('12.50');
    expect(formatted).toContain('$');
  });

  test('validates supported currency codes', () => {
    expect(isValidCurrencyCode('INR')).toBe(true);
    expect(isValidCurrencyCode('XYZ')).toBe(false);
    expect(getCurrencyOption('XYZ').code).toBe('INR');
  });
});
