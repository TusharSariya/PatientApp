import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import VisitAiSettingsScreen from '../src/VisitAiSettingsScreen';

jest.mock('../src/database', () => ({
  getAppSettings: jest.fn().mockResolvedValue({
    gemmaModelVariant: 'e2b',
    gemmaModelDownloaded: false,
  }),
  saveAppSettings: jest.fn().mockImplementation(async (patch) => ({
    gemmaModelVariant: 'e2b',
    gemmaModelDownloaded: false,
    ...patch,
  })),
}));

jest.mock('../src/gemma/GemmaModelManager', () => ({
  subscribeGemmaModelManager: jest.fn((listener) => {
    listener({
      phase: 'idle',
      isReady: false,
      isLoading: false,
      downloadProgress: 0,
      attempt: 0,
      maxAttempts: 4,
      cachedOnDisk: false,
      error: null,
      variant: 'e2b',
    });
    return () => {};
  }),
  getGemmaModelState: jest.fn(() => ({
    phase: 'idle',
    isReady: false,
    isLoading: false,
    downloadProgress: 0,
    attempt: 0,
    maxAttempts: 4,
    cachedOnDisk: false,
    error: null,
    variant: 'e2b',
  })),
  getGemmaCacheStatus: jest.fn(() => ({
    exists: false,
    bytes: 0,
    expectedBytes: 2_800_000_000,
    isComplete: false,
    isPartial: false,
  })),
  getGemmaLlm: jest.fn(() => null),
  getDeviceReadiness: jest.fn(() => ({
    iosRequiresEntitlement: true,
    iosNeedsEntitlement: true,
    meetsMinRam: true,
    multimodalWarning: null,
    backendWarning: null,
  })),
  loadGemmaModel: jest.fn().mockResolvedValue({}),
  unloadGemmaModel: jest.fn().mockResolvedValue(undefined),
  deleteCachedGemmaModel: jest.fn().mockResolvedValue(undefined),
  cancelGemmaDownload: jest.fn(),
}));

const manager = require('../src/gemma/GemmaModelManager');
const database = require('../src/database');

describe('VisitAiSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  test('renders model cards and download action', async () => {
    render(<VisitAiSettingsScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('gemma-variant-gemma3n-e2b')).toBeTruthy();
      expect(screen.getByTestId('gemma-variant-e2b')).toBeTruthy();
      expect(screen.getByTestId('gemma-status-label').props.children).toBe('Not downloaded');
    });
    expect(screen.getByText('Download model')).toBeTruthy();
    expect(screen.getByText('iOS friendly')).toBeTruthy();
  });

  test('selects a different model card', async () => {
    render(<VisitAiSettingsScreen />);
    await waitFor(() => expect(screen.getByTestId('gemma-variant-gemma3n-e2b')).toBeTruthy());
    fireEvent.press(screen.getByTestId('gemma-variant-gemma3n-e2b'));
    await waitFor(() => {
      expect(database.saveAppSettings).toHaveBeenCalledWith({ gemmaModelVariant: 'gemma3n-e2b' });
    });
  });

  test('starts download and saves settings on success', async () => {
    render(<VisitAiSettingsScreen />);
    fireEvent.press(screen.getByTestId('download-gemma-model'));
    await waitFor(() => {
      expect(manager.loadGemmaModel).toHaveBeenCalledWith('e2b');
      expect(database.saveAppSettings).toHaveBeenCalledWith({ gemmaModelDownloaded: true });
    });
  });

  test('shows resume label when partial cache exists', async () => {
    manager.getGemmaCacheStatus.mockImplementation((variant) => (
      variant === 'e2b'
        ? {
          exists: true,
          bytes: 1_400_000_000,
          expectedBytes: 2_800_000_000,
          isComplete: false,
          isPartial: true,
        }
        : {
          exists: false,
          bytes: 0,
          expectedBytes: 2_800_000_000,
          isComplete: false,
          isPartial: false,
        }
    ));
    render(<VisitAiSettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText('Resume download')).toBeTruthy();
      expect(screen.getByTestId('gemma-status-label').props.children).toContain('Partial');
    });
  });

  test('shows retry and error state after failed download', async () => {
    manager.subscribeGemmaModelManager.mockImplementation((listener) => {
      listener({
        phase: 'error',
        isReady: false,
        isLoading: false,
        downloadProgress: 0.4,
        attempt: 2,
        maxAttempts: 4,
        cachedOnDisk: false,
        error: 'Download stalled. Check your connection and try again.',
        variant: 'e2b',
      });
      return () => {};
    });
    manager.getGemmaCacheStatus.mockReturnValue({
      exists: true,
      bytes: 500_000_000,
      expectedBytes: 2_800_000_000,
      isComplete: false,
      isPartial: true,
    });

    render(<VisitAiSettingsScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('gemma-error-text').props.children)
        .toBe('Download stalled. Check your connection and try again.');
    });
    expect(screen.getByTestId('retry-gemma-download')).toBeTruthy();
  });

  test('delete asks for confirmation', async () => {
    manager.getGemmaCacheStatus.mockReturnValue({
      exists: true,
      bytes: 2_800_000_000,
      expectedBytes: 2_800_000_000,
      isComplete: true,
      isPartial: false,
    });
    manager.subscribeGemmaModelManager.mockImplementation((listener) => {
      listener({
        phase: 'ready',
        isReady: true,
        isLoading: false,
        downloadProgress: 1,
        attempt: 0,
        maxAttempts: 4,
        cachedOnDisk: true,
        error: null,
        variant: 'e2b',
      });
      return () => {};
    });

    render(<VisitAiSettingsScreen />);
    fireEvent.press(screen.getByTestId('delete-gemma-model'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Delete cached model?',
      expect.stringContaining('frees about'),
      expect.any(Array)
    );
  });
});
