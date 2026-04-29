import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import PatientMedicinesScreen from '../src/PatientMedicinesScreen';
import {
  addMedicine,
  getMedicineHistory,
  getMedicines,
} from '../src/database';

jest.mock('../src/database', () => ({
  getMedicines: jest.fn(),
  addMedicine: jest.fn(),
  deleteMedicine: jest.fn(),
  getMedicineHistory: jest.fn(),
}));

describe('PatientMedicinesScreen', () => {
  const patient = {
    id: 9,
    name: 'Bob Smith',
    phone: '555-222',
    address: 'Two Street',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getMedicines.mockResolvedValue([
      { id: 1, patient_id: 9, name: 'Ibuprofen', dosage: '400mg', frequency: 'Twice daily' },
    ]);
    getMedicineHistory.mockResolvedValue([
      { id: 100, patient_id: 9, action: 'removed', name: 'Paracetamol', dosage: '500mg', created_at: '2026-04-29 10:00:00' },
    ]);
    addMedicine.mockResolvedValue(2);
  });

  test('renders current medicines and medicine history', async () => {
    render(<PatientMedicinesScreen route={{ params: { patient } }} />);

    await waitFor(() => {
      expect(getMedicines).toHaveBeenCalledWith(9);
      expect(getMedicineHistory).toHaveBeenCalledWith(9);
    });

    expect(screen.getByText('Current Medicines')).toBeTruthy();
    expect(screen.getByText('Ibuprofen')).toBeTruthy();
    expect(screen.getByText('Medicine History')).toBeTruthy();
    expect(screen.getByText('Removed: Paracetamol · 500mg')).toBeTruthy();
  });

  test('adds medicine from the dedicated screen', async () => {
    render(<PatientMedicinesScreen route={{ params: { patient } }} />);
    await waitFor(() => expect(getMedicines).toHaveBeenCalledWith(9));

    fireEvent.press(screen.getByText('+ Add'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Amoxicillin'), '  Amoxicillin  ');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. 500mg'), ' 500mg ');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Twice daily'), ' Three times daily ');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. 7 days'), ' 7 days ');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Take after meals'), ' after meals ');

    fireEvent.press(screen.getByText('Save Medicine'));

    await waitFor(() => {
      expect(addMedicine).toHaveBeenCalledWith(9, {
        name: 'Amoxicillin',
        dosage: '500mg',
        frequency: 'Three times daily',
        duration: '7 days',
        route: 'Oral',
        instructions: 'after meals',
      });
    });
  });
});
