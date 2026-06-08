// Shared Jest setup for React Native tests.

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    start: jest.fn(),
    stop: jest.fn(),
  },
  useSpeechRecognitionEvent: jest.fn(),
}));

const mockFileStore = new Map();

function mockKey(parts) {
  return parts.filter(Boolean).join('/');
}

function mockCreateFile(...uris) {
  const key = mockKey(uris.map((part) => (typeof part === 'string' ? part : part?.uri ?? part?.name ?? 'file')));
  const file = {
    uri: `file://${key}`,
    exists: mockFileStore.has(key),
    size: mockFileStore.get(key)?.length ?? 0,
    create: jest.fn(({ overwrite } = {}) => {
      if (!overwrite && mockFileStore.has(key)) return;
      mockFileStore.set(key, new Uint8Array());
      file.exists = true;
      file.size = 0;
    }),
    delete: jest.fn(() => {
      mockFileStore.delete(key);
      file.exists = false;
      file.size = 0;
    }),
    write: jest.fn((content) => {
      const bytes = content instanceof Uint8Array ? content : new TextEncoder().encode(String(content));
      mockFileStore.set(key, bytes);
      file.exists = true;
      file.size = bytes.length;
    }),
    textSync: jest.fn(() => {
      const bytes = mockFileStore.get(key);
      return bytes ? new TextDecoder().decode(bytes) : '';
    }),
    move: jest.fn((dest) => {
      const destKey = dest?.uri?.replace(/^file:\/\//, '') ?? mockKey([dest?.name ?? 'moved']);
      const bytes = mockFileStore.get(key) ?? new Uint8Array();
      mockFileStore.set(destKey, bytes);
      mockFileStore.delete(key);
      file.exists = false;
      if (dest && typeof dest === 'object') {
        dest.exists = true;
        dest.size = bytes.length;
        dest.uri = `file://${destKey}`;
      }
    }),
    open: jest.fn(() => {
      let offset = 0;
      return {
        get offset() { return offset; },
        set offset(value) { offset = value; },
        writeBytes: jest.fn((bytes) => {
          const existing = mockFileStore.get(key) ?? new Uint8Array();
          const merged = new Uint8Array(existing.length + bytes.length);
          merged.set(existing);
          merged.set(bytes, existing.length);
          mockFileStore.set(key, merged);
          file.exists = true;
          file.size = merged.length;
          offset = merged.length;
        }),
        close: jest.fn(),
      };
    }),
  };
  return file;
}

jest.mock('expo-file-system', () => ({
  Paths: { cache: 'file://cache' },
  Directory: jest.fn(function Directory(...uris) {
    const key = mockKey(uris.map((part) => (typeof part === 'string' ? part : part?.uri ?? part?.name ?? 'dir')));
    return {
      uri: `file://${key}`,
      exists: true,
      create: jest.fn(),
      name: key.split('/').pop(),
    };
  }),
  File: jest.fn(mockCreateFile),
  __mockFileStore: mockFileStore,
  __resetMockFileStore: () => mockFileStore.clear(),
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

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      gemmaIosExtendedAddressing: false,
    },
  },
}));

jest.mock('react-native-litert-lm', () => ({
  GEMMA_3N_E2B_IT_INT4: 'https://example.com/gemma-3n-e2b.litertlm',
  GEMMA_4_E2B_IT: 'https://example.com/gemma-4-e2b.litertlm',
  GEMMA_4_E4B_IT: 'https://example.com/gemma-4-e4b.litertlm',
  createLLM: jest.fn(() => ({
    downloadModel: jest.fn().mockResolvedValue('file://cache/gemma_models/gemma-4-E2B-it.litertlm'),
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
