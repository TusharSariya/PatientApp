export const DEFAULT_INPUT_MODE = 'gestures';

export const INPUT_MODES = [
  {
    id: 'gestures',
    title: 'Gestures',
    subtitle: 'Open the gesture pad when supported fields are focused.',
  },
  {
    id: 'voice',
    title: 'Voice',
    subtitle: 'Open input controls and start dictation on focus.',
  },
  {
    id: 'keyboard',
    title: 'Keyboard',
    subtitle: 'Use the native keyboard by default.',
  },
];

export function normalizeInputMode(value) {
  return INPUT_MODES.some((mode) => mode.id === value) ? value : DEFAULT_INPUT_MODE;
}
