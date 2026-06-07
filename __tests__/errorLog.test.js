import {
  clearRecentErrors,
  formatErrorsForReport,
  getRecentErrors,
  reportError,
  sanitizeContext,
  setSentryReporter,
} from '../src/errorLog';

describe('errorLog', () => {
  beforeEach(() => {
    clearRecentErrors();
    setSentryReporter(null);
  });

  test('stores recent errors in a ring buffer', () => {
    reportError(new Error('first'), { screen: 'Home', action: 'load' });
    reportError(new Error('second'), { screen: 'Search', action: 'save' });

    const recent = getRecentErrors();
    expect(recent).toHaveLength(2);
    expect(recent[0].message).toBe('first');
    expect(recent[1].message).toBe('second');
  });

  test('caps stored errors at 20 entries', () => {
    for (let i = 0; i < 25; i += 1) {
      reportError(new Error(`error-${i}`));
    }
    expect(getRecentErrors()).toHaveLength(20);
    expect(getRecentErrors()[0].message).toBe('error-5');
  });

  test('sanitizeContext drops patient-related keys', () => {
    expect(
      sanitizeContext({
        screen: 'AddPatient',
        patientName: 'Alice',
        phone: '555',
        action: 'save',
      })
    ).toEqual({
      screen: 'AddPatient',
      action: 'save',
    });
  });

  test('formatErrorsForReport includes timestamps and messages', () => {
    reportError(new Error('save failed'), { screen: 'ClinicProfile', action: 'Error' });
    const text = formatErrorsForReport();
    expect(text).toContain('save failed');
    expect(text).toContain('ClinicProfile');
  });

  test('forwards errors to sentry reporter when configured', () => {
    const reporter = jest.fn();
    setSentryReporter(reporter);
    reportError(new Error('boom'), { screen: 'PatientVisits' });
    expect(reporter).toHaveBeenCalledWith(expect.any(Error), { screen: 'PatientVisits' });
  });
});
