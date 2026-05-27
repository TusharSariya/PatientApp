import { Alert } from 'react-native';
import { INPUT_MODES } from '../../src/inputMode';

export const INPUT_MODE_IDS = INPUT_MODES.map((mode) => mode.id);

export function makeNavigation() {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
    setParams: jest.fn(),
  };
}

export function spyAlert() {
  const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  return spy;
}

export function pressAlertButton(spy, buttonIndex = 0) {
  const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
  const buttons = lastCall?.[2];
  const button = buttons?.[buttonIndex];
  if (button?.onPress) {
    button.onPress();
  }
}

export function getLastAlertTitle(spy) {
  const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
  return lastCall?.[0];
}

export const PAYMENT_SCOPES = ['patient', 'family'];
export const WEIGHT_UNITS = ['kg', 'lbs'];
