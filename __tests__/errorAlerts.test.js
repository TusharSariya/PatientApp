import { Alert } from 'react-native';

import { showErrorAlert } from '../src/errorAlerts';
import { clearRecentErrors } from '../src/errorLog';

describe('errorAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearRecentErrors();
  });

  test('showErrorAlert logs error and offers report navigation', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const navigation = { navigate: jest.fn() };

    showErrorAlert(navigation, {
      message: 'Failed to save patient.',
      screen: 'AddPatient',
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Error',
      'Failed to save patient.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'OK' }),
        expect.objectContaining({ text: 'Report' }),
      ])
    );

    const buttons = alertSpy.mock.calls[0][2];
    buttons.find((button) => button.text === 'Report').onPress();
    expect(navigation.navigate).toHaveBeenCalledWith('ReportProblem', {
      prefill: 'Failed to save patient.',
      screen: 'AddPatient',
    });

    alertSpy.mockRestore();
  });
});
