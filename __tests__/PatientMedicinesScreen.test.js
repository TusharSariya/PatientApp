import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import PatientMedicinesScreen from '../src/PatientMedicinesScreen';
import { Alert } from 'react-native';
import {
  addMedicine,
  deleteMedicine,
  getMedicineHistory,
  getMedicines,
} from '../src/database';
import { pressAlertButton, spyAlert } from './helpers/matrix';

jest.mock('../src/database', () => ({
  getMedicines: jest.fn(),
  addMedicine: jest.fn(),
  deleteMedicine: jest.fn(),
  getMedicineHistory: jest.fn(),
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
    fireEvent.press(screen.getByTestId('frequency-preset-3'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. 7 days'), ' 7 days ');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Take after meals'), ' after meals ');

    fireEvent.press(screen.getByText('Save Medicine'));

    await waitFor(() => {
      expect(addMedicine).toHaveBeenCalledWith(9, {
        name: 'Amoxicillin',
        dosage: '500mg',
        frequency: '3x/day',
        intervalDays: 1,
        duration: '7 days',
        route: 'Oral',
        instructions: 'after meals',
      });
    });
  });

  test('saves adjusted medicine interval from the stepper', async () => {
    render(<PatientMedicinesScreen route={{ params: { patient } }} />);
    await waitFor(() => expect(getMedicines).toHaveBeenCalledWith(9));

    fireEvent.press(screen.getByText('+ Add'));
    fireEvent.changeText(screen.getByPlaceholderText('e.g. Amoxicillin'), 'Amoxicillin');
    fireEvent.press(screen.getByTestId('patient-medicine-interval-plus-5'));
    fireEvent.press(screen.getByText('Save Medicine'));

    await waitFor(() => {
      expect(addMedicine).toHaveBeenCalledWith(9, expect.objectContaining({
        intervalDays: 6,
      }));
    });
  });

  test('clamps dedicated medicine interval between 1 and 30 days', async () => {
    render(<PatientMedicinesScreen route={{ params: { patient } }} />);
    await waitFor(() => expect(getMedicines).toHaveBeenCalledWith(9));

    fireEvent.press(screen.getByText('+ Add'));

    expect(screen.getByTestId('patient-medicine-interval-value').props.children).toBe(1);
    fireEvent.press(screen.getByTestId('patient-medicine-interval-minus-5'));
    expect(screen.getByTestId('patient-medicine-interval-value').props.children).toBe(1);
    fireEvent.press(screen.getByTestId('patient-medicine-interval-plus-1'));
    expect(screen.getByTestId('patient-medicine-interval-value').props.children).toBe(2);
    fireEvent.press(screen.getByTestId('patient-medicine-interval-minus-1'));
    expect(screen.getByTestId('patient-medicine-interval-value').props.children).toBe(1);

    for (let i = 0; i < 6; i += 1) {
      fireEvent.press(screen.getByTestId('patient-medicine-interval-plus-5'));
    }

    expect(screen.getByTestId('patient-medicine-interval-value').props.children).toBe(30);
  });

  test('shows validation when medicine name missing', async () => {
    const alertSpy = spyAlert();
    render(<PatientMedicinesScreen route={{ params: { patient } }} />);
    await waitFor(() => expect(getMedicines).toHaveBeenCalledWith(9));
    fireEvent.press(screen.getByText('+ Add'));
    fireEvent.press(screen.getByText('Save Medicine'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    alertSpy.mockRestore();
  });

  test('deletes medicine after confirmation', async () => {
    const alertSpy = spyAlert();
    deleteMedicine.mockResolvedValue(undefined);
    render(<PatientMedicinesScreen route={{ params: { patient } }} />);
    await waitFor(() => expect(screen.getByText('Ibuprofen')).toBeTruthy());
    fireEvent.press(screen.getByText('Ibuprofen'));
    fireEvent.press(screen.getByText('Delete Medicine'));
    pressAlertButton(alertSpy, 1);
    await waitFor(() => expect(deleteMedicine).toHaveBeenCalledWith(1));
    alertSpy.mockRestore();
  });

  test('delete cancel keeps medicine', async () => {
    const alertSpy = spyAlert();
    render(<PatientMedicinesScreen route={{ params: { patient } }} />);
    await waitFor(() => expect(screen.getByText('Ibuprofen')).toBeTruthy());
    fireEvent.press(screen.getByText('Ibuprofen'));
    fireEvent.press(screen.getByText('Delete Medicine'));
    pressAlertButton(alertSpy, 0);
    expect(deleteMedicine).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
