const GESTURE_KIND = 'touch-path-v1';
const RESAMPLED_POINT_COUNT = 48;
const MIN_GESTURE_POINTS = 6;
const MIN_GESTURE_EXTENT = 18;
const MAX_RAW_POINTS = 240;
const RAW_POINT_DISTANCE = 4;
const SPREAD_WEIGHT = 0.8;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 4) {
  return Number(value.toFixed(digits));
}

function pointDistance(a, b) {
  return Math.hypot(
    a.x - b.x,
    a.y - b.y,
    (a.spread - b.spread) * SPREAD_WEIGHT
  );
}

function getBounds(points) {
  return points.reduce((acc, point) => ({
    minX: Math.min(acc.minX, point.x),
    maxX: Math.max(acc.maxX, point.x),
    minY: Math.min(acc.minY, point.y),
    maxY: Math.max(acc.maxY, point.y),
    minSpread: Math.min(acc.minSpread, point.spread),
    maxSpread: Math.max(acc.maxSpread, point.spread),
  }), {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    minSpread: Infinity,
    maxSpread: -Infinity,
  });
}

function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += pointDistance(points[i - 1], points[i]);
  }
  return total;
}

function dedupePoints(points) {
  const deduped = [];

  for (const point of points) {
    const last = deduped[deduped.length - 1];
    if (!last || pointDistance(last, point) >= RAW_POINT_DISTANCE || last.touches !== point.touches) {
      deduped.push(point);
    }
  }

  return deduped;
}

function normalizePoints(points) {
  const bounds = getBounds(points);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const spreadRange = bounds.maxSpread - bounds.minSpread;
  const scale = Math.max(width, height, spreadRange * 2, 1);
  const centerX = bounds.minX + (width / 2);
  const centerY = bounds.minY + (height / 2);

  return points.map(point => ({
    x: (point.x - centerX) / scale,
    y: (point.y - centerY) / scale,
    spread: point.spread / scale,
    touches: point.touches,
  }));
}

function resamplePath(points, targetCount) {
  if (points.length === 0) return [];
  if (points.length === 1) {
    return Array.from({ length: targetCount }, () => ({ ...points[0] }));
  }

  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) {
    lengths.push(lengths[i - 1] + pointDistance(points[i - 1], points[i]));
  }

  const totalLength = lengths[lengths.length - 1];
  if (totalLength === 0) {
    return Array.from({ length: targetCount }, () => ({ ...points[0] }));
  }

  const resampled = [];
  for (let i = 0; i < targetCount; i += 1) {
    const target = (totalLength * i) / (targetCount - 1);
    let index = 1;

    while (index < lengths.length && lengths[index] < target) {
      index += 1;
    }

    if (index >= points.length) {
      resampled.push({ ...points[points.length - 1] });
      continue;
    }

    const previousLength = lengths[index - 1];
    const nextLength = lengths[index];
    const segmentLength = nextLength - previousLength || 1;
    const ratio = clamp((target - previousLength) / segmentLength, 0, 1);
    const from = points[index - 1];
    const to = points[index];

    resampled.push({
      x: from.x + ((to.x - from.x) * ratio),
      y: from.y + ((to.y - from.y) * ratio),
      spread: from.spread + ((to.spread - from.spread) * ratio),
      touches: Math.round(from.touches + ((to.touches - from.touches) * ratio)),
    });
  }

  return resampled;
}

function normalizeGestureObject(parsed) {
  if (!parsed || parsed.kind !== GESTURE_KIND || !Array.isArray(parsed.points)) {
    return null;
  }

  const points = parsed.points
    .filter(point => Number.isFinite(point?.x) && Number.isFinite(point?.y))
    .map(point => ({
      x: point.x,
      y: point.y,
      spread: Number.isFinite(point.spread) ? point.spread : 0,
      touches: Number.isFinite(point.touches) ? point.touches : 1,
    }));

  if (points.length < MIN_GESTURE_POINTS) {
    return null;
  }

  return {
    kind: GESTURE_KIND,
    maxTouches: Number.isFinite(parsed.maxTouches) ? parsed.maxTouches : Math.max(...points.map(point => point.touches)),
    points,
  };
}

function parseGestureData(data) {
  if (!data) return null;

  const parsed = typeof data === 'string'
    ? (() => {
        try {
          return JSON.parse(data);
        } catch {
          return null;
        }
      })()
    : data;

  return normalizeGestureObject(parsed);
}

function gestureDistance(a, b) {
  const count = Math.min(a.points.length, b.points.length);
  if (!count) return Infinity;

  let total = 0;
  for (let i = 0; i < count; i += 1) {
    const pointA = a.points[i];
    const pointB = b.points[i];
    total += pointDistance(pointA, pointB);
    total += Math.abs(pointA.touches - pointB.touches) * 0.12;
  }

  total += Math.abs((a.maxTouches ?? 1) - (b.maxTouches ?? 1)) * 0.18;

  return total / count;
}

export function appendRawGesturePoint(points, point) {
  const nextPoint = {
    x: point.x,
    y: point.y,
    spread: point.spread ?? 0,
    touches: point.touches ?? 1,
  };

  const last = points[points.length - 1];
  if (last && pointDistance(last, nextPoint) < RAW_POINT_DISTANCE && last.touches === nextPoint.touches) {
    return points;
  }

  if (points.length >= MAX_RAW_POINTS) {
    return [...points.slice(points.length - MAX_RAW_POINTS + 1), nextPoint];
  }

  return [...points, nextPoint];
}

export function buildTouchGesture(rawPoints) {
  if (!Array.isArray(rawPoints) || rawPoints.length < MIN_GESTURE_POINTS) {
    return null;
  }

  const points = dedupePoints(rawPoints);
  if (points.length < MIN_GESTURE_POINTS) {
    return null;
  }

  const bounds = getBounds(points);
  const extent = Math.max(
    bounds.maxX - bounds.minX,
    bounds.maxY - bounds.minY,
    (bounds.maxSpread - bounds.minSpread) * 2,
    pathLength(points)
  );

  if (extent < MIN_GESTURE_EXTENT) {
    return null;
  }

  const normalized = normalizePoints(points);
  const resampled = resamplePath(normalized, RESAMPLED_POINT_COUNT).map(point => ({
    x: round(point.x),
    y: round(point.y),
    spread: round(point.spread),
    touches: point.touches,
  }));

  return {
    kind: GESTURE_KIND,
    maxTouches: Math.max(...points.map(point => point.touches)),
    points: resampled,
  };
}

export function isTouchGestureData(data) {
  return Boolean(parseGestureData(data));
}

export function matchGesture(recordedGesture, gestures, threshold = 0.24) {
  const recorded = parseGestureData(recordedGesture);
  if (!recorded || !Array.isArray(gestures) || gestures.length === 0) {
    return null;
  }

  let best = null;
  let bestScore = Infinity;

  for (const gesture of gestures) {
    const candidate = parseGestureData(gesture.data ?? gesture);
    if (!candidate) continue;

    const score = gestureDistance(recorded, candidate);
    if (score < bestScore) {
      bestScore = score;
      best = gesture;
    }
  }

  return bestScore < threshold ? best : null;
}
