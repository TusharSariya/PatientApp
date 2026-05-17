import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import AllVisitsScreen from '../src/AllVisitsScreen';
import { getVisitsInDateRange } from '../src/database';

jest.mock('../src/database', () => ({
  getVisitsInDateRange: jest.fn(),
}));

describe('AllVisitsScreen', () => {
  const navigation = { navigate: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    getVisitsInDateRange.mockResolvedValue([]);
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
    expect(screen.getByText(/Complaints: Headache/)).toBeTruthy();
    expect(screen.getByText(/Diagnosis: Migraine/)).toBeTruthy();
    expect(screen.getByText('1 visit')).toBeTruthy();
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
});
