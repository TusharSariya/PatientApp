import { getVisitDictationModelUi } from '../src/gemma/visitDictationModelUi';

const baseCache = {
  isComplete: false,
  isPartial: false,
  bytes: 0,
  expectedBytes: 1000,
};

describe('visitDictationModelUi', () => {
  test('ready when visit model is loaded', () => {
    const ui = getVisitDictationModelUi({
      gemmaVariant: 'gemma3-1b',
      modelState: { isReady: true, loadedVariant: 'gemma3-1b', operation: null },
      cacheStatus: { ...baseCache, isComplete: true },
    });
    expect(ui.isReady).toBe(true);
    expect(ui.statusLabel).toBe('Ready for extraction');
    expect(ui.primaryAction).toBeNull();
  });

  test('load when downloaded but not loaded', () => {
    const ui = getVisitDictationModelUi({
      gemmaVariant: 'gemma3-1b',
      modelState: { isReady: false, loadedVariant: null, operation: null },
      cacheStatus: { ...baseCache, isComplete: true },
    });
    expect(ui.primaryAction).toEqual({ label: 'Load', action: 'load', disabled: false });
    expect(ui.statusLabel).toBe('Downloaded');
  });

  test('download when not cached', () => {
    const ui = getVisitDictationModelUi({
      gemmaVariant: 'gemma3-1b',
      modelState: { isReady: false, loadedVariant: null, operation: null },
      cacheStatus: baseCache,
    });
    expect(ui.primaryAction).toEqual({ label: 'Download', action: 'download', disabled: false });
    expect(ui.statusLabel).toBe('Not downloaded');
  });

  test('mismatch when different model loaded', () => {
    const ui = getVisitDictationModelUi({
      gemmaVariant: 'e2b',
      modelState: { isReady: true, loadedVariant: 'gemma3-1b', operation: null },
      cacheStatus: { ...baseCache, isComplete: true },
    });
    expect(ui.mismatchLoadedLabel).toBe('Gemma 3 1B');
    expect(ui.primaryAction?.action).toBe('load');
    expect(ui.isReady).toBe(false);
  });

  test('retry load after failure', () => {
    const ui = getVisitDictationModelUi({
      gemmaVariant: 'gemma3-1b',
      modelState: {
        isReady: false,
        loadedVariant: null,
        operation: { type: 'load', variant: 'gemma3-1b', error: 'OOM' },
      },
      cacheStatus: { ...baseCache, isComplete: true },
    });
    expect(ui.statusLabel).toBe('Load failed');
    expect(ui.primaryAction).toEqual({ label: 'Retry load', action: 'load', disabled: false });
  });

  test('cancel while downloading', () => {
    const ui = getVisitDictationModelUi({
      gemmaVariant: 'gemma3-1b',
      modelState: {
        isReady: false,
        loadedVariant: null,
        operation: { type: 'download', variant: 'gemma3-1b', progress: 0.42 },
        downloadProgress: 0.42,
      },
      cacheStatus: baseCache,
    });
    expect(ui.statusLabel).toContain('Downloading 42%');
    expect(ui.primaryAction).toEqual({ label: 'Cancel', action: 'cancel', disabled: false });
  });

  test('busy while loading into memory', () => {
    const ui = getVisitDictationModelUi({
      gemmaVariant: 'gemma3-1b',
      modelState: {
        isReady: false,
        loadedVariant: null,
        operation: { type: 'load', variant: 'gemma3-1b', error: null },
      },
      cacheStatus: { ...baseCache, isComplete: true },
    });
    expect(ui.busy).toBe(true);
    expect(ui.primaryAction).toBeNull();
  });
});
