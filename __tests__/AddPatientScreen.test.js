import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import AddPatientScreen from '../src/AddPatientScreen';
import { addPatient } from '../src/database';

jest.mock('../src/database', () => ({
  addPatient: jest.fn(),
}));

describe('AddPatientScreen', () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    alertSpy.mockRestore();
  });

  test('shows validation error when required fields are missing', () => {
    render(<AddPatientScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('e.g. John'), 'Jane');
    fireEvent.press(screen.getByText('Save Patient'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Missing Fields',
      'Please fill in first name, last name, phone number, and address.'
    );
    expect(addPatient).not.toHaveBeenCalled();
  });

  test('saves patient with trimmed values and resets form', async () => {
    addPatient.mockResolvedValueOnce(11);

    render(<AddPatientScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('e.g. John'), '  John  ');
    fireEvent.changeText(screen.getByPlaceholderText('Optional'), '  Q  ');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Smith'), '  Public ');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. 555-123-4567'), ' 555-111-2222 ');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. 123 Main St, City, State'), ' 1 Main St ');

    fireEvent.press(screen.getByText('Save Patient'));

    await waitFor(() => {
      expect(addPatient).toHaveBeenCalledWith('John', 'Q', 'Public', '555-111-2222', '1 Main St');
    });

    expect(alertSpy).toHaveBeenCalledWith('Success', 'John Q Public has been added.');
    expect(screen.getByPlaceholderText('e.g. John').props.value).toBe('');
    expect(screen.getByPlaceholderText('Optional').props.value).toBe('');
    expect(screen.getByPlaceholderText('e.g. Smith').props.value).toBe('');
    expect(screen.getByPlaceholderText('e.g. 555-123-4567').props.value).toBe('');
    expect(screen.getByPlaceholderText('e.g. 123 Main St, City, State').props.value).toBe('');
  });
});
