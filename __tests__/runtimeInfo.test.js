import { getAppMetadata, getDeviceMetadata } from '../src/runtimeInfo';

jest.mock('../app.json', () => ({
  expo: {
    version: '1.0.13',
    android: { package: 'com.patientapp.patients', versionCode: 14 },
    ios: { bundleIdentifier: 'com.patientapp.patients' },
  },
}));

describe('runtimeInfo', () => {
  test('falls back to app.json when native application module is unavailable', () => {
    jest.doMock('expo-application', () => {
      throw new Error('Cannot find native module ExpoApplication');
    });

    const metadata = getAppMetadata();
    expect(metadata.version).toBe('1.0.13');
    expect(metadata.build).toBe('14');
    expect(metadata.applicationId).toBe('com.patientapp.patients');
  });

  test('falls back when native device module is unavailable', () => {
    const metadata = getDeviceMetadata();
    expect(metadata.osName).toBeTruthy();
    expect(metadata.modelName).toBeTruthy();
  });
});
