import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import VisitAiSettingsScreen from '../src/VisitAiSettingsScreen';

const defaultModelState = {
  phase: 'idle',
  isReady: false,
  isLoading: false,
  downloadProgress: 0,
  attempt: 0,
  maxAttempts: 4,
  cachedOnDisk: false,
  error: null,
  loadedVariant: null,
  variant: null,
  operation: null,
};

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

const eightGbProfile = {
  effectiveRamBytes: 8 * 1024 ** 3,
  effectiveRamGb: '8.0',
  totalRamGb: '8.0',
  ramKnown: true,
};

jest.mock('../src/gemma/deviceModelCompatibility', () => ({
  getDeviceMemoryProfile: jest.fn().mockResolvedValue(eightGbProfile),
  filterVisibleModels: jest.fn((models, profile, cacheByModelId, { devMode } = {}) => (
    models.map((model) => ({
      model,
      compatibility: {
        supported: true,
        iosBlocked: model.iosRequiresEntitlement,
        reasons: [],
        meetsMinRam: true,
      },
      cached: false,
      visible: true,
      devOnly: false,
    }))
  )),
  isVariantVisible: jest.fn(() => true),
  pickDefaultSupportedVariant: jest.fn(() => 'gemma3n-e2b'),
}));

jest.mock('../src/gemma/GemmaModelManager', () => ({
  subscribeGemmaModelManager: jest.fn((listener) => {
    listener(defaultModelState);
    return () => {};
  }),
  getGemmaModelState: jest.fn(() => defaultModelState),
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
    iosBlocked: true,
    meetsMinRam: true,
    availableRamGb: '8.0',
    ramKnown: true,
    multimodalWarning: null,
    backendWarning: null,
  })),
  downloadGemmaModel: jest.fn().mockResolvedValue('file://cache/model.litertlm'),
  loadCachedGemmaModel: jest.fn().mockResolvedValue({}),
  unloadGemmaModel: jest.fn().mockResolvedValue(undefined),
  deleteCachedGemmaModel: jest.fn().mockResolvedValue(undefined),
  cancelGemmaDownload: jest.fn(),
}));

const manager = require('../src/gemma/GemmaModelManager');
const compatibility = require('../src/gemma/deviceModelCompatibility');
const database = require('../src/database');

describe('VisitAiSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    compatibility.getDeviceMemoryProfile.mockResolvedValue(eightGbProfile);
    compatibility.filterVisibleModels.mockImplementation((models) => (
      models.map((model) => ({
        model,
        compatibility: {
          supported: true,
          iosBlocked: model.iosRequiresEntitlement,
          reasons: [],
          meetsMinRam: true,
        },
        devOnly: false,
      }))
    ));
    compatibility.isVariantVisible.mockReturnValue(true);
    manager.subscribeGemmaModelManager.mockImplementation((listener) => {
      listener(defaultModelState);
      return () => {};
    });
    manager.getGemmaCacheStatus.mockReturnValue({
      exists: false,
      bytes: 0,
      expectedBytes: 2_800_000_000,
      isComplete: false,
      isPartial: false,
    });
  });

  test('renders model cards with per-card download actions', async () => {
    render(<VisitAiSettingsScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('gemma-variant-gemma3n-e2b')).toBeTruthy();
      expect(screen.getByTestId('gemma-variant-e2b')).toBeTruthy();
    });
    expect(screen.getAllByText('Download').length).toBeGreaterThan(0);
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

  test('starts download from card action', async () => {
    render(<VisitAiSettingsScreen />);
    fireEvent.press(screen.getByTestId('e2b-primary-action'));
    await waitFor(() => {
      expect(manager.downloadGemmaModel).toHaveBeenCalledWith('e2b');
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
      expect(screen.getByText('Resume')).toBeTruthy();
      expect(screen.getByText(/Partial/)).toBeTruthy();
    });
  });

  test('shows error on card after failed download', async () => {
    manager.subscribeGemmaModelManager.mockImplementation((listener) => {
      listener({
        ...defaultModelState,
        phase: 'error',
        error: 'Download stalled. Check your connection and try again.',
        operation: {
          type: 'download',
          variant: 'e2b',
          progress: 0.4,
          attempt: 2,
          maxAttempts: 4,
          error: 'Download stalled. Check your connection and try again.',
        },
      });
      return () => {};
    });
    manager.getGemmaCacheStatus.mockImplementation((variant) => (
      variant === 'e2b'
        ? {
          exists: true,
          bytes: 500_000_000,
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
      expect(screen.getByTestId('e2b-error-text').props.children)
        .toBe('Download stalled. Check your connection and try again.');
    });
    expect(screen.getByTestId('e2b-primary-action')).toBeTruthy();
  });

  test('loads a downloaded model from card action', async () => {
    manager.getGemmaCacheStatus.mockImplementation((variant) => (
      variant === 'e2b'
        ? {
          exists: true,
          bytes: 2_800_000_000,
          expectedBytes: 2_800_000_000,
          isComplete: true,
          isPartial: false,
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
    fireEvent.press(screen.getByTestId('e2b-primary-action'));
    await waitFor(() => {
      expect(manager.loadCachedGemmaModel).toHaveBeenCalledWith('e2b');
    });
  });

  test('shows selection mismatch banner when loaded model differs from selected', async () => {
    manager.subscribeGemmaModelManager.mockImplementation((listener) => {
      listener({
        ...defaultModelState,
        phase: 'ready',
        isReady: true,
        loadedVariant: 'gemma3n-e2b',
        variant: 'gemma3n-e2b',
      });
      return () => {};
    });
    render(<VisitAiSettingsScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('selection-mismatch-banner').props.children)
        .toContain('is loaded');
    });
  });

  test('shows device RAM banner when profile is known', async () => {
    render(<VisitAiSettingsScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('device-ram-banner').props.children)
        .toContain('8.0 GB RAM');
    });
  });

  test('hides unsupported models when compatibility filter excludes them', async () => {
    compatibility.filterVisibleModels.mockImplementation((models) => (
      models
        .filter((model) => model.id === 'gemma3n-e2b')
        .map((model) => ({
          model,
          compatibility: { supported: true, iosBlocked: false, reasons: [] },
          devOnly: false,
        }))
    ));
    render(<VisitAiSettingsScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('gemma-variant-gemma3n-e2b')).toBeTruthy();
    });
    expect(screen.queryByTestId('gemma-variant-e4b')).toBeNull();
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
        ...defaultModelState,
        phase: 'ready',
        isReady: true,
        loadedVariant: 'e2b',
        variant: 'e2b',
      });
      return () => {};
    });

    render(<VisitAiSettingsScreen />);
    fireEvent.press(screen.getByTestId('e2b-secondary-action'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Delete cached model?',
      expect.stringContaining('frees about'),
      expect.any(Array)
    );
  });
});
