// Shared Jest setup for React Native tests.

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    start: jest.fn(),
    stop: jest.fn(),
  },
  useSpeechRecognitionEvent: jest.fn(),
}));

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
}));
