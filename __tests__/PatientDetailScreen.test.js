import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => {
  const ReactNative = jest.requireActual('@react-navigation/native');
  return {
    ...ReactNative,
    useFocusEffect: jest.fn(),
  };
});

import PatientDetailScreen from '../src/PatientDetailScreen';
import { useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { clearDictationOwner } from '../src/dictationOwner';
import { searchFamiliesByRelativeName, updatePatient, updatePatientFamily } from '../src/database';

jest.mock('../src/database', () => ({
  getGestures: jest.fn().mockResolvedValue([]),
  getAppSettings: jest.fn().mockResolvedValue({ currencyCode: 'INR' }),
  getBalanceSummary: jest.fn().mockResolvedValue({
    patientBalance: 0,
    familyBalance: 0,
  }),
  searchFamiliesByRelativeName: jest.fn(),
  updatePatient: jest.fn(),
  updatePatientFamily: jest.fn(),
}));

jest.mock('../src/GestureInputProvider', () => ({
  useGestureTextInput: () => ({
    ref: { current: null },
    showSoftInputOnFocus: true,
    onFocus: jest.fn(),
    onBlur: jest.fn(),
    onSelectionChange: jest.fn(),
    selection: { start: 8, end: 8 },
    setSelection: jest.fn(),
  }),
}));

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    start: jest.fn(),
    stop: jest.fn(),
  },
  useSpeechRecognitionEvent: jest.fn(),
}));

describe('PatientDetailScreen', () => {
  const speechHandlers = {};

  function openPatientDetails() {
    fireEvent.press(screen.getByTestId('patient-details-menu-card'));
  }

  beforeEach(() => {
    jest.clearAllMocks();
    updatePatient.mockResolvedValue(undefined);
    updatePatientFamily.mockResolvedValue({ familyId: 12, changed: true });
    searchFamiliesByRelativeName.mockResolvedValue([]);
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-26T12:00:00Z').getTime());
    clearDictationOwner();
    Object.keys(speechHandlers).forEach((key) => {
      delete speechHandlers[key];
    });
    useSpeechRecognitionEvent.mockImplementation((eventName, handler) => {
      speechHandlers[eventName] = handler;
    });
  });

  afterEach(() => {
    Date.now.mockRestore();
  });

  test('opens medicines screen', () => {
    const patient = {
      id: 5,
      name: 'Alice Johnson',
      phone: '555-111',
      address: 'One Street',
    };
    const navigation = { navigate: jest.fn() };

    render(<PatientDetailScreen route={{ params: { patient } }} navigation={navigation} />);

    const openButtons = screen.getAllByText('Open');
    fireEvent.press(openButtons[openButtons.length - 1]);

    expect(navigation.navigate).toHaveBeenCalledWith('PatientMedicines', { patient });
  });

  test('does not render Rx tab', () => {
    const patient = {
      id: 5,
      name: 'Alice Johnson',
      phone: '555-111',
      address: 'One Street',
    };

    render(<PatientDetailScreen route={{ params: { patient } }} navigation={{ navigate: jest.fn() }} />);

    expect(screen.queryByText('Rx')).toBeNull();
    expect(screen.queryByText('Complaints')).toBeNull();
  });

  test('hides patient detail fields behind the patient details menu card', () => {
    const patient = {
      id: 5,
      name: 'Alice Johnson',
      dob: '1990-02-14',
      phone: '555-111',
      address: 'One Street',
    };

    render(<PatientDetailScreen route={{ params: { patient } }} navigation={{ navigate: jest.fn() }} />);

    expect(screen.getByText('Patient Details')).toBeTruthy();
    expect(screen.getByText('Visits')).toBeTruthy();
    expect(screen.getByText('Medicines')).toBeTruthy();
    expect(screen.queryByTestId('patient-detail-first-name')).toBeNull();

    openPatientDetails();

    expect(screen.getByTestId('patient-detail-first-name')).toBeTruthy();
    expect(screen.getByText('Edit')).toBeTruthy();
  });

  test('shows computed age when patient has a valid date of birth', () => {
    const patient = {
      id: 5,
      name: 'Alice Johnson',
      dob: '1990-02-14',
      phone: '555-111',
      address: 'One Street',
    };

    render(<PatientDetailScreen route={{ params: { patient } }} navigation={{ navigate: jest.fn() }} />);

    openPatientDetails();

    expect(screen.getByTestId('patient-detail-dob').props.value).toBe('1990-02-14');
    expect(screen.getAllByText('Age: 36 years').length).toBeGreaterThanOrEqual(1);
  });

  test('subtracts one year when birthday has not occurred yet this year', () => {
    const patient = {
      id: 5,
      name: 'Alice Johnson',
      dob: '1990-12-01',
      phone: '555-111',
      address: 'One Street',
    };

    render(<PatientDetailScreen route={{ params: { patient } }} navigation={{ navigate: jest.fn() }} />);

    openPatientDetails();

    expect(screen.getAllByText('Age: 35 years').length).toBeGreaterThanOrEqual(1);
  });

  test('does not show computed age without a valid past date of birth', () => {
    const basePatient = {
      id: 5,
      name: 'Alice Johnson',
      phone: '555-111',
      address: 'One Street',
    };

    const { rerender } = render(
      <PatientDetailScreen route={{ params: { patient: basePatient } }} navigation={{ navigate: jest.fn() }} />
    );
    openPatientDetails();
    expect(screen.queryByText(/^Age:/)).toBeNull();

    rerender(
      <PatientDetailScreen
        route={{ params: { patient: { ...basePatient, dob: 'not-a-date' } } }}
        navigation={{ navigate: jest.fn() }}
      />
    );
    openPatientDetails();
    expect(screen.queryByText(/^Age:/)).toBeNull();

    rerender(
      <PatientDetailScreen
        route={{ params: { patient: { ...basePatient, dob: '2027-01-01' } } }}
        navigation={{ navigate: jest.fn() }}
      />
    );
    openPatientDetails();
    expect(screen.queryByText(/^Age:/)).toBeNull();
  });

  test('locks patient detail fields until edit is pressed', () => {
    const patient = {
      id: 5,
      name: 'Alice Johnson',
      first_name: 'Alice',
      middle_name: '',
      last_name: 'Johnson',
      dob: '1990-02-14',
      phone: '555-111',
      address: 'One Street',
      notes: 'Existing notes',
    };

    render(<PatientDetailScreen route={{ params: { patient } }} navigation={{ navigate: jest.fn() }} />);

    openPatientDetails();

    expect(screen.getByTestId('patient-detail-first-name').props.editable).toBe(false);
    expect(screen.getByTestId('patient-detail-notes').props.editable).toBe(false);
    expect(screen.getByText('Edit')).toBeTruthy();

    fireEvent.press(screen.getByTestId('patient-detail-edit-save-button'));

    expect(screen.getByTestId('patient-detail-first-name').props.editable).toBe(true);
    expect(screen.getByTestId('patient-detail-notes').props.editable).toBe(true);
    expect(screen.getByText('Save')).toBeTruthy();
  });

  test('updates displayed age while editing date of birth', () => {
    const patient = {
      id: 5,
      name: 'Alice Johnson',
      first_name: 'Alice',
      middle_name: '',
      last_name: 'Johnson',
      dob: '1990-02-14',
      phone: '555-111',
      address: 'One Street',
    };

    render(<PatientDetailScreen route={{ params: { patient } }} navigation={{ navigate: jest.fn() }} />);

    openPatientDetails();
    fireEvent.press(screen.getByTestId('patient-detail-edit-save-button'));
    fireEvent.changeText(screen.getByTestId('patient-detail-dob'), '1990-12-01');

    expect(screen.getAllByText('Age: 35 years').length).toBeGreaterThanOrEqual(1);
  });

  test('saves trimmed patient details and locks fields again', async () => {
    const patient = {
      id: 5,
      name: 'Alice Johnson',
      first_name: 'Alice',
      middle_name: '',
      last_name: 'Johnson',
      dob: '1990-02-14',
      phone: '555-111',
      address: 'One Street',
      notes: 'Existing notes',
    };
    const navigation = { navigate: jest.fn(), setParams: jest.fn() };

    render(<PatientDetailScreen route={{ params: { patient } }} navigation={navigation} />);

    openPatientDetails();
    fireEvent.press(screen.getByTestId('patient-detail-edit-save-button'));
    fireEvent.changeText(screen.getByTestId('patient-detail-first-name'), '  Alice  ');
    fireEvent.changeText(screen.getByTestId('patient-detail-middle-name'), '  Marie ');
    fireEvent.changeText(screen.getByTestId('patient-detail-last-name'), '  Johnson  ');
    fireEvent.changeText(screen.getByTestId('patient-detail-dob'), ' 1990-02-14 ');
    fireEvent.changeText(screen.getByTestId('patient-detail-phone'), ' 555-999 ');
    fireEvent.changeText(screen.getByTestId('patient-detail-address'), ' Two Street ');
    fireEvent.changeText(screen.getByTestId('patient-detail-notes'), ' Updated notes ');
    fireEvent.press(screen.getByTestId('patient-detail-edit-save-button'));

    await waitFor(() => {
      expect(updatePatient).toHaveBeenCalledWith(5, {
        firstName: 'Alice',
        middleName: 'Marie',
        lastName: 'Johnson',
        dob: '1990-02-14',
        phone: '555-999',
        address: 'Two Street',
        notes: 'Updated notes',
      });
    });

    expect(screen.getByTestId('patient-detail-first-name').props.editable).toBe(false);
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(navigation.setParams).toHaveBeenCalledWith({
      patient: expect.objectContaining({
        name: 'Alice Marie Johnson',
        phone: '555-999',
        address: 'Two Street',
        notes: 'Updated notes',
      }),
    });
  });

  test('shows family search only while editing patient details', async () => {
    const patient = {
      id: 5,
      name: 'Alice Johnson',
      first_name: 'Alice',
      last_name: 'Johnson',
      family_id: 2,
    };

    render(<PatientDetailScreen route={{ params: { patient } }} navigation={{ navigate: jest.fn() }} />);

    openPatientDetails();

    expect(screen.getAllByText('Family #2').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId('patient-detail-family-search')).toBeNull();

    fireEvent.press(screen.getByTestId('patient-detail-edit-save-button'));

    expect(screen.getByTestId('patient-detail-family-search')).toBeTruthy();
  });

  test('selects a family and saves the patient family change', async () => {
    const patient = {
      id: 5,
      name: 'Alice Johnson',
      first_name: 'Alice',
      last_name: 'Johnson',
      family_id: 2,
    };
    const navigation = { navigate: jest.fn(), setParams: jest.fn() };
    searchFamiliesByRelativeName.mockResolvedValue([
      { family_id: 12, relative_name: 'Bob Smith', member_count: 2 },
    ]);
    updatePatientFamily.mockResolvedValue({ familyId: 12, changed: true });

    render(<PatientDetailScreen route={{ params: { patient } }} navigation={navigation} />);

    openPatientDetails();
    fireEvent.press(screen.getByTestId('patient-detail-edit-save-button'));
    fireEvent.changeText(screen.getByTestId('patient-detail-family-search'), 'Bob');

    await waitFor(() => {
      expect(searchFamiliesByRelativeName).toHaveBeenCalledWith('Bob');
    });

    fireEvent.press(screen.getByTestId('patient-detail-family-match-12'));
    fireEvent.press(screen.getByTestId('patient-detail-edit-save-button'));

    await waitFor(() => {
      expect(updatePatientFamily).toHaveBeenCalledWith(5, '12');
    });
    expect(navigation.setParams).toHaveBeenCalledWith({
      patient: expect.objectContaining({ family_id: 12 }),
    });
    expect(screen.getAllByText('Family #12').length).toBeGreaterThanOrEqual(1);
  });

  test('blocked family move shows the database error and keeps editing', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const patient = {
      id: 5,
      name: 'Alice Johnson',
      first_name: 'Alice',
      last_name: 'Johnson',
      family_id: 2,
    };
    searchFamiliesByRelativeName.mockResolvedValue([
      { family_id: 12, relative_name: 'Bob Smith', member_count: 2 },
    ]);
    updatePatientFamily.mockRejectedValue(new Error('Patient balance must be zero before moving to another family.'));

    render(<PatientDetailScreen route={{ params: { patient } }} navigation={{ navigate: jest.fn() }} />);

    openPatientDetails();
    fireEvent.press(screen.getByTestId('patient-detail-edit-save-button'));
    fireEvent.changeText(screen.getByTestId('patient-detail-family-search'), 'Bob');

    await waitFor(() => {
      expect(screen.getByTestId('patient-detail-family-match-12')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('patient-detail-family-match-12'));
    fireEvent.press(screen.getByTestId('patient-detail-edit-save-button'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Error', 'Patient balance must be zero before moving to another family.');
    });
    expect(updatePatient).not.toHaveBeenCalled();
    expect(screen.getByText('Save')).toBeTruthy();
    expect(screen.getByTestId('patient-detail-family-search')).toBeTruthy();

    alertSpy.mockRestore();
  });

  test('requires first and last name before saving inline details', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const patient = {
      id: 5,
      name: 'Alice Johnson',
      first_name: 'Alice',
      middle_name: '',
      last_name: 'Johnson',
      phone: '555-111',
      address: 'One Street',
    };

    render(<PatientDetailScreen route={{ params: { patient } }} navigation={{ navigate: jest.fn() }} />);

    openPatientDetails();
    fireEvent.press(screen.getByTestId('patient-detail-edit-save-button'));
    fireEvent.changeText(screen.getByTestId('patient-detail-last-name'), ' ');
    fireEvent.press(screen.getByTestId('patient-detail-edit-save-button'));

    expect(alertSpy).toHaveBeenCalledWith('Missing Fields', 'Please fill in first name and last name.');
    expect(updatePatient).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  test('dictation inserts into existing field text instead of overwriting', async () => {
    const patient = {
      id: 5,
      name: 'Alice Johnson',
      first_name: 'Alice',
      last_name: 'Johnson',
      phone: '555-111',
      address: 'One Street',
    };

    render(<PatientDetailScreen route={{ params: { patient } }} navigation={{ navigate: jest.fn() }} />);

    openPatientDetails();
    fireEvent.press(screen.getByTestId('patient-detail-edit-save-button'));
    const notesInput = screen.getByTestId('patient-detail-notes');
    fireEvent.changeText(notesInput, 'existing');
    fireEvent(notesInput, 'selectionChange', { nativeEvent: { selection: { start: 8, end: 8 } } });
    fireEvent.press(screen.getByText('🎙'));
    await waitFor(() => expect(speechHandlers.start).toBeTruthy());

    act(() => {
      speechHandlers.start?.();
      speechHandlers.result?.({ results: [{ transcript: 'fever' }] });
    });

    expect(screen.getByTestId('patient-detail-notes').props.value).toBe('existing fever');
  });
});
