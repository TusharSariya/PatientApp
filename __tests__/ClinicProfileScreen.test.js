import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ClinicProfileScreen from '../src/ClinicProfileScreen';
import { getClinicProfile, saveClinicProfile } from '../src/database';
import { getLastAlertTitle, pressAlertButton, spyAlert } from './helpers/matrix';

jest.mock('@react-navigation/native', () => {
  const ReactNative = jest.requireActual('@react-navigation/native');
  const React = require('react');
  return {
    ...ReactNative,
    useFocusEffect: (effect) => {
      React.useEffect(() => effect(), [effect]);
    },
  };
});

jest.mock('../src/database', () => ({
  getClinicProfile: jest.fn(),
  saveClinicProfile: jest.fn(),
}));

describe('ClinicProfileScreen', () => {
  let alertSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = spyAlert();
    getClinicProfile.mockResolvedValue({
      doctorName: 'Dr Test',
      qualifications: 'MBBS',
      address: 'Clinic Rd',
      contact: '555',
      registration: 'REG1',
      hours: '9-5',
    });
    saveClinicProfile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  test('shows loading then populated fields', async () => {
    render(<ClinicProfileScreen />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('Dr Test')).toBeTruthy();
    });
    expect(screen.getByDisplayValue('MBBS')).toBeTruthy();
  });

  test('save success shows confirmation alert', async () => {
    render(<ClinicProfileScreen />);
    await waitFor(() => expect(screen.getByDisplayValue('Dr Test')).toBeTruthy());

    fireEvent.press(screen.getByTestId('clinic-profile-save'));

    await waitFor(() => {
      expect(saveClinicProfile).toHaveBeenCalledWith({
        doctorName: 'Dr Test',
        qualifications: 'MBBS',
        address: 'Clinic Rd',
        contact: '555',
        registration: 'REG1',
        hours: '9-5',
      });
    });
    expect(getLastAlertTitle(alertSpy)).toBe('Saved');
  });

  test('save error shows error alert', async () => {
    saveClinicProfile.mockRejectedValue(new Error('fail'));
    render(<ClinicProfileScreen />);
    await waitFor(() => expect(screen.getByDisplayValue('Dr Test')).toBeTruthy());

    fireEvent.press(screen.getByTestId('clinic-profile-save'));

    await waitFor(() => {
      expect(getLastAlertTitle(alertSpy)).toBe('Error');
    });
  });

  test('loads empty profile when database returns blanks', async () => {
    getClinicProfile.mockResolvedValue({
      doctorName: '',
      qualifications: '',
      address: '',
      contact: '',
      registration: '',
      hours: '',
    });
    render(<ClinicProfileScreen />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g. Dr Linesh Yawalkar')).toBeTruthy();
    });
  });
});
