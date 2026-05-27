import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import AllVisitsScreen from '../src/AllVisitsScreen';
import { getAppSettings, getVisitsInDateRange } from '../src/database';
import { getLastAlertTitle, spyAlert } from './helpers/matrix';

jest.mock('../src/database', () => ({
  getVisitsInDateRange: jest.fn(),
  getAppSettings: jest.fn(),
}));

describe('AllVisitsScreen', () => {
  const navigation = { navigate: jest.fn() };
  let alertSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = spyAlert();
    getVisitsInDateRange.mockResolvedValue([]);
    getAppSettings.mockResolvedValue({ currencyCode: 'INR' });
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  test('loads visits when View visits is pressed', async () => {
    getVisitsInDateRange.mockResolvedValue([
      {
        id: 1,
        patient_id: 9,
        visit_date: '2026-05-02',
        complaints: 'Headache',
        diagnosis: 'Migraine',
        visit_cost: 150,
        patient_name: 'Bob Smith',
        first_name: 'Bob',
        middle_name: '',
        last_name: 'Smith',
        dob: '',
        family_id: 2,
        phone: '555-222',
        address: 'Two Street',
        medicine_count: 1,
      },
      {
        id: 2,
        patient_id: 10,
        visit_date: '2026-05-01',
        visit_cost: 80,
        patient_name: 'Alice Jones',
        first_name: 'Alice',
        middle_name: '',
        last_name: 'Jones',
        dob: '',
        family_id: 3,
        phone: '555-333',
        address: 'One Street',
        medicine_count: 0,
      },
    ]);

    render(<AllVisitsScreen navigation={navigation} />);

    const [startInput, endInput] = screen.getAllByPlaceholderText('YYYY-MM-DD');
    fireEvent.changeText(startInput, '2026-05-01');
    fireEvent.changeText(endInput, '2026-05-31');
    fireEvent.press(screen.getByTestId('view-visits-button'));

    await waitFor(() => {
      expect(getVisitsInDateRange).toHaveBeenCalledWith({
        startDate: '2026-05-01',
        endDate: '2026-05-31',
      });
    });

    expect(screen.getByText('Bob Smith')).toBeTruthy();
    expect(screen.getByText('Alice Jones')).toBeTruthy();
    expect(screen.getByText(/150/)).toBeTruthy();
    expect(screen.getByText(/80/)).toBeTruthy();
    expect(screen.getByText('2 visits')).toBeTruthy();
  });

  test('navigates to PatientVisits when a visit card is tapped', async () => {
    getVisitsInDateRange.mockResolvedValue([
      {
        id: 1,
        patient_id: 9,
        visit_date: '2026-05-02',
        complaints: '',
        diagnosis: '',
        visit_cost: 0,
        patient_name: 'Bob Smith',
        first_name: 'Bob',
        middle_name: '',
        last_name: 'Smith',
        dob: '',
        family_id: 2,
        phone: '555-222',
        address: 'Two Street',
        medicine_count: 0,
      },
    ]);

    render(<AllVisitsScreen navigation={navigation} />);
    fireEvent.press(screen.getByTestId('view-visits-button'));

    await waitFor(() => {
      expect(screen.getByText('Bob Smith')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Bob Smith'));

    expect(navigation.navigate).toHaveBeenCalledWith('PatientVisits', {
      patient: {
        id: 9,
        name: 'Bob Smith',
        first_name: 'Bob',
        middle_name: '',
        last_name: 'Smith',
        dob: '',
        family_id: 2,
        phone: '555-222',
        address: 'Two Street',
      },
    });
  });

  test('shows empty state when no visits match', async () => {
    render(<AllVisitsScreen navigation={navigation} />);
    fireEvent.press(screen.getByTestId('view-visits-button'));

    await waitFor(() => {
      expect(screen.getByText('No visits in this range.')).toBeTruthy();
    });
  });

  test.each([
    ['', '', 'Required'],
    ['bad', '2026-05-01', 'Invalid date'],
    ['2026-05-10', '2026-05-01', 'Invalid range'],
  ])('validation alert for start=%s end=%s', async (start, end, expectedTitle) => {
    render(<AllVisitsScreen navigation={navigation} />);
    const [startInput, endInput] = screen.getAllByPlaceholderText('YYYY-MM-DD');
    fireEvent.changeText(startInput, start);
    fireEvent.changeText(endInput, end);
    fireEvent.press(screen.getByTestId('view-visits-button'));
    await waitFor(() => {
      expect(getLastAlertTitle(alertSpy)).toBe(expectedTitle);
    });
    expect(getVisitsInDateRange).not.toHaveBeenCalled();
  });

  test('shows error alert when load fails', async () => {
    getVisitsInDateRange.mockRejectedValue(new Error('db'));
    render(<AllVisitsScreen navigation={navigation} />);
    const [startInput, endInput] = screen.getAllByPlaceholderText('YYYY-MM-DD');
    fireEvent.changeText(startInput, '2026-05-01');
    fireEvent.changeText(endInput, '2026-05-31');
    fireEvent.press(screen.getByTestId('view-visits-button'));
    await waitFor(() => {
      expect(getLastAlertTitle(alertSpy)).toBe('Error');
    });
  });

  test('shows initial prompt before search', () => {
    render(<AllVisitsScreen navigation={navigation} />);
    expect(screen.getByText(/Choose a date range/i)).toBeTruthy();
  });
});
