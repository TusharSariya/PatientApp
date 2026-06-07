import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ReportProblemScreen from '../src/ReportProblemScreen';
import { shareDiagnosticReport } from '../src/shareDiagnosticReport';

jest.mock('../src/database', () => ({
  getAppSettings: jest.fn().mockResolvedValue({ currencyCode: 'INR', defaultInputMode: 'gestures' }),
  getAllPatients: jest.fn().mockResolvedValue([]),
}));

jest.mock('../src/shareDiagnosticReport', () => ({
  shareDiagnosticReport: jest.fn().mockResolvedValue(undefined),
}));

describe('ReportProblemScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('prefills notes from route params and shares report', async () => {
    render(<ReportProblemScreen route={{ params: { prefill: 'Could not save visit' } }} />);

    expect(screen.getByTestId('report-problem-notes').props.value).toBe('Could not save visit');

    await waitFor(() => {
      expect(screen.getByText(/App version:/)).toBeTruthy();
    });

    fireEvent.changeText(screen.getByTestId('report-problem-notes'), 'Steps to reproduce here');
    fireEvent.press(screen.getByTestId('report-problem-send'));

    await waitFor(() => {
      expect(shareDiagnosticReport).toHaveBeenCalledWith({
        userNotes: 'Steps to reproduce here',
      });
    });
  });

  test('shows alert when share fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    shareDiagnosticReport.mockRejectedValueOnce(new Error('share failed'));

    render(<ReportProblemScreen route={{ params: {} }} />);
    await waitFor(() => expect(screen.getByTestId('report-problem-send')).toBeTruthy());
    fireEvent.press(screen.getByTestId('report-problem-send'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Error', 'Could not share the diagnostic report.');
    });

    alertSpy.mockRestore();
  });
});
