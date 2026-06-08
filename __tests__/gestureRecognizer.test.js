import {
  appendRawGesturePoint,
  buildTouchGesture,
  buildTouchSequence,
  findPossibleContinuation,
  isGestureData,
  isTouchGestureData,
  matchGesture,
  matchGestureSequence,
  parseGestureSequence,
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

  describe('parseGestureSequence', () => {
    test('wraps legacy touch-path-v1 as a one-stroke sequence', () => {
      const gesture = buildTouchGesture(makeRawPath({ count: 24, stepX: 10 }));
      const sequence = parseGestureSequence(JSON.stringify(gesture));
      expect(sequence?.kind).toBe('touch-sequence-v1');
      expect(sequence?.strokes).toHaveLength(1);
      expect(sequence?.strokes[0].kind).toBe('touch-path-v1');
    });

    test('parses touch-sequence-v1 payloads', () => {
      const strokes = [
        buildTouchGesture(makeRawPath({ count: 24, stepX: 10 })),
        buildTouchGesture(makeRawPath({ count: 24, stepX: 0, stepY: 10 })),
      ];
      const sequence = buildTouchSequence(strokes);
      const parsed = parseGestureSequence(JSON.stringify(sequence));
      expect(parsed?.strokes).toHaveLength(2);
    });
  });

  describe('isGestureData', () => {
    test('accepts legacy and sequence gesture payloads', () => {
      const legacy = buildTouchGesture(makeRawPath({ count: 24, stepX: 10 }));
      const sequence = buildTouchSequence([
        legacy,
        buildTouchGesture(makeRawPath({ count: 24, stepX: 0, stepY: 10 })),
      ]);
      expect(isGestureData(JSON.stringify(legacy))).toBe(true);
      expect(isGestureData(JSON.stringify(sequence))).toBe(true);
      expect(isGestureData(null)).toBe(false);
    });
  });

  describe('matchGestureSequence', () => {
    test('matches a three-stroke URI gesture sequence', () => {
      const strokeU = buildTouchGesture(makeRawPath({ count: 24, stepX: 10 }));
      const strokeR = buildTouchGesture(makeRawPath({ count: 24, stepX: 0, stepY: 10 }));
      const strokeI = buildTouchGesture(makeRawPath({ count: 24, stepX: 8, stepY: 8 }));
      const stored = buildTouchSequence([strokeU, strokeR, strokeI]);
      const gestures = [{
        id: 1,
        code: 'URI',
        word: 'Upper Respiratory Infection',
        data: JSON.stringify(stored),
      }];

      const recorded = [
        buildTouchGesture(makeRawPath({ count: 24, stepX: 10, stepY: 1 })),
        buildTouchGesture(makeRawPath({ count: 24, stepX: 1, stepY: 10 })),
        buildTouchGesture(makeRawPath({ count: 24, stepX: 8, stepY: 9 })),
      ];

      const result = matchGestureSequence(recorded, gestures);
      expect(result).toEqual(gestures[0]);
    });

    test('returns null for partial sequence with no exact-length match', () => {
      const strokeU = buildTouchGesture(makeRawPath({ count: 24, stepX: 10 }));
      const stored = buildTouchSequence([
        strokeU,
        buildTouchGesture(makeRawPath({ count: 24, stepX: 0, stepY: 10 })),
      ]);
      const gestures = [{ id: 1, word: 'Two', data: JSON.stringify(stored) }];
      const recorded = [buildTouchGesture(makeRawPath({ count: 24, stepX: 10, stepY: 1 }))];

      expect(matchGestureSequence(recorded, gestures)).toBeNull();
      expect(findPossibleContinuation(recorded, gestures)).toBe(true);
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
