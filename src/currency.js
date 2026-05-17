export const DEFAULT_CURRENCY_CODE = 'INR';

export const SUPPORTED_CURRENCIES = [
  { code: 'INR', label: 'Indian Rupee', symbol: '₹', locale: 'en-IN' },
  { code: 'USD', label: 'US Dollar', symbol: '$', locale: 'en-US' },
  { code: 'EUR', label: 'Euro', symbol: '€', locale: 'en-IE' },
  { code: 'GBP', label: 'British Pound', symbol: '£', locale: 'en-GB' },
];

export function getCurrencyOption(code) {
  return SUPPORTED_CURRENCIES.find((entry) => entry.code === code) ?? SUPPORTED_CURRENCIES[0];
}

export function isValidCurrencyCode(code) {
  return SUPPORTED_CURRENCIES.some((entry) => entry.code === code);
}

export function formatMoney(amount, currencyCode = DEFAULT_CURRENCY_CODE) {
  const currency = getCurrencyOption(currencyCode);
  const value = Number(amount ?? 0);
  const safeAmount = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat(currency.locale, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeAmount);
  } catch {
    return `${currency.symbol}${safeAmount.toFixed(2)}`;
  }
}
