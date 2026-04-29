import {
  appendRawGesturePoint,
  buildTouchGesture,
  isTouchGestureData,
  matchGesture,
} from '../src/gestureRecognizer';

function makeRawPath({
  count = 24,
  startX = 0,
  startY = 0,
  stepX = 8,
  stepY = 0,
  touches = 1,
  spread = 0,
} = {}) {
  return Array.from({ length: count }, (_, index) => ({
    x: startX + (index * stepX),
    y: startY + (index * stepY),
    touches,
    spread,
  }));
}

describe('gestureRecognizer', () => {
  describe('appendRawGesturePoint', () => {
    test('deduplicates points that are too close with same touch count', () => {
      const points = [{ x: 10, y: 10, spread: 0, touches: 1 }];
      const result = appendRawGesturePoint(points, { x: 12, y: 11, spread: 0, touches: 1 });
      expect(result).toBe(points);
      expect(result).toHaveLength(1);
    });

    test('keeps points when touches change', () => {
      const points = [{ x: 10, y: 10, spread: 0, touches: 1 }];
      const result = appendRawGesturePoint(points, { x: 11, y: 11, spread: 0, touches: 2 });
      expect(result).toHaveLength(2);
      expect(result[1].touches).toBe(2);
    });

    test('caps stored raw points to max history length', () => {
      let points = [];
      for (let i = 0; i < 300; i += 1) {
        points = appendRawGesturePoint(points, { x: i * 5, y: 0, spread: 0, touches: 1 });
      }
      expect(points).toHaveLength(240);
      expect(points[0].x).toBe(300);
      expect(points[points.length - 1].x).toBe(1495);
    });
  });

  describe('buildTouchGesture', () => {
    test('returns null when raw points are too few', () => {
      const raw = makeRawPath({ count: 5, stepX: 8 });
      expect(buildTouchGesture(raw)).toBeNull();
    });

    test('returns null when gesture extent is too small', () => {
      const raw = makeRawPath({ count: 7, stepX: 1, stepY: 0 });
      expect(buildTouchGesture(raw)).toBeNull();
    });

    test('normalizes a valid gesture into touch-path-v1 format', () => {
      const raw = makeRawPath({ count: 30, stepX: 9, touches: 2, spread: 4 });
      const gesture = buildTouchGesture(raw);

      expect(gesture).not.toBeNull();
      expect(gesture.kind).toBe('touch-path-v1');
      expect(gesture.maxTouches).toBe(2);
      expect(gesture.points).toHaveLength(48);
      expect(gesture.points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
    });
  });

  describe('isTouchGestureData', () => {
    test('accepts serialized valid gesture data', () => {
      const gesture = buildTouchGesture(makeRawPath({ count: 20, stepX: 10 }));
      expect(isTouchGestureData(JSON.stringify(gesture))).toBe(true);
    });

    test('rejects invalid gesture payloads', () => {
      expect(isTouchGestureData(null)).toBe(false);
      expect(isTouchGestureData('{bad-json')).toBe(false);
      expect(isTouchGestureData(JSON.stringify({ kind: 'unknown', points: [] }))).toBe(false);
    });
  });

  describe('matchGesture', () => {
    test('matches the closest gesture candidate', () => {
      const cough = buildTouchGesture(makeRawPath({ count: 24, stepX: 10 }));
      const fever = buildTouchGesture(makeRawPath({ count: 24, stepX: 0, stepY: 10 }));

      const gestures = [
        { id: 1, word: 'Cough', data: JSON.stringify(cough) },
        { id: 2, word: 'Fever', data: JSON.stringify(fever) },
      ];

      const recorded = buildTouchGesture(makeRawPath({ count: 24, stepX: 10, stepY: 1 }));
      const result = matchGesture(recorded, gestures);

      expect(result).toEqual(gestures[0]);
    });

    test('returns null when no candidate is within threshold', () => {
      const stored = buildTouchGesture(makeRawPath({ count: 24, stepX: 10 }));
      const recorded = buildTouchGesture(makeRawPath({ count: 24, stepX: 0, stepY: 12 }));
      const gestures = [{ id: 1, word: 'Cough', data: JSON.stringify(stored) }];

      const result = matchGesture(recorded, gestures);
      expect(result).toBeNull();
    });
  });
});
