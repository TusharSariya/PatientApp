import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import EditPatientScreen from '../src/EditPatientScreen';
import { updatePatient } from '../src/database';
import { getLastAlertTitle, spyAlert } from './helpers/matrix';

jest.mock('../src/database', () => ({
  updatePatient: jest.fn(),
}));

describe('EditPatientScreen', () => {
  const patient = {
    id: 4,
    first_name: 'Bob',
    middle_name: '',
    last_name: 'Smith',
    name: 'Bob Smith',
    dob: '1990-01-01',
    phone: '555-111',
    address: 'Main St',
  };
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  let alertSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = spyAlert();
    updatePatient.mockResolvedValue(undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  test('shows validation when required fields cleared', async () => {
    render(<EditPatientScreen route={{ params: { patient } }} navigation={navigation} />);
    fireEvent.changeText(screen.getByDisplayValue('Bob'), '');
    fireEvent.press(screen.getByText('Save Details'));

    await waitFor(() => {
      expect(getLastAlertTitle(alertSpy)).toBe('Missing Fields');
    });
    expect(updatePatient).not.toHaveBeenCalled();
  });

  test('saves and navigates back to patient detail', async () => {
    render(<EditPatientScreen route={{ params: { patient } }} navigation={navigation} />);
    fireEvent.changeText(screen.getByDisplayValue('Main St'), 'New Address');
    fireEvent.press(screen.getByText('Save Details'));

    await waitFor(() => {
      expect(updatePatient).toHaveBeenCalledWith(4, expect.objectContaining({
        address: 'New Address',
      }));
    });
    expect(navigation.navigate).toHaveBeenCalledWith({
      name: 'PatientDetail',
      params: { patient: expect.objectContaining({ address: 'New Address' }) },
      merge: true,
    });
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('shows error alert when save fails', async () => {
    updatePatient.mockRejectedValue(new Error('db'));
    render(<EditPatientScreen route={{ params: { patient } }} navigation={navigation} />);
    fireEvent.press(screen.getByText('Save Details'));

    await waitFor(() => {
      expect(getLastAlertTitle(alertSpy)).toBe('Error');
    });
  });
});
