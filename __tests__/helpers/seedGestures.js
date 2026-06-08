import { buildTouchGesture, buildTouchSequence } from '../../src/gestureRecognizer';
import { makeRawPath } from './gesturePadSim';

export function seedColdGestureRow() {
  const horizontal = buildTouchGesture(makeRawPath({ count: 24, stepX: 10, spread: 0 }));
  if (!horizontal) {
    throw new Error('Failed to build horizontal seed gesture');
  }
  return [{ id: 1, kind: 'sequence', word: 'cold', data: JSON.stringify(horizontal) }];
}

export function seedUriGestureRow() {
  const strokeU = buildTouchGesture(makeRawPath({ count: 24, stepX: 10, stepY: 0 }));
  const strokeR = buildTouchGesture(makeRawPath({ count: 24, stepX: 0, stepY: 10 }));
  const strokeI = buildTouchGesture(makeRawPath({ count: 24, stepX: 8, stepY: 8 }));
  const sequence = buildTouchSequence([strokeU, strokeR, strokeI]);
  if (!sequence) {
    throw new Error('Failed to build URI seed gesture sequence');
  }
  return [{
    id: 3,
    kind: 'sequence',
    code: 'URI',
    word: 'Upper Respiratory Infection',
    data: JSON.stringify(sequence),
  }];
}

export function seedUriStreamGestures() {
  const strokeU = buildTouchGesture(makeRawPath({ count: 24, stepX: 10, stepY: 0 }));
  const strokeR = buildTouchGesture(makeRawPath({ count: 24, stepX: 0, stepY: 10 }));
  const strokeI = buildTouchGesture(makeRawPath({ count: 24, stepX: 8, stepY: 8 }));
  return [
    { id: 10, kind: 'glyph', symbol: 'U', word: '', code: null, data: JSON.stringify(strokeU) },
    { id: 11, kind: 'glyph', symbol: 'R', word: '', code: null, data: JSON.stringify(strokeR) },
    { id: 12, kind: 'glyph', symbol: 'I', word: '', code: null, data: JSON.stringify(strokeI) },
    { id: 13, kind: 'expansion', code: 'U', word: 'urine', data: '{}' },
    { id: 14, kind: 'expansion', code: 'URI', word: 'Upper Respiratory Infection', data: '{}' },
  ];
}

export function seedColdAndFeverGestureRows() {
  const horizontal = buildTouchGesture(makeRawPath({ count: 24, stepX: 10 }));
  const vertical = buildTouchGesture(makeRawPath({ count: 24, stepX: 0, stepY: 10 }));
  return [
    { id: 1, kind: 'sequence', word: 'cold', data: JSON.stringify(horizontal) },
    { id: 2, kind: 'sequence', word: 'fever', data: JSON.stringify(vertical) },
  ];
}
