import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import VisitNarrativeSheet from '../src/VisitNarrativeSheet';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import {
  downloadGemmaModel,
  getGemmaCacheStatus,
  getGemmaModelState,
  loadCachedGemmaModel,
  subscribeGemmaModelManager,
} from '../src/gemma/GemmaModelManager';
import { extractVisitFromText } from '../src/gemma/gemmaVisitExtractor';

jest.mock('../src/visitExtraction/visitRecordingOptions', () => ({
  VISIT_RECORDING_OPTIONS: {},
}));

jest.mock('expo-audio', () => ({
  requestRecordingPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  useAudioRecorder: jest.fn(() => ({
    prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
    record: jest.fn(),
    stop: jest.fn().mockResolvedValue(undefined),
    uri: 'file:///audio.m4a',
  })),
  useAudioRecorderState: jest.fn(() => ({ isRecording: true })),
}));

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
  },
  useSpeechRecognitionEvent: jest.fn(),
}));

let managerListener = null;

jest.mock('../src/gemma/GemmaModelManager', () => {
  const getGemmaModelState = jest.fn();
  const getGemmaCacheStatus = jest.fn();
  return {
    getGemmaModelState,
    getGemmaCacheStatus,
    loadCachedGemmaModel: jest.fn(),
    downloadGemmaModel: jest.fn(),
    cancelGemmaDownload: jest.fn(),
    subscribeGemmaModelManager: jest.fn((listener) => {
      managerListener = listener;
      listener(getGemmaModelState());
      return () => {
        managerListener = null;
      };
    }),
  };
});

jest.mock('../src/gemma/gemmaVisitExtractor', () => ({
  extractVisitFromText: jest.fn(),
  extractVisitFromAudio: jest.fn(),
}));

function notifyManagerState(nextState) {
  getGemmaModelState.mockReturnValue(nextState);
  act(() => {
    managerListener?.(nextState);
  });
}

describe('VisitNarrativeSheet', () => {
  const speechHandlers = {};

  beforeEach(() => {
    jest.clearAllMocks();
    managerListener = null;
    Object.keys(speechHandlers).forEach((key) => delete speechHandlers[key]);
    useSpeechRecognitionEvent.mockImplementation((eventName, handler) => {
      speechHandlers[eventName] = handler;
    });
    getGemmaCacheStatus.mockReturnValue({
      isComplete: true,
      isPartial: false,
      bytes: 1000,
      expectedBytes: 1000,
    });
    getGemmaModelState.mockReturnValue({
      isReady: false,
      loadedVariant: null,
      operation: null,
      downloadProgress: 0,
    });
    loadCachedGemmaModel.mockImplementation(async () => {
      notifyManagerState({
        isReady: true,
        loadedVariant: 'gemma3-1b',
        operation: null,
        downloadProgress: 0,
      });
    });
    subscribeGemmaModelManager.mockImplementation((listener) => {
      managerListener = listener;
      listener(getGemmaModelState());
      return () => {
        managerListener = null;
      };
    });
    extractVisitFromText.mockResolvedValue({
      fields: { complaints: 'fever', medicines: [] },
      warnings: [],
      transcript: 'Patient has fever',
    });
  });

  test('shows Load button when model is downloaded but not loaded', () => {
    render(
      <VisitNarrativeSheet visible gemmaVariant="gemma3-1b" onClose={jest.fn()} />
    );

    expect(screen.getByTestId('visit-dictation-model-bar')).toBeTruthy();
    expect(screen.getByTestId('visit-dictation-model-load')).toBeTruthy();
    expect(screen.queryByTestId('visit-dictation-model-unload')).toBeNull();
  });

  test('loads model when Load is pressed and shows ready status', async () => {
    render(
      <VisitNarrativeSheet visible gemmaVariant="gemma3-1b" onClose={jest.fn()} />
    );

    fireEvent.press(screen.getByTestId('visit-dictation-model-load'));

    await waitFor(() => {
      expect(loadCachedGemmaModel).toHaveBeenCalledWith('gemma3-1b');
    });
    expect(screen.getByText('Ready for extraction')).toBeTruthy();
    expect(screen.queryByTestId('visit-dictation-model-load')).toBeNull();
  });

  test('shows mismatch banner when another model is loaded', () => {
    getGemmaModelState.mockReturnValue({
      isReady: true,
      loadedVariant: 'gemma3-1b',
      operation: null,
      downloadProgress: 0,
    });

    render(
      <VisitNarrativeSheet visible gemmaVariant="e2b" onClose={jest.fn()} />
    );

    expect(screen.getByTestId('visit-dictation-mismatch-banner')).toBeTruthy();
    expect(screen.getByText(/Gemma 3 1B is loaded/)).toBeTruthy();
  });

  test('shows full scrollable transcript while recording', async () => {
    render(
      <VisitNarrativeSheet visible gemmaVariant="gemma3-1b" onClose={jest.fn()} />
    );

    fireEvent.press(screen.getByTestId('start-visit-dictation'));

    await waitFor(() => {
      expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalled();
    });

    act(() => {
      speechHandlers.result?.({
        results: [{ transcript: 'Chief complaints sore throat and cough for three days' }],
      });
    });

    const transcriptText = await screen.findByTestId('visit-dictation-transcript-text');
    expect(transcriptText.props.numberOfLines).toBeUndefined();
    expect(transcriptText.props.children).toContain('sore throat');
    expect(screen.getByTestId('visit-dictation-transcript-scroll')).toBeTruthy();
  });

  test('saves transcript and enters failed state when extraction fails', async () => {
    const onTranscriptSaved = jest.fn();
    extractVisitFromText.mockRejectedValue(new Error('Model extraction failed'));

    render(
      <VisitNarrativeSheet
        visible
        gemmaVariant="gemma3-1b"
        onClose={jest.fn()}
        onTranscriptSaved={onTranscriptSaved}
      />
    );

    fireEvent.press(screen.getByTestId('start-visit-dictation'));
    await waitFor(() => expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalled());

    act(() => {
      speechHandlers.result?.({
        results: [{ transcript: 'Patient has fever and cough' }],
      });
    });

    fireEvent.press(screen.getByTestId('stop-visit-dictation'));

    await waitFor(() => {
      expect(onTranscriptSaved).toHaveBeenCalledWith('Patient has fever and cough');
    });
    expect(screen.getByTestId('retry-visit-extraction')).toBeTruthy();
    expect(screen.getByTestId('visit-dictation-transcript-text').props.children).toBe(
      'Patient has fever and cough'
    );
  });

  test('stays on failed screen after loading model from failed state', async () => {
    const onTranscriptSaved = jest.fn();
    let loadAttempts = 0;
    loadCachedGemmaModel.mockImplementation(async () => {
      loadAttempts += 1;
      if (loadAttempts === 1) {
        throw new Error('Model load failed during extraction');
      }
      notifyManagerState({
        isReady: true,
        loadedVariant: 'gemma3-1b',
        operation: null,
        downloadProgress: 0,
      });
    });

    render(
      <VisitNarrativeSheet
        visible
        gemmaVariant="gemma3-1b"
        onClose={jest.fn()}
        onTranscriptSaved={onTranscriptSaved}
      />
    );

    fireEvent.press(screen.getByTestId('start-visit-dictation'));
    await waitFor(() => expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalled());
    act(() => {
      speechHandlers.result?.({ results: [{ transcript: 'Saved dictation text' }] });
    });
    fireEvent.press(screen.getByTestId('stop-visit-dictation'));
    await waitFor(() => expect(screen.getByTestId('retry-visit-extraction')).toBeTruthy());

    fireEvent.press(screen.getByTestId('failed-load-model'));

    await waitFor(() => {
      expect(loadAttempts).toBe(2);
    });
    expect(screen.getByTestId('retry-visit-extraction')).toBeTruthy();
    expect(screen.getByText('Dictation saved to draft')).toBeTruthy();
  });

  test('shows Download when model is not cached', () => {
    getGemmaCacheStatus.mockReturnValue({
      isComplete: false,
      isPartial: false,
      bytes: 0,
      expectedBytes: 1000,
    });

    render(
      <VisitNarrativeSheet visible gemmaVariant="gemma3-1b" onClose={jest.fn()} />
    );

    expect(screen.getByTestId('visit-dictation-model-download')).toBeTruthy();
    fireEvent.press(screen.getByTestId('visit-dictation-model-download'));
    expect(downloadGemmaModel).toHaveBeenCalledWith('gemma3-1b');
  });
});
