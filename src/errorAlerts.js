import { Alert } from 'react-native';

import { reportError } from './errorLog';

export function showErrorAlert(navigation, {
  title = 'Error',
  message,
  screen,
  prefill,
  error,
} = {}) {
  const safeMessage = message ?? 'Something went wrong.';
  reportError(error ?? new Error(safeMessage), {
    screen,
    action: title,
    prefill: prefill ?? safeMessage,
  });

  const buttons = [{ text: 'OK', style: 'cancel' }];
  if (navigation?.navigate) {
    buttons.push({
      text: 'Report',
      onPress: () => navigation.navigate('ReportProblem', {
        prefill: prefill ?? safeMessage,
        screen,
      }),
    });
  }

  Alert.alert(title, safeMessage, buttons);
}
