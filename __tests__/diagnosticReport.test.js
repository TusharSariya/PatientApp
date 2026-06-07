import { buildDiagnosticReport } from '../src/diagnosticReport';
import { clearRecentErrors, reportError } from '../src/errorLog';

jest.mock('../src/runtimeInfo', () => ({
  getAppMetadata: jest.fn(() => ({
    version: '1.0.13',
    build: '14',
    applicationId: 'com.patientapp.patients',
  })),
  getDeviceMetadata: jest.fn(() => ({
    manufacturer: 'Apple',
    modelName: 'iPhone 15',
    osName: 'iOS',
    osVersion: '18.0',
  })),
}));

jest.mock('../src/database', () => ({
  getAppSettings: jest.fn().mockResolvedValue({ currencyCode: 'INR', defaultInputMode: 'gestures' }),
  getAllPatients: jest.fn().mockResolvedValue([
    { id: 1, name: 'Alice Johnson', phone: '555', address: 'Main' },
  ]),
}));

describe('diagnosticReport', () => {
  beforeEach(() => {
    clearRecentErrors();
  });

  test('buildDiagnosticReport includes version and counts without patient names', async () => {
    reportError(new Error('Failed to create visit.'), { screen: 'PatientVisits' });
    const report = await buildDiagnosticReport({ userNotes: 'App crashed while saving visit.' });

    expect(report).toContain('App version: 1.0.13');
    expect(report).toContain('Patients on device: 1');
    expect(report).toContain('Failed to create visit.');
    expect(report).toContain('App crashed while saving visit.');
    expect(report).not.toContain('Alice Johnson');
    expect(report).not.toContain('555');
  });
});
