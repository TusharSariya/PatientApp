import { buildTouchGesture } from '../../src/gestureRecognizer';
import { makeRawPath } from './gesturePadSim';

export function seedColdGestureRow() {
  const horizontal = buildTouchGesture(makeRawPath({ count: 24, stepX: 10, spread: 0 }));
  if (!horizontal) {
    throw new Error('Failed to build horizontal seed gesture');
  }
  return [{ id: 1, word: 'cold', data: JSON.stringify(horizontal) }];
}

export function seedColdAndFeverGestureRows() {
  const horizontal = buildTouchGesture(makeRawPath({ count: 24, stepX: 10 }));
  const vertical = buildTouchGesture(makeRawPath({ count: 24, stepX: 0, stepY: 10 }));
  return [
    { id: 1, word: 'cold', data: JSON.stringify(horizontal) },
    { id: 2, word: 'fever', data: JSON.stringify(vertical) },
  ];
}
