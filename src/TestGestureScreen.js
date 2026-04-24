import React, { useCallback, useRef, useState } from 'react';
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

import { getGestures } from './database';
import { matchGesture, recordGesture } from './gestureRecognizer';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function RecordWidget({ onDone, disabled = false }) {
  const [phase, setPhase] = useState('idle');
  const [count, setCount] = useState(3);
  const [progress, setProgress] = useState(0);
  const mounted = useRef(true);

  useFocusEffect(useCallback(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []));

  async function start() {
    if (disabled || phase === 'countdown' || phase === 'recording') return;

    for (let i = 3; i >= 1; i -= 1) {
      if (!mounted.current) return;
      setPhase('countdown');
      setCount(i);
      await sleep(1000);
    }

    if (!mounted.current) return;
    setPhase('recording');
    setProgress(0);

    try {
      const data = await recordGesture(nextProgress => {
        if (mounted.current) setProgress(nextProgress);
      });
      if (!mounted.current) return;
      setPhase('done');
      onDone(data);
    } catch (error) {
      if (!mounted.current) return;
      setPhase('idle');
      Alert.alert('Recording failed', String(error?.message ?? error));
    }
  }

  if (phase === 'countdown') {
    return (
      <View style={styles.recorderCard}>
        <Text style={styles.countNum}>{count}</Text>
        <Text style={styles.countSub}>Get ready…</Text>
      </View>
    );
  }

  if (phase === 'recording') {
    return (
      <View style={styles.recorderCard}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <Text style={styles.recordingLabel}>Recording…</Text>
      </View>
    );
  }

  if (phase === 'done') {
    return (
      <TouchableOpacity style={styles.primaryButton} onPress={start} activeOpacity={0.8}>
        <Text style={styles.primaryButtonText}>Record Again</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]}
      onPress={start}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={styles.primaryButtonText}>Record Gesture</Text>
    </TouchableOpacity>
  );
}

export default function TestGestureScreen() {
  const [gestures, setGestures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recorded, setRecorded] = useState(false);
  const [result, setResult] = useState(undefined);

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

  function handleRecorded(data) {
    setRecorded(true);
    setResult(matchGesture(data, gestures) ?? null);
  }

  function handleReset() {
    setRecorded(false);
    setResult(undefined);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Gesture Recognition</Text>
        <Text style={styles.heroTitle}>Perform a gesture and see the matched word.</Text>
        <Text style={styles.heroSub}>
          {loading
            ? 'Loading saved gestures...'
            : gestures.length === 0
              ? 'No gestures saved yet. Add one from Manage Gestures first.'
              : `Ready to test against ${gestures.length} saved gesture${gestures.length === 1 ? '' : 's'}.`}
        </Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Test</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#4f6ef7" style={styles.loader} />
        ) : (
          <>
            <RecordWidget onDone={handleRecorded} disabled={gestures.length === 0} />

            {recorded && (
              result ? (
                <View style={styles.resultMatch}>
                  <Text style={styles.resultLabel}>Associated Word</Text>
                  <Text style={styles.resultWord}>{result.word}</Text>
                </View>
              ) : (
                <View style={styles.resultNone}>
                  <Text style={styles.resultNoneText}>No matching gesture</Text>
                  <Text style={styles.resultNoneSub}>Try again with a clearer motion.</Text>
                </View>
              )
            )}

            {recorded && (
              <TouchableOpacity onPress={handleReset}>
                <Text style={styles.secondaryLink}>Clear Result</Text>
              </TouchableOpacity>
            )}
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
  recorderCard: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#f8f9ff',
    borderRadius: 14,
  },
  countNum: {
    fontSize: 52,
    fontWeight: '800',
    color: '#4f6ef7',
  },
  countSub: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  track: {
    width: '84%',
    height: 8,
    backgroundColor: '#e8e8e8',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  fill: {
    height: '100%',
    backgroundColor: '#4f6ef7',
    borderRadius: 4,
  },
  recordingLabel: {
    fontSize: 14,
    color: '#555',
  },
  primaryButton: {
    backgroundColor: '#4f6ef7',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#c5cdf5',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
