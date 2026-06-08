export const GESTURE_GUIDE_TITLE = 'How gestures work';

export const GESTURE_GUIDE_SECTIONS = {
  overview:
    'Draw symbols instead of typing. Symbols build codes; phrases expand codes into full text.',
  setup: [
    'Symbols — draw one stroke per letter (U, R, I).',
    'Phrases — map codes to text (U → urine, URI → Upper Respiratory Infection).',
    'Shortcuts (optional) — one multi-stroke pattern that inserts without spelling.',
  ],
  usingInFields:
    'While typing, each symbol stroke builds a code (U → UR → URI). Matching phrases update the open text retroactively. Tap Stream Done to lock committed text before starting the next code.',
  controls:
    'Stream Done locks the current phrase. Clear Stream removes the open strokes. Done closes the gesture sheet.',
  example:
    'Example: draw U for urine, then add R and I to upgrade to Upper Respiratory Infection. Tap Stream Done before drawing the next symbol.',
};

export const GESTURE_TEST_WALKTHROUGH = [
  'Add symbols U, R, I and phrases in Manage Gestures.',
  'Draw strokes — watch Stream: U → urine upgrade to URI → Upper Respiratory Infection.',
  'Tap Stream Done to checkpoint each phrase.',
];

export const GESTURE_OVERLAY_HINT_READY =
  'Draw symbol strokes one at a time. Phrases expand as your code grows. Tap Stream Done to lock text; Done closes this sheet.';

export const GESTURE_OVERLAY_HINT_EMPTY =
  'Add symbols or phrases in Settings → Manage Gestures.';

export const GESTURE_INPUT_MODE_NOTE =
  'Set up symbols and phrases under Settings → Manage Gestures. Use Stream Done while writing to lock each phrase.';
