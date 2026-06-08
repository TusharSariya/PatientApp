import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
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
import {
  cancelGemmaDownload,
  downloadGemmaModel,
  getGemmaCacheStatus,
  getGemmaModelState,
  loadCachedGemmaModel,
  subscribeGemmaModelManager,
} from './gemma/GemmaModelManager';
import { getOnDeviceModel, MAX_VISIT_RECORDING_SECONDS, modelSupportsNativeAudio } from './gemma/gemmaConfig';
import { getVisitDictationModelUi } from './gemma/visitDictationModelUi';
import { MOCK_VISIT_DICTATION_SCRIPT_LIST } from './visitExtraction/mockVisitDictationScripts';
import { VISIT_RECORDING_OPTIONS } from './visitExtraction/visitRecordingOptions';

export default function VisitNarrativeSheet({
  visible,
  onClose,
  onExtracted,
  onTranscriptSaved,
  gemmaVariant = 'e2b',
  navigation,
}) {
  const [modelState, setModelState] = useState(getGemmaModelState);
  const [cacheStatus, setCacheStatus] = useState(() => getGemmaCacheStatus(gemmaVariant));
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [fallbackTranscript, setFallbackTranscript] = useState('');
  const [useFallback, setUseFallback] = useState(false);
  const [scriptExpanded, setScriptExpanded] = useState(false);
  const [selectedScriptId, setSelectedScriptId] = useState('fullVisit');
  const fallbackTranscriptRef = useRef('');
  const savedTranscriptRef = useRef('');
  const fallbackModeRef = useRef(false);
  const audioUriRef = useRef(null);
  const timerRef = useRef(null);
  const transcriptScrollRef = useRef(null);
  const gemmaVariantRef = useRef(gemmaVariant);

  const recorder = useAudioRecorder(VISIT_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 500);

  gemmaVariantRef.current = gemmaVariant;

  const visitModel = getOnDeviceModel(gemmaVariant);
  const modelUi = getVisitDictationModelUi({ gemmaVariant, modelState, cacheStatus });

  useEffect(() => {
    return subscribeGemmaModelManager((nextState) => {
      setModelState(nextState);
      setCacheStatus(getGemmaCacheStatus(gemmaVariantRef.current));
    });
  }, []);

  useEffect(() => {
    setCacheStatus(getGemmaCacheStatus(gemmaVariant));
  }, [gemmaVariant]);

  useEffect(() => {
    if (!visible) {
      setPhase('idle');
      setError('');
      setElapsed(0);
      setFallbackTranscript('');
      setUseFallback(false);
      setScriptExpanded(false);
      fallbackTranscriptRef.current = '';
      savedTranscriptRef.current = '';
      audioUriRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [visible]);

  useEffect(() => {
    if (!fallbackTranscript) return;
    transcriptScrollRef.current?.scrollToEnd({ animated: true });
  }, [fallbackTranscript]);

  const selectedScript = MOCK_VISIT_DICTATION_SCRIPT_LIST.find((script) => script.id === selectedScriptId)
    ?? MOCK_VISIT_DICTATION_SCRIPT_LIST[0];

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
    setPhase(resolveIdlePhase());
  });

  function resolveIdlePhase() {
    return savedTranscriptRef.current ? 'failed' : 'idle';
  }

  function handleExtractionFailure(transcript, message) {
    const text = (transcript ?? '').trim();
    if (text) {
      savedTranscriptRef.current = text;
      fallbackTranscriptRef.current = text;
      setFallbackTranscript(text);
      onTranscriptSaved?.(text);
    }
    setPhase('failed');
    setError(message ?? 'Extraction failed. Dictation saved to your visit draft.');
  }

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

  async function ensureModelLoaded() {
    const state = getGemmaModelState();
    if (state.isReady && state.loadedVariant === gemmaVariant) return;

    const cache = getGemmaCacheStatus(gemmaVariant);
    if (!cache.isComplete) {
      throw new Error('Model is not downloaded yet. Tap Download below, then try again.');
    }

    await loadCachedGemmaModel(gemmaVariant);
  }

  async function runExtraction({ transcript, audioUri }) {
    setPhase('extracting');
    setError('');
    await ensureModelLoaded();

    const extraction = transcript
      ? await extractVisitFromText(transcript, { variant: gemmaVariant })
      : await extractVisitFromAudio(audioUri, { variant: gemmaVariant });

    onExtracted?.(extraction);
    onClose?.();
  }

  async function handleModelAction(action) {
    setError('');
    try {
      if (action === 'load') {
        await loadCachedGemmaModel(gemmaVariant);
        setPhase(resolveIdlePhase());
      } else if (action === 'download') {
        await downloadGemmaModel(gemmaVariant);
        setCacheStatus(getGemmaCacheStatus(gemmaVariant));
        setPhase(resolveIdlePhase());
      } else if (action === 'cancel') {
        cancelGemmaDownload();
      }
    } catch (modelError) {
      setPhase(resolveIdlePhase());
      setError(modelError?.message ?? 'Model operation failed.');
    }
  }

  async function startRecording() {
    setError('');
    const state = getGemmaModelState();
    const readyNow = state.isReady && state.loadedVariant === gemmaVariant;
    const textOnlyModel = !modelSupportsNativeAudio(gemmaVariant);
    const shouldUseFallback = !readyNow || textOnlyModel;
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
      setPhase(resolveIdlePhase());
      setError(startError?.message ?? 'Could not start recording.');
    }
  }

  async function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    let transcript = '';
    let audioUri = null;

    try {
      if (fallbackModeRef.current) {
        await ExpoSpeechRecognitionModule.stop();
        transcript = fallbackTranscriptRef.current.trim();
        if (!transcript) {
          throw new Error('No speech was captured.');
        }
      } else {
        await recorder.stop();
        audioUri = recorder.uri;
        if (!audioUri) {
          throw new Error('Recording file was not created.');
        }
        audioUriRef.current = audioUri;
      }

      await runExtraction({ transcript, audioUri });
    } catch (extractError) {
      const savedText = transcript
        || fallbackTranscriptRef.current.trim()
        || (audioUriRef.current ? '[Visit audio recorded — extraction failed]' : '');
      if (savedText) {
        handleExtractionFailure(savedText, extractError?.message ?? 'Visit extraction failed.');
      } else {
        setPhase(resolveIdlePhase());
        setError(extractError?.message ?? 'Visit extraction failed.');
      }
    }
  }

  async function retryExtraction() {
    const transcript = savedTranscriptRef.current.trim();
    const audioUri = audioUriRef.current;
    if (!transcript && !audioUri) {
      setError('No saved dictation to extract.');
      return;
    }
    if (transcript.startsWith('[') && transcript.includes('extraction failed')) {
      setError('Reload the model and try recording again.');
      return;
    }

    try {
      await runExtraction({
        transcript: transcript || null,
        audioUri: transcript ? null : audioUri,
      });
    } catch (retryError) {
      handleExtractionFailure(
        transcript || savedTranscriptRef.current,
        retryError?.message ?? 'Visit extraction failed.',
      );
    }
  }

  function formatElapsed(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  const showTranscriptPanel = useFallback && (
    phase === 'recording' || phase === 'failed' || (phase === 'idle' && savedTranscriptRef.current)
  );

  const mismatchBanner = modelUi.mismatchLoadedLabel
    ? `${modelUi.mismatchLoadedLabel} is loaded; load ${visitModel.label} for this visit.`
    : null;

  function renderModelBar() {
    const { primaryAction, secondaryAction, busy, statusLabel, isReady } = modelUi;

    return (
      <View style={styles.modelBar} testID="visit-dictation-model-bar">
        <View style={styles.modelBarText}>
          <Text style={styles.modelBarLabel}>{visitModel.label}</Text>
          <Text style={[styles.modelBarStatus, isReady && styles.modelBarStatusReady]}>
            {statusLabel}
          </Text>
        </View>
        <View style={styles.modelBarActions}>
          {busy ? (
            <ActivityIndicator color="#4f6ef7" size="small" testID="visit-dictation-model-busy" />
          ) : (
            <>
              {primaryAction ? (
                <TouchableOpacity
                  testID={`visit-dictation-model-${primaryAction.action}`}
                  style={styles.modelBarButton}
                  onPress={() => handleModelAction(primaryAction.action)}
                  disabled={primaryAction.disabled}
                >
                  <Text style={styles.modelBarButtonText}>{primaryAction.label}</Text>
                </TouchableOpacity>
              ) : null}
              {secondaryAction ? (
                <TouchableOpacity
                  testID={`visit-dictation-model-${secondaryAction.action}`}
                  style={[styles.modelBarButton, styles.modelBarButtonSecondary]}
                  onPress={() => handleModelAction(secondaryAction.action)}
                  disabled={secondaryAction.disabled}
                >
                  <Text style={[styles.modelBarButtonText, styles.modelBarButtonTextSecondary]}>
                    {secondaryAction.label}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
        {navigation ? (
          <TouchableOpacity
            testID="visit-dictation-manage-models"
            onPress={() => navigation.navigate('VisitAiSettings')}
          >
            <Text style={styles.manageModelsLink}>Manage models</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  function renderTranscriptPanel() {
    const text = fallbackTranscript || savedTranscriptRef.current;
    const expanded = phase === 'recording' || phase === 'failed';

    return (
      <ScrollView
        ref={transcriptScrollRef}
        testID="visit-dictation-transcript-scroll"
        style={[styles.transcriptScroll, expanded && styles.transcriptScrollExpanded]}
        nestedScrollEnabled
        onContentSizeChange={() => transcriptScrollRef.current?.scrollToEnd({ animated: true })}
      >
        {text ? (
          <Text testID="visit-dictation-transcript-text" selectable style={styles.transcriptText}>
            {text}
          </Text>
        ) : (
          <Text style={styles.transcriptPlaceholder}>Speak now — your words will appear here</Text>
        )}
      </ScrollView>
    );
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
          {renderModelBar()}
          {mismatchBanner ? (
            <Text style={styles.banner} testID="visit-dictation-mismatch-banner">
              {mismatchBanner}
            </Text>
          ) : null}
          {!modelUi.isReady && !mismatchBanner && modelSupportsNativeAudio(gemmaVariant) ? (
            <Text style={styles.banner}>
              You can record now. Load the model below before stopping to extract visit fields.
            </Text>
          ) : !modelUi.isReady && !mismatchBanner ? (
            <Text style={styles.banner}>
              Dictation uses system speech. Load the model below before extracting visit fields.
            </Text>
          ) : modelUi.isReady && !modelSupportsNativeAudio(gemmaVariant) ? (
            <Text style={styles.banner}>
              This model uses system speech for dictation, then on-device text extraction.
            </Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {__DEV__ && phase === 'idle' ? (
            <View style={styles.scriptSection}>
              <TouchableOpacity
                testID="visit-dictation-script-toggle"
                style={styles.scriptToggle}
                onPress={() => setScriptExpanded((value) => !value)}
              >
                <Text style={styles.scriptToggleText}>
                  {scriptExpanded ? 'Hide sample script' : 'Show sample script'}
                </Text>
              </TouchableOpacity>
              {scriptExpanded ? (
                <>
                  <View style={styles.scriptPicker}>
                    {MOCK_VISIT_DICTATION_SCRIPT_LIST.map((script) => {
                      const active = script.id === selectedScriptId;
                      return (
                        <TouchableOpacity
                          key={script.id}
                          testID={`visit-dictation-script-option-${script.id}`}
                          style={[styles.scriptOption, active && styles.scriptOptionActive]}
                          onPress={() => setSelectedScriptId(script.id)}
                        >
                          <Text style={[styles.scriptOptionText, active && styles.scriptOptionTextActive]}>
                            {script.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <ScrollView style={styles.scriptScroll} nestedScrollEnabled>
                    <Text testID="visit-dictation-script-text" selectable style={styles.scriptText}>
                      {selectedScript.transcript}
                    </Text>
                    {selectedScript.tips?.length ? (
                      <Text style={styles.scriptTips}>
                        Tips: {selectedScript.tips.join(' ')}
                      </Text>
                    ) : null}
                  </ScrollView>
                </>
              ) : null}
            </View>
          ) : null}
          <View style={[styles.statusBox, showTranscriptPanel && styles.statusBoxRecording]}>
            {phase === 'extracting' ? (
              <>
                <ActivityIndicator color="#4f6ef7" />
                <Text style={styles.statusText}>Extracting visit fields…</Text>
              </>
            ) : (
              <>
                {phase !== 'failed' ? (
                  <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>
                ) : null}
                <Text style={styles.statusText}>
                  {phase === 'recording'
                    ? useFallback
                      ? 'Listening with system speech…'
                      : `Recording${recorderState.isRecording ? '' : '…'}`
                    : phase === 'failed'
                      ? 'Dictation saved to draft'
                      : 'Ready to record'}
                </Text>
                {showTranscriptPanel ? renderTranscriptPanel() : null}
              </>
            )}
          </View>
          <View style={styles.actions}>
            {phase === 'recording' ? (
              <TouchableOpacity testID="stop-visit-dictation" style={styles.primaryButton} onPress={stopRecording}>
                <Text style={styles.primaryButtonText}>Stop and Extract</Text>
              </TouchableOpacity>
            ) : phase === 'failed' ? (
              <>
                <TouchableOpacity testID="retry-visit-extraction" style={styles.primaryButton} onPress={retryExtraction}>
                  <Text style={styles.primaryButtonText}>Retry extraction</Text>
                </TouchableOpacity>
                {!modelUi.isReady && modelUi.primaryAction?.action === 'load' ? (
                  <TouchableOpacity
                    testID="failed-load-model"
                    style={styles.secondaryButton}
                    onPress={() => handleModelAction('load')}
                  >
                    <Text style={styles.secondaryButtonText}>Load model</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : phase === 'idle' ? (
              <TouchableOpacity testID="start-visit-dictation" style={styles.primaryButton} onPress={startRecording}>
                <Text style={styles.primaryButtonText}>Start Recording</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>{phase === 'failed' ? 'Close' : 'Cancel'}</Text>
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
    maxHeight: '92%',
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
  modelBar: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#dce2f7',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fafbff',
    gap: 8,
  },
  modelBarText: {
    gap: 2,
  },
  modelBarLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  modelBarStatus: {
    fontSize: 13,
    color: '#8a5a00',
  },
  modelBarStatusReady: {
    color: '#0d6b4d',
  },
  modelBarActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  modelBarButton: {
    backgroundColor: '#4f6ef7',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modelBarButtonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dce2f7',
  },
  modelBarButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  modelBarButtonTextSecondary: {
    color: '#4f6ef7',
  },
  manageModelsLink: {
    fontSize: 13,
    color: '#4f6ef7',
    fontWeight: '600',
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
  scriptSection: {
    marginTop: 12,
  },
  scriptToggle: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  scriptToggleText: {
    color: '#4f6ef7',
    fontWeight: '700',
    fontSize: 14,
  },
  scriptPicker: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  scriptOption: {
    borderWidth: 1,
    borderColor: '#dce2f7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  scriptOptionActive: {
    backgroundColor: '#eef2ff',
    borderColor: '#4f6ef7',
  },
  scriptOptionText: {
    fontSize: 13,
    color: '#5f6d8a',
    fontWeight: '600',
  },
  scriptOptionTextActive: {
    color: '#4f6ef7',
  },
  scriptScroll: {
    maxHeight: 140,
    borderWidth: 1,
    borderColor: '#dce2f7',
    borderRadius: 10,
    backgroundColor: '#fafbff',
    padding: 12,
  },
  scriptText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#333',
  },
  scriptTips: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: '#8a5a00',
  },
  statusBox: {
    marginTop: 18,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#dce2f7',
    borderRadius: 12,
    backgroundColor: '#f7f9ff',
    alignItems: 'stretch',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  statusBoxRecording: {
    minHeight: 200,
  },
  timer: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a2e',
    textAlign: 'center',
  },
  statusText: {
    fontSize: 14,
    color: '#5f6d8a',
    textAlign: 'center',
  },
  transcriptScroll: {
    maxHeight: 80,
    marginTop: 4,
  },
  transcriptScrollExpanded: {
    maxHeight: 220,
    flexGrow: 1,
  },
  transcriptText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
  },
  transcriptPlaceholder: {
    fontSize: 14,
    lineHeight: 22,
    color: '#999',
    fontStyle: 'italic',
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
