import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import GesturePad from './GesturePad';
import { getGestures } from './database';
import { isTouchGestureData, matchGesture } from './gestureRecognizer';

export default function TestGestureScreen() {
  const [gestures, setGestures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [padResetKey, setPadResetKey] = useState(0);
  const [resultState, setResultState] = useState('idle');
  const [result, setResult] = useState(null);

  useFocusEffect(useCallback(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const rows = await getGestures();
        if (!active) return;
        setGestures(rows);
      } catch (error) {
        if (!active) return;
        Alert.alert('Could not load gestures', String(error?.message ?? error));
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []));

  const compatibleGestures = gestures.filter(gesture => isTouchGestureData(gesture.data));

  function handleDrawingChange(isDrawing) {
    if (isDrawing) {
      setResultState('idle');
      setResult(null);
    }
  }

  function handleGestureComplete(gesture) {
    if (!gesture) {
      setResultState('invalid');
      setResult(null);
      return;
    }

    const match = matchGesture(gesture, compatibleGestures);
    setResult(match);
    setResultState(match ? 'match' : 'no-match');
  }

  function handleClear() {
    setPadResetKey(previous => previous + 1);
    setResultState('idle');
    setResult(null);
  }

  const hasCompatibleGestures = compatibleGestures.length > 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Touch Gesture Recognition</Text>
        <Text style={styles.heroTitle}>Draw a saved gesture to reveal its associated word.</Text>
        <Text style={styles.heroSub}>
          {loading
            ? 'Loading saved gestures...'
            : compatibleGestures.length > 0
              ? `Ready to test against ${compatibleGestures.length} touch gesture${compatibleGestures.length === 1 ? '' : 's'}.`
              : gestures.length > 0
                ? 'Your saved gestures use the old motion format. Re-record them with finger gestures first.'
                : 'No gestures saved yet. Add one from Manage Gestures first.'}
        </Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Test</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#4f6ef7" style={styles.loader} />
        ) : (
          <>
            <GesturePad
              disabled={!hasCompatibleGestures}
              resetKey={padResetKey}
              onGestureComplete={handleGestureComplete}
              onDrawingChange={handleDrawingChange}
            />

            {resultState === 'match' ? (
              <View style={styles.resultMatch}>
                <Text style={styles.resultLabel}>Associated Word</Text>
                <Text style={styles.resultWord}>{result.word}</Text>
              </View>
            ) : null}

            {resultState === 'no-match' ? (
              <View style={styles.resultNone}>
                <Text style={styles.resultNoneText}>No matching gesture</Text>
                <Text style={styles.resultNoneSub}>Try again with a clearer or more consistent touch path.</Text>
              </View>
            ) : null}

            {resultState === 'invalid' ? (
              <View style={styles.resultNone}>
                <Text style={styles.resultNoneText}>Gesture too small</Text>
                <Text style={styles.resultNoneSub}>Draw a larger gesture before lifting your fingers.</Text>
              </View>
            ) : null}

            {resultState !== 'idle' ? (
              <TouchableOpacity onPress={handleClear}>
                <Text style={styles.secondaryLink}>Clear Result</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f5f6fa',
  },
  heroCard: {
    backgroundColor: '#4f6ef7',
    borderRadius: 20,
    padding: 22,
    marginBottom: 18,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.72)',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    color: '#fff',
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.82)',
  },
  panel: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 14,
  },
  loader: {
    marginVertical: 24,
  },
  resultMatch: {
    alignItems: 'center',
    backgroundColor: '#eafaf1',
    borderRadius: 14,
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  resultLabel: {
    fontSize: 13,
    color: '#27ae60',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultWord: {
    fontSize: 36,
    fontWeight: '800',
    color: '#1a1a2e',
    marginTop: 6,
    textAlign: 'center',
  },
  resultNone: {
    alignItems: 'center',
    backgroundColor: '#fef9f0',
    borderRadius: 14,
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  resultNoneText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e67e22',
    textAlign: 'center',
  },
  resultNoneSub: {
    fontSize: 13,
    color: '#999',
    marginTop: 6,
    textAlign: 'center',
  },
  secondaryLink: {
    color: '#4f6ef7',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 14,
  },
});
