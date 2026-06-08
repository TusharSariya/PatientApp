// Shared Jest setup for React Native tests.

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    start: jest.fn(),
    stop: jest.fn(),
  },
  useSpeechRecognitionEvent: jest.fn(),
}));

jest.mock('expo-audio', () => ({
  AudioQuality: { HIGH: 96 },
  IOSOutputFormat: { LINEARPCM: 'lpcm' },
  requestRecordingPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  useAudioRecorder: jest.fn(() => ({
    prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
    record: jest.fn(),
    stop: jest.fn().mockResolvedValue(undefined),
    uri: '/tmp/visit.wav',
  })),
  useAudioRecorderState: jest.fn(() => ({ isRecording: true })),
}));

jest.mock('react-native-litert-lm', () => ({
  GEMMA_4_E2B_IT: 'https://example.com/gemma-4-e2b.litertlm',
  GEMMA_4_E4B_IT: 'https://example.com/gemma-4-e4b.litertlm',
  createLLM: jest.fn(() => ({
    loadModel: jest.fn().mockResolvedValue(undefined),
    sendMessage: jest.fn().mockResolvedValue('{"complaints":"fever"}'),
    sendMessageWithAudio: jest.fn().mockResolvedValue('{"complaints":"fever","bp":"120/80"}'),
    resetConversation: jest.fn(),
    isReady: jest.fn().mockReturnValue(true),
    close: jest.fn(),
    deleteModel: jest.fn().mockResolvedValue(undefined),
    getMemoryUsage: jest.fn().mockReturnValue({
      availableMemoryBytes: 6 * 1024 * 1024 * 1024,
      isLowMemory: false,
    }),
  })),
  checkBackendSupport: jest.fn(),
  checkMultimodalSupport: jest.fn(),
}));

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
}));
