import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import AddPatientScreen from '../src/AddPatientScreen';
import { addPatient, searchFamiliesByRelativeName } from '../src/database';
import { getLastAlertTitle, spyAlert } from './helpers/matrix';

jest.mock('../src/database', () => ({
  addPatient: jest.fn(),
  searchFamiliesByRelativeName: jest.fn(),
}));

jest.mock('../src/GestureInputProvider', () => ({
  useGestureTextInput: () => ({
    ref: { current: null },
    showSoftInputOnFocus: true,
    onFocus: jest.fn(),
    onBlur: jest.fn(),
    onSelectionChange: jest.fn(),
    selection: { start: 0, end: 0 },
  }),
}));

describe('AddPatientScreen', () => {
  let alertSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = spyAlert();
    searchFamiliesByRelativeName.mockResolvedValue([]);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  test('shows validation error when first name or last name is missing', () => {
    render(<AddPatientScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('e.g. John'), 'Jane');
    fireEvent.press(screen.getByText('Save Patient'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Missing Fields',
      'Please fill in first name and last name.'
    );
    expect(addPatient).not.toHaveBeenCalled();
  });

  test('shows save error alert when addPatient fails', async () => {
    addPatient.mockRejectedValue(new Error('db'));
    render(<AddPatientScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('e.g. John'), 'John');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Smith'), 'Public');
    fireEvent.press(screen.getByText('Save Patient'));
    await waitFor(() => expect(getLastAlertTitle(alertSpy)).toBe('Error'));
  });

  test('selects family match from relative search', async () => {
    searchFamiliesByRelativeName.mockResolvedValue([
      { family_id: 5, relative_name: 'Ann Lee', member_count: 2 },
    ]);
    addPatient.mockResolvedValue({ patientId: 1, familyId: 5, createdNewFamily: false });
    render(<AddPatientScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Type relative name (e.g. Alice Johnson)'), 'Lee');
    await waitFor(() => expect(screen.getByText('Family #5')).toBeTruthy());
    fireEvent.press(screen.getByText('Family #5'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. John'), 'John');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Smith'), 'Lee');
    fireEvent.press(screen.getByText('Save Patient'));
    await waitFor(() => {
      expect(addPatient).toHaveBeenCalledWith('John', '', 'Lee', '', '', '', '5');
    });
  });

  test('does not render manual gesture buttons for text fields', () => {
    render(<AddPatientScreen />);

    expect(screen.queryByText('Use Gesture')).toBeNull();
  });

  test('saves patient with only first and last name', async () => {
    addPatient.mockResolvedValueOnce({
      patientId: 21,
      familyId: 11,
      createdNewFamily: true,
    });

    render(<AddPatientScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('e.g. John'), '  John  ');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Smith'), '  Public ');

    fireEvent.press(screen.getByText('Save Patient'));

    await waitFor(() => {
      expect(addPatient).toHaveBeenCalledWith('John', '', 'Public', '', '', '', '');
    });

    expect(alertSpy).toHaveBeenCalledWith('Success', 'John Public has been added. Created family #11.');
    expect(screen.getByPlaceholderText('e.g. John').props.value).toBe('');
    expect(screen.getByPlaceholderText('Optional').props.value).toBe('');
    expect(screen.getByPlaceholderText('e.g. Smith').props.value).toBe('');
    expect(screen.getByPlaceholderText('e.g. 555-123-4567').props.value).toBe('');
    expect(screen.getByPlaceholderText('e.g. 123 Main St, City, State').props.value).toBe('');
  });

  test('saves optional fields as trimmed strings when provided', async () => {
    addPatient.mockResolvedValueOnce({
      patientId: 22,
      familyId: 12,
      createdNewFamily: true,
    });

    render(<AddPatientScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('e.g. John'), '  John  ');
    fireEvent.changeText(screen.getByPlaceholderText('Optional'), '  Q  ');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Smith'), '  Public ');
    fireEvent.changeText(screen.getByPlaceholderText('YYYY-MM-DD'), ' 2000-01-02 ');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. 555-123-4567'), ' 555-111-2222 ');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. 123 Main St, City, State'), ' 1 Main St ');

    fireEvent.press(screen.getByText('Save Patient'));

    await waitFor(() => {
      expect(addPatient).toHaveBeenCalledWith('John', 'Q', 'Public', '2000-01-02', '555-111-2222', '1 Main St', '');
    });
  });
});
