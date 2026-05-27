import { Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { sharePrescriptionPdf } from '../src/prescriptionPdf';
import { spyAlert } from './helpers/matrix';

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

describe('prescriptionPdf', () => {
  let alertSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = spyAlert();
    Sharing.isAvailableAsync.mockResolvedValue(true);
    Print.printToFileAsync.mockResolvedValue({ uri: 'file:///tmp/rx.pdf' });
    Sharing.shareAsync.mockResolvedValue(undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  test('sharePrescriptionPdf prints and shares when available', async () => {
    await sharePrescriptionPdf('<html>rx</html>');
    expect(Print.printToFileAsync).toHaveBeenCalledWith({ html: '<html>rx</html>' });
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///tmp/rx.pdf', {
      mimeType: 'application/pdf',
      dialogTitle: 'Prescription',
    });
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('sharePrescriptionPdf alerts when sharing unavailable', async () => {
    Sharing.isAvailableAsync.mockResolvedValue(false);
    await sharePrescriptionPdf('<html>rx</html>');
    expect(Print.printToFileAsync).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Sharing unavailable', expect.any(String));
  });

  test('sharePrescriptionPdf propagates print errors', async () => {
    Print.printToFileAsync.mockRejectedValue(new Error('print failed'));
    await expect(sharePrescriptionPdf('<html>rx</html>')).rejects.toThrow('print failed');
  });
});
