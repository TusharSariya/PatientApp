import { DEFAULT_INPUT_MODE, INPUT_MODES, normalizeInputMode } from '../src/inputMode';

describe('inputMode', () => {
  test('DEFAULT_INPUT_MODE is gestures', () => {
    expect(DEFAULT_INPUT_MODE).toBe('gestures');
  });

  test.each(INPUT_MODES.map((mode) => [mode.id, mode.title]))(
    'INPUT_MODES includes %s with title %s',
    (id, title) => {
      const mode = INPUT_MODES.find((entry) => entry.id === id);
      expect(mode.title).toBe(title);
      expect(mode.subtitle).toEqual(expect.any(String));
    }
  );

  test.each(['gestures', 'voice', 'keyboard'])('normalizeInputMode accepts %s', (mode) => {
    expect(normalizeInputMode(mode)).toBe(mode);
  });

  test('normalizeInputMode falls back for unknown values', () => {
    expect(normalizeInputMode('invalid')).toBe(DEFAULT_INPUT_MODE);
    expect(normalizeInputMode(null)).toBe(DEFAULT_INPUT_MODE);
    expect(normalizeInputMode(undefined)).toBe(DEFAULT_INPUT_MODE);
  });
});
