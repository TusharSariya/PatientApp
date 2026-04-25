import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { appendRawGesturePoint, buildTouchGesture } from './gestureRecognizer';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function summarizeTouches(touches, layout) {
  let sumX = 0;
  let sumY = 0;

  for (const touch of touches) {
    sumX += touch.locationX ?? 0;
    sumY += touch.locationY ?? 0;
  }

  const x = clamp(sumX / touches.length, 0, layout.width);
  const y = clamp(sumY / touches.length, 0, layout.height);

  let spreadSum = 0;
  for (const touch of touches) {
    const dx = (touch.locationX ?? x) - x;
    const dy = (touch.locationY ?? y) - y;
    spreadSum += Math.hypot(dx, dy);
  }

  return {
    x,
    y,
    spread: spreadSum / touches.length,
    touches: touches.length,
  };
}

export default function GesturePad({
  disabled = false,
  resetKey = 0,
  onGestureChange,
  onGestureComplete,
  onDrawingChange,
}) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [rawPoints, setRawPoints] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    setRawPoints([]);
    setIsDrawing(false);
    onDrawingChange?.(false);
    onGestureChange?.(null, []);
  }, [resetKey]);

  useEffect(() => () => onDrawingChange?.(false), []);

  function emitGesture(points, complete = false) {
    const gesture = buildTouchGesture(points);
    onGestureChange?.(gesture, points);
    if (complete) onGestureComplete?.(gesture, points);
  }

  function pushSample(nativeEvent, { restart = false, complete = false } = {}) {
    if (disabled || !layout.width || !layout.height) return;

    const touches = nativeEvent.touches?.length
      ? nativeEvent.touches
      : nativeEvent.changedTouches;

    if (!touches?.length) {
      if (complete) emitGesture(rawPoints, true);
      return;
    }

    const nextPoint = summarizeTouches(touches, layout);

    setRawPoints(previousPoints => {
      const basePoints = restart ? [] : previousPoints;
      const nextPoints = appendRawGesturePoint(basePoints, nextPoint);
      emitGesture(nextPoints, complete);
      return nextPoints;
    });
  }

  function handleGrant(event) {
    setIsDrawing(true);
    onDrawingChange?.(true);
    pushSample(event.nativeEvent, { restart: true });
  }

  function handleMove(event) {
    pushSample(event.nativeEvent);
  }

  function handleRelease(event) {
    pushSample(event.nativeEvent, { complete: true });
    setIsDrawing(false);
    onDrawingChange?.(false);
  }

  const visiblePoints = rawPoints.filter((_, index) => {
    if (rawPoints.length <= 120) return true;
    const stride = Math.ceil(rawPoints.length / 120);
    return index % stride === 0 || index === rawPoints.length - 1;
  });

  const currentTouches = rawPoints[rawPoints.length - 1]?.touches ?? 0;
  const maxTouches = rawPoints.reduce((highest, point) => Math.max(highest, point.touches), 0);

  return (
    <View>
      <View
        style={[styles.pad, disabled && styles.padDisabled, isDrawing && styles.padActive]}
        onLayout={event => setLayout(event.nativeEvent.layout)}
        onStartShouldSetResponder={() => !disabled}
        onMoveShouldSetResponder={() => !disabled}
        onStartShouldSetResponderCapture={() => !disabled}
        onMoveShouldSetResponderCapture={() => !disabled}
        onResponderGrant={handleGrant}
        onResponderMove={handleMove}
        onResponderRelease={handleRelease}
        onResponderTerminate={handleRelease}
      >
        {visiblePoints.length === 0 ? (
          <View pointerEvents="none" style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{disabled ? 'No compatible gestures available' : 'Draw your gesture here'}</Text>
            <Text style={styles.emptySub}>
              {disabled
                ? 'Add a new touch gesture first.'
                : 'Use one or more fingers. Lift them to finish.'}
            </Text>
          </View>
        ) : null}

        {visiblePoints.map((point, index) => (
          <View
            key={`${index}-${point.x}-${point.y}-${point.touches}`}
            pointerEvents="none"
            style={[
              styles.dot,
              point.touches > 1 && styles.dotMulti,
              {
                left: point.x - 4,
                top: point.y - 4,
              },
            ]}
          />
        ))}
      </View>

      <Text style={styles.status}>
        {rawPoints.length === 0
          ? 'The recognizer records the finger path, finger count, and finger spread.'
          : isDrawing
            ? `Drawing with ${currentTouches} finger${currentTouches === 1 ? '' : 's'}...`
            : `Captured ${rawPoints.length} samples${maxTouches ? ` using up to ${maxTouches} finger${maxTouches === 1 ? '' : 's'}` : ''}.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    height: 240,
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#d4dbff',
    backgroundColor: '#f8f9ff',
    overflow: 'hidden',
  },
  padDisabled: {
    opacity: 0.6,
  },
  padActive: {
    borderColor: '#4f6ef7',
    backgroundColor: '#eef2ff',
  },
  emptyState: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    lineHeight: 18,
    color: '#7d8597',
    textAlign: 'center',
    marginTop: 8,
  },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4f6ef7',
  },
  dotMulti: {
    backgroundColor: '#ff7a59',
  },
  status: {
    fontSize: 13,
    lineHeight: 18,
    color: '#7d8597',
    marginTop: 10,
    textAlign: 'center',
  },
});
