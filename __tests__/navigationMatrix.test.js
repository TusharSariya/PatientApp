import React from 'react';
import { render } from '@testing-library/react-native';

import App from '../App';

jest.mock('../src/HomeScreen', () => () => null);
jest.mock('../src/AddPatientScreen', () => () => null);
jest.mock('../src/SearchScreen', () => () => null);
jest.mock('../src/PatientDetailScreen', () => () => null);
jest.mock('../src/EditPatientScreen', () => () => null);
jest.mock('../src/PatientMedicinesScreen', () => () => null);
jest.mock('../src/PatientVisitsScreen', () => () => null);
jest.mock('../src/SettingsScreen', () => () => null);
jest.mock('../src/ClinicProfileScreen', () => () => null);
jest.mock('../src/CurrencySettingsScreen', () => () => null);
jest.mock('../src/InputModeSettingsScreen', () => () => null);
jest.mock('../src/ManageGesturesScreen', () => () => null);
jest.mock('../src/TestGestureScreen', () => () => null);
jest.mock('../src/AllVisitsScreen', () => () => null);
jest.mock('../src/GestureInputProvider', () => ({
  GestureInputProvider: ({ children }) => children,
}));
jest.mock('../src/ReportProblemScreen', () => () => null);
jest.mock('../src/VisitAiSettingsScreen', () => () => null);
jest.mock('../src/database', () => ({
  getAppSettings: jest.fn().mockResolvedValue({ currencyCode: 'INR', defaultInputMode: 'gestures' }),
  getGestures: jest.fn().mockResolvedValue([]),
  subscribeAppSettings: jest.fn(() => jest.fn()),
}));

describe('navigationMatrix', () => {
  test('renders navigation container without crashing', () => {
    expect(() => render(<App />)).not.toThrow();
  });
});
