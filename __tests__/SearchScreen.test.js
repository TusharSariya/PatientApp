import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import SearchScreen from '../src/SearchScreen';
import { getAllPatients, searchPatients } from '../src/database';

jest.mock('../src/database', () => ({
  searchPatients: jest.fn(),
  getAllPatients: jest.fn(),
}));

const BASE_PATIENTS = [
  { id: 1, name: 'Alice Johnson', phone: '555-111', address: 'One St' },
  { id: 2, name: 'Bob Smith', phone: '555-222', address: 'Two St' },
];

describe('SearchScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAllPatients.mockResolvedValue(BASE_PATIENTS);
    searchPatients.mockResolvedValue([BASE_PATIENTS[0]]);
  });

  test('loads all patients on mount', async () => {
    render(<SearchScreen navigation={{ navigate: jest.fn() }} />);

    await waitFor(() => {
      expect(getAllPatients).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Alice Johnson')).toBeTruthy();
    expect(screen.getByText('Bob Smith')).toBeTruthy();
  });

  test('searches by typed prefixes with normalized filters', async () => {
    render(<SearchScreen navigation={{ navigate: jest.fn() }} />);
    await waitFor(() => expect(getAllPatients).toHaveBeenCalledTimes(1));

    fireEvent.changeText(screen.getByPlaceholderText('Prefix, e.g. Jo'), '  Al ');

    await waitFor(() => {
      expect(searchPatients).toHaveBeenCalledWith({
        firstName: 'Al',
        middleName: '',
        lastName: '',
      });
    });
  });

  test('opens patient details on card press', async () => {
    const navigation = { navigate: jest.fn() };
    render(<SearchScreen navigation={navigation} />);

    await waitFor(() => expect(screen.getByText('Alice Johnson')).toBeTruthy());
    fireEvent.press(screen.getByText('Alice Johnson'));

    expect(navigation.navigate).toHaveBeenCalledWith('PatientDetail', {
      patient: BASE_PATIENTS[0],
    });
  });
});
