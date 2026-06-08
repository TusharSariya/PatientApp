import { act, fireEvent } from '@testing-library/react-native';

export const DEFAULT_PAD_LAYOUT = { width: 300, height: 240 };

/** Raw path samples aligned with gestureRecognizer.test.js */
export function makeRawPath({
  count = 24,
  startX = 20,
  startY = 20,
  stepX = 8,
  stepY = 0,
  touches = 1,
  spread = 0,
} = {}) {
  return Array.from({ length: count }, (_, index) => ({
    x: startX + index * stepX,
    y: startY + index * stepY,
    touches,
    spread,
  }));
}

export const GESTURE_PAD_PRESETS = {
  horizontal: makeRawPath({ count: 24, stepX: 10, stepY: 0 }),
  vertical: makeRawPath({ count: 24, stepX: 0, stepY: 10 }),
  diagonal: makeRawPath({ count: 24, stepX: 8, stepY: 8 }),
  multiTouch: makeRawPath({ count: 24, stepX: 10, stepY: 1, touches: 2 }),
  shortInvalid: makeRawPath({ count: 5, stepX: 8 }),
};

function touchEvent(points, { phase = 'move', index = 0 } = {}) {
  const point = points[Math.min(index, points.length - 1)];
  const touchCount = point.touches ?? 1;
  const touches = phase === 'release'
    ? []
    : Array.from({ length: touchCount }, (_, touchIndex) => ({
        identifier: touchIndex,
        locationX: point.x + touchIndex * 6,
        locationY: point.y,
      }));
  const nativeEvent = {
    touches,
    changedTouches: touches.length ? touches : [{
      identifier: 0,
      locationX: point.x,
      locationY: point.y,
    }],
  };
  return { nativeEvent };
}

export function layoutGesturePad(pad, layout = DEFAULT_PAD_LAYOUT) {
  act(() => {
    fireEvent(pad, 'layout', {
      nativeEvent: { layout: { ...layout, x: 0, y: 0 } },
    });
  });
}

export function drawPath(pad, points, { layout = true } = {}) {
  if (!points?.length) return;

  if (layout) {
    layoutGesturePad(pad);
  }

  act(() => {
    fireEvent(pad, 'responderGrant', touchEvent(points, { phase: 'grant', index: 0 }));
  });

  for (let i = 1; i < points.length; i += 1) {
    act(() => {
      fireEvent(pad, 'responderMove', touchEvent(points, { index: i }));
    });
  }

  act(() => {
    fireEvent(pad, 'responderRelease', touchEvent(points, { phase: 'release', index: points.length - 1 }));
  });
}

export function drawPreset(pad, presetName) {
  const points = GESTURE_PAD_PRESETS[presetName];
  if (!points) {
    throw new Error(`Unknown gesture preset: ${presetName}`);
  }
  drawPath(pad, points);
}

export function drawStrokes(pad, presetNames) {
  for (const presetName of presetNames) {
    drawPreset(pad, presetName);
  }
}
