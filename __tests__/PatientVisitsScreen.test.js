import React from 'react';
import { Alert, ScrollView } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import PatientVisitsScreen from '../src/PatientVisitsScreen';
import {
  getBalanceSummary,
  getAppSettings,
  getMedicines,
  getVisitMedicines,
  getVisits,
} from '../src/database';

jest.mock('../src/database', () => ({
  getVisits: jest.fn(),
  getVisitMedicines: jest.fn(),
  getBalanceSummary: jest.fn(),
  getMedicines: jest.fn(),
  getClinicProfile: jest.fn(),
  getAppSettings: jest.fn(),
  addVisit: jest.fn(),
}));

jest.mock('../src/prescriptionPdf', () => ({
  sharePrescriptionPdf: jest.fn(),
}));

function collectRenderedText(node, texts = []) {
  if (typeof node === 'string') {
    texts.push(node);
    return texts;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectRenderedText(child, texts));
    return texts;
  }
  node?.children?.forEach((child) => collectRenderedText(child, texts));
  return texts;
}

describe('PatientVisitsScreen', () => {
  const patient = {
    id: 9,
    name: 'Bob Smith',
    family_id: 2,
    phone: '555-222',
    address: 'Two Street',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getVisits.mockResolvedValue([]);
    getVisitMedicines.mockResolvedValue([]);
    getBalanceSummary.mockResolvedValue({
      patientBalance: 0,
      familyBalance: 0,
    });
    getAppSettings.mockResolvedValue({ currencyCode: 'INR' });
    getMedicines.mockResolvedValue([
      {
        id: 1,
        patient_id: 9,
        name: 'Ibuprofen',
        dosage: '400mg',
        frequency: '2x/day',
        interval_days: 1,
        duration: '5 days',
        route: 'Oral',
        instructions: 'Take with food',
      },
    ]);
  });

  test('shows current medicines when toggle is expanded', async () => {
    render(<PatientVisitsScreen route={{ params: { patient } }} />);

    await waitFor(() => {
      expect(getMedicines).toHaveBeenCalledWith(9);
    });

    expect(screen.getByText('Current medicines (1)')).toBeTruthy();
    expect(screen.queryByText('Ibuprofen')).toBeNull();

    fireEvent.press(screen.getByTestId('current-medicines-toggle'));

    expect(screen.getByText('Ibuprofen')).toBeTruthy();
    expect(screen.getByText('400mg · 2x/day · q1d')).toBeTruthy();

    fireEvent.press(screen.getByTestId('current-medicines-toggle'));
    expect(screen.queryByText('Ibuprofen')).toBeNull();
  });

  test('places medicine section before visit details in the new visit form', async () => {
    const { toJSON } = render(<PatientVisitsScreen route={{ params: { patient } }} />);

    await waitFor(() => {
      expect(screen.getByText('Current medicines (1)')).toBeTruthy();
    });

    const renderedText = collectRenderedText(toJSON());
    const medicineIndex = renderedText.indexOf('Prescribe Medicines');
    const complaintsIndex = renderedText.indexOf('Complaints');

    expect(medicineIndex).toBeGreaterThan(-1);
    expect(complaintsIndex).toBeGreaterThan(-1);
    expect(medicineIndex).toBeLessThan(complaintsIndex);
  });

  test('shows empty state when patient has no current medicines', async () => {
    getMedicines.mockResolvedValue([]);
    render(<PatientVisitsScreen route={{ params: { patient } }} />);

    await waitFor(() => {
      expect(getMedicines).toHaveBeenCalledWith(9);
    });

    expect(screen.getByText('Current medicines (0)')).toBeTruthy();
    fireEvent.press(screen.getByTestId('current-medicines-toggle'));
    expect(screen.getByText('No medicines on file.')).toBeTruthy();
  });

  test('tap current medicine pre-fills prescribe form', async () => {
    render(<PatientVisitsScreen route={{ params: { patient } }} />);

    await waitFor(() => {
      expect(screen.getByText('Current medicines (1)')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('current-medicines-toggle'));
    fireEvent.press(screen.getByText('Ibuprofen'));

    expect(screen.getByPlaceholderText('Medicine name').props.value).toBe('Ibuprofen');
    expect(screen.getByPlaceholderText('Dosage').props.value).toBe('400mg');
    expect(screen.getByPlaceholderText('Duration').props.value).toBe('5 days');
  });

  test('can edit and delete prescribed medicines before creating visit', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Remove')?.onPress?.();
    });

    render(<PatientVisitsScreen route={{ params: { patient } }} />);

    await waitFor(() => {
      expect(screen.getByText('Current medicines (1)')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByPlaceholderText('Medicine name'), 'Aspirin');
    fireEvent.changeText(screen.getByPlaceholderText('Dosage'), '100mg');
    fireEvent.press(screen.getByText('+ Add Prescribed Medicine'));

    expect(screen.getByText('Aspirin')).toBeTruthy();
    expect(screen.getByText('100mg · q1d')).toBeTruthy();

    fireEvent.press(screen.getByTestId('edit-draft-med-1'));
    expect(screen.getByText('Update Prescribed Medicine')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText('Medicine name'), 'Aspirin EC');
    fireEvent.press(screen.getByText('Update Prescribed Medicine'));

    expect(screen.getByText('Aspirin EC')).toBeTruthy();
    expect(screen.queryByText('Aspirin')).toBeNull();

    fireEvent.press(screen.getByTestId('delete-draft-med-1'));

    expect(screen.queryByText('Aspirin EC')).toBeNull();
  });

  test('scrolls to the medicine section after adding a prescribed medicine', async () => {
    const scrollSpy = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});

    render(<PatientVisitsScreen route={{ params: { patient } }} />);

    await waitFor(() => {
      expect(screen.getByText('Current medicines (1)')).toBeTruthy();
    });

    fireEvent(screen.getByTestId('visit-medicine-section'), 'layout', {
      nativeEvent: { layout: { y: 88 } },
    });
    fireEvent.changeText(screen.getByPlaceholderText('Medicine name'), 'Aspirin');
    fireEvent.press(screen.getByText('+ Add Prescribed Medicine'));

    expect(screen.getByText('Aspirin')).toBeTruthy();
    expect(scrollSpy).toHaveBeenCalledWith({ y: 88, animated: true });

    scrollSpy.mockRestore();
  });
});
