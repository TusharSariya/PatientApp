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

import GesturePad from './GesturePad';
import { getGestures } from './database';
import { GESTURE_TEST_WALKTHROUGH } from './gestureInstructions';
import {
  buildSymbolBuffer,
  hasDrawableGestures,
  matchGlyphStroke,
  partitionGestures,
  resolveStreamOutput,
} from './gestureStreamResolver';
import { flatSection, screenColors, screenContent } from './screenLayout';

export default function TestGestureScreen() {
  const [gestures, setGestures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [padResetKey, setPadResetKey] = useState(0);
  const [resultState, setResultState] = useState('idle');
  const [resolved, setResolved] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeSessionCount, setStrokeSessionCount] = useState(0);
  const [symbolBuffer, setSymbolBuffer] = useState('');
  const [committedOutput, setCommittedOutput] = useState('');
  const strokeSessionRef = useRef([]);
  const streamStrokeSymbolsRef = useRef([]);
  const partitionedRef = useRef({ glyphs: [], expansions: [], sequences: [] });

  useFocusEffect(useCallback(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const rows = await getGestures();
        if (!active) return;
        setGestures(rows);
        partitionedRef.current = partitionGestures(rows);
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

  function clearStrokeSession() {
    strokeSessionRef.current = [];
    streamStrokeSymbolsRef.current = [];
    setStrokeSessionCount(0);
    setSymbolBuffer('');
    setResolved(null);
  }

  function handleDrawingChange(drawing) {
    setIsDrawing(drawing);
    if (drawing) setResultState('ready');
  }

  function handleStrokeComplete(stroke) {
    setIsDrawing(false);
    if (!stroke) {
      setResultState('invalid');
      return;
    }

    const { glyphs, expansions, sequences } = partitionedRef.current;
    const glyphSymbol = matchGlyphStroke(stroke, glyphs);
    const nextSession = [...strokeSessionRef.current, stroke];
    const nextSymbols = [...streamStrokeSymbolsRef.current, glyphSymbol];
    const nextBuffer = buildSymbolBuffer(nextSymbols);

    strokeSessionRef.current = nextSession;
    streamStrokeSymbolsRef.current = nextSymbols;
    setStrokeSessionCount(nextSession.length);
    setSymbolBuffer(nextBuffer);

    const nextResolved = resolveStreamOutput({
      symbolBuffer: nextBuffer,
      strokeSession: nextSession,
      glyphs,
      expansions,
      sequences,
    });

    if (nextResolved) {
      setResolved(nextResolved);
      setResultState('match');
    } else if (!glyphSymbol) {
      setResolved(null);
      setResultState('no-match');
    } else {
      setResolved(null);
      setResultState('ready');
    }

    setPadResetKey((previous) => previous + 1);
  }

  function handleStreamDone() {
    if (resolved?.output) {
      const nextCommitted = committedOutput
        ? `${committedOutput} ${resolved.output}`
        : resolved.output;
      setCommittedOutput(nextCommitted);
    }
    clearStrokeSession();
    setResultState('committed');
    setPadResetKey((previous) => previous + 1);
    setTimeout(() => setResultState('idle'), 300);
  }

  function handleClear() {
    setPadResetKey((previous) => previous + 1);
    setResultState('idle');
    setIsDrawing(false);
    clearStrokeSession();
    setCommittedOutput('');
  }

  function formatResolvedLabel(value) {
    if (!value) return '';
    if (value.code && value.output) {
      return `${value.code} → ${value.output}`;
    }
    return value.output || '';
  }

  const hasCompatibleGestures = hasDrawableGestures(gestures);

  return (
    <ScrollView contentContainerStyle={styles.container} scrollEnabled={!isDrawing}>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Touch Gesture Recognition</Text>
        <Text style={styles.heroTitle}>Test symbol streams and phrase expansion.</Text>
        <Text style={styles.heroSub}>
          {loading
            ? 'Loading saved gestures...'
            : hasCompatibleGestures
              ? 'Practice symbol streams and phrase expansion below.'
              : 'Add symbols or shortcuts from Manage Gestures first.'}
        </Text>
        {!loading && hasCompatibleGestures ? (
          <View style={styles.heroSteps} testID="gesture-test-walkthrough">
            {GESTURE_TEST_WALKTHROUGH.map((step, index) => (
              <Text key={step} style={styles.heroStep}>
                {`${index + 1}. ${step}`}
              </Text>
            ))}
          </View>
        ) : null}
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
              strokeIndex={strokeSessionCount}
              sessionActive={strokeSessionCount > 0}
              onStrokeComplete={handleStrokeComplete}
              onDrawingChange={handleDrawingChange}
            />

            <View
              style={[
                styles.resultPanel,
                resultState === 'match' && styles.resultMatch,
                (resultState === 'no-match' || resultState === 'invalid') && styles.resultNone,
              ]}
            >
              <Text style={[styles.resultLabel, resultState === 'match' && styles.resultLabelMatch]}>
                {isDrawing
                  ? 'Drawing'
                  : resultState === 'match'
                    ? 'Resolved'
                    : strokeSessionCount > 0
                      ? `Stroke ${strokeSessionCount}`
                      : resultState === 'committed'
                        ? 'Checkpoint Saved'
                        : resultState === 'no-match'
                          ? 'No Match'
                          : resultState === 'invalid'
                            ? 'Stroke Too Small'
                            : 'Ready'}
              </Text>
              {symbolBuffer ? (
                <Text style={styles.streamBuffer} testID="test-gesture-stream-buffer">
                  Stream: {symbolBuffer}
                </Text>
              ) : null}
              <Text
                style={[
                  styles.resultBody,
                  resultState === 'match' && styles.resultWord,
                  (resultState === 'no-match' || resultState === 'invalid') && styles.resultNoneText,
                ]}
              >
                {isDrawing
                  ? 'Finish the stroke by lifting your fingers.'
                  : resultState === 'match'
                    ? formatResolvedLabel(resolved)
                    : committedOutput
                      ? `Committed: ${committedOutput}`
                      : strokeSessionCount > 0
                        ? 'Keep drawing symbols or tap Stream Done to checkpoint.'
                        : hasCompatibleGestures
                          ? 'Draw inside the pad to start a symbol stream.'
                          : 'Add at least one symbol or shortcut to start testing.'}
              </Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                testID="test-gesture-stream-done"
                style={styles.primaryAction}
                onPress={handleStreamDone}
                disabled={!resolved?.output}
              >
                <Text style={styles.primaryActionText}>Stream Done</Text>
              </TouchableOpacity>
              {(resultState !== 'idle' || isDrawing || strokeSessionCount > 0 || committedOutput) ? (
                <TouchableOpacity onPress={handleClear}>
                  <Text style={styles.secondaryLink}>Clear Result</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    ...screenContent(40),
    flexGrow: 1,
    backgroundColor: screenColors.bg,
  },
  heroCard: {
    ...flatSection({ marginBottom: 12, paddingVertical: 16 }),
    backgroundColor: '#4f6ef7',
    borderColor: '#4f6ef7',
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
  heroSteps: {
    marginTop: 12,
    gap: 6,
  },
  heroStep: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.78)',
  },
  panel: flatSection({ paddingVertical: 16 }),
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 14,
  },
  loader: {
    marginVertical: 24,
  },
  resultPanel: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginTop: 16,
    minHeight: 128,
    justifyContent: 'center',
    backgroundColor: screenColors.tint,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: screenColors.border,
  },
  resultLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#61708a',
  },
  resultLabelMatch: {
    color: '#27ae60',
  },
  streamBuffer: {
    fontSize: 13,
    color: '#4f6ef7',
    fontWeight: '600',
    marginTop: 8,
  },
  resultBody: {
    fontSize: 15,
    color: '#61708a',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  resultMatch: {
    backgroundColor: '#eafaf1',
  },
  resultWord: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a2e',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 34,
  },
  resultNone: {
    backgroundColor: '#fef9f0',
  },
  resultNoneText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#a8661d',
    textAlign: 'center',
    lineHeight: 22,
  },
  actionRow: {
    alignItems: 'center',
    marginTop: 14,
    gap: 10,
  },
  primaryAction: {
    backgroundColor: '#4f6ef7',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryLink: {
    color: '#4f6ef7',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
});
