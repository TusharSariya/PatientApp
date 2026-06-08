import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

import { extractVisitFromAudio, extractVisitFromText } from './gemma/gemmaVisitExtractor';
import { getGemmaModelState, subscribeGemmaModelManager } from './gemma/GemmaModelManager';
import { MAX_VISIT_RECORDING_SECONDS, modelSupportsNativeAudio } from './gemma/gemmaConfig';
import { VISIT_RECORDING_OPTIONS } from './visitExtraction/visitRecordingOptions';

export default function VisitNarrativeSheet({
  visible,
  onClose,
  onExtracted,
  gemmaVariant = 'e2b',
}) {
  const [modelState, setModelState] = useState(getGemmaModelState);
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [fallbackTranscript, setFallbackTranscript] = useState('');
  const [useFallback, setUseFallback] = useState(false);
  const fallbackTranscriptRef = useRef('');
  const fallbackModeRef = useRef(false);
  const timerRef = useRef(null);

  const recorder = useAudioRecorder(VISIT_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 500);

  useEffect(() => subscribeGemmaModelManager(setModelState), []);

  useEffect(() => {
    if (!visible) {
      setPhase('idle');
      setError('');
      setElapsed(0);
      setFallbackTranscript('');
      setUseFallback(false);
      fallbackTranscriptRef.current = '';
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [visible]);

  useSpeechRecognitionEvent('result', (event) => {
    if (!useFallback || phase !== 'recording') return;
    const transcript = (event.results?.[0]?.transcript ?? '').trim();
    if (!transcript) return;
    fallbackTranscriptRef.current = transcript;
    setFallbackTranscript(transcript);
  });

  useSpeechRecognitionEvent('error', () => {
    if (!useFallback) return;
    setError('Speech recognition failed. Try again or download the on-device model.');
    setPhase('idle');
  });

  async function prepareAudioSession() {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Microphone permission is required to record a visit.');
    }
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true,
      interruptionMode: 'doNotMix',
    });
  }

  async function startRecording() {
    setError('');
    const textOnlyModel = !modelSupportsNativeAudio(gemmaVariant);
    const shouldUseFallback = !modelState.isReady || textOnlyModel;
    fallbackModeRef.current = shouldUseFallback;
    setUseFallback(shouldUseFallback);

    try {
      await prepareAudioSession();
      if (shouldUseFallback) {
        const speechPermission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!speechPermission.granted) {
          throw new Error('Speech recognition permission is required when the on-device model is unavailable.');
        }
        fallbackTranscriptRef.current = '';
        setFallbackTranscript('');
        await ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true });
        setPhase('recording');
      } else {
        await recorder.prepareToRecordAsync(VISIT_RECORDING_OPTIONS);
        recorder.record({ forDuration: MAX_VISIT_RECORDING_SECONDS });
        setPhase('recording');
      }
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((value) => value + 1);
      }, 1000);
    } catch (startError) {
      setPhase('idle');
      setError(startError?.message ?? 'Could not start recording.');
    }
  }

  async function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPhase('extracting');
    try {
      if (fallbackModeRef.current) {
        await ExpoSpeechRecognitionModule.stop();
        const transcript = fallbackTranscriptRef.current.trim();
        if (!transcript) {
          throw new Error('No speech was captured.');
        }
        if (!modelState.isReady) {
          throw new Error('Download the on-device model in Settings → Visit AI before extracting.');
        }
        const extraction = await extractVisitFromText(transcript, { variant: gemmaVariant });
        onExtracted?.(extraction);
        onClose?.();
        return;
      }

      await recorder.stop();
      const audioUri = recorder.uri;
      if (!audioUri) {
        throw new Error('Recording file was not created.');
      }
      const extraction = await extractVisitFromAudio(audioUri, { variant: gemmaVariant });
      onExtracted?.(extraction);
      onClose?.();
    } catch (extractError) {
      setPhase('idle');
      setError(extractError?.message ?? 'Visit extraction failed.');
    }
  }

  function formatElapsed(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Dictate Visit</Text>
          <Text style={styles.subtitle}>
            Speak through the visit. Extraction runs entirely on this device.
          </Text>
          {!modelState.isReady ? (
            <Text style={styles.banner}>
              Model not loaded. You can dictate with system speech, but extraction requires Visit AI setup.
            </Text>
          ) : !modelSupportsNativeAudio(gemmaVariant) ? (
            <Text style={styles.banner}>
              This model uses system speech for dictation, then on-device text extraction.
            </Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.statusBox}>
            {phase === 'extracting' ? (
              <>
                <ActivityIndicator color="#4f6ef7" />
                <Text style={styles.statusText}>Extracting visit fields…</Text>
              </>
            ) : (
              <>
                <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>
                <Text style={styles.statusText}>
                  {phase === 'recording'
                    ? useFallback
                      ? 'Listening with system speech…'
                      : `Recording${recorderState.isRecording ? '' : '…'}`
                    : 'Ready to record'}
                </Text>
                {useFallback && fallbackTranscript ? (
                  <Text style={styles.transcriptPreview} numberOfLines={4}>
                    {fallbackTranscript}
                  </Text>
                ) : null}
              </>
            )}
          </View>
          <View style={styles.actions}>
            {phase === 'recording' ? (
              <TouchableOpacity testID="stop-visit-dictation" style={styles.primaryButton} onPress={stopRecording}>
                <Text style={styles.primaryButtonText}>Stop and Extract</Text>
              </TouchableOpacity>
            ) : phase === 'idle' ? (
              <TouchableOpacity testID="start-visit-dictation" style={styles.primaryButton} onPress={startRecording}>
                <Text style={styles.primaryButtonText}>Start Recording</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#5f6d8a',
    lineHeight: 20,
  },
  banner: {
    marginTop: 12,
    fontSize: 13,
    color: '#8a5a00',
    backgroundColor: '#fff8e8',
    padding: 10,
    borderRadius: 10,
  },
  error: {
    marginTop: 12,
    color: '#b42318',
    fontSize: 13,
  },
  statusBox: {
    marginTop: 18,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#dce2f7',
    borderRadius: 12,
    backgroundColor: '#f7f9ff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  timer: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  statusText: {
    fontSize: 14,
    color: '#5f6d8a',
    textAlign: 'center',
  },
  transcriptPreview: {
    fontSize: 13,
    color: '#444',
    textAlign: 'center',
  },
  actions: {
    marginTop: 16,
    gap: 10,
  },
  primaryButton: {
    backgroundColor: '#4f6ef7',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#dce2f7',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#4f6ef7',
    fontWeight: '700',
  },
});
