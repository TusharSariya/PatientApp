let mockIsReady = false;
const mockClose = jest.fn();
const mockLoadModel = jest.fn().mockImplementation(async () => {
  mockIsReady = true;
});
const mockCreateLLM = jest.fn(() => ({
  loadModel: mockLoadModel,
  isReady: () => mockIsReady,
  close: mockClose,
  deleteModel: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-litert-lm', () => ({
  GEMMA_3N_E2B_IT_INT4: 'https://example.com/gemma-3n-e2b.litertlm',
  GEMMA_4_E2B_IT: 'https://example.com/gemma-4-e2b.litertlm',
  GEMMA_4_E4B_IT: 'https://example.com/gemma-4-e4b.litertlm',
  createLLM: (...args) => mockCreateLLM(...args),
  checkBackendSupport: jest.fn(),
  checkMultimodalSupport: jest.fn(),
}));

const mockDownload = jest.fn().mockResolvedValue('file://cache/gemma_models/gemma-4-E2B-it.litertlm');
const mockGetCacheStatus = jest.fn();

jest.mock('../src/gemma/gemmaResumableDownload', () => ({
  downloadGemmaModelResumable: (...args) => mockDownload(...args),
  ensureGemmaCacheDirectory: jest.fn(),
  deleteDownloadArtifacts: jest.fn(),
  getGemmaCacheFileStatus: (...args) => mockGetCacheStatus(...args),
}));

function cacheComplete(bytes = 2_800_000_000) {
  return {
    exists: true,
    bytes,
    expectedBytes: bytes,
    isComplete: true,
    isPartial: false,
  };
}

function cacheMissing() {
  return {
    exists: false,
    bytes: 0,
    expectedBytes: 2_800_000_000,
    isComplete: false,
    isPartial: false,
  };
}

function cachePartial(bytes = 500_000_000) {
  return {
    exists: true,
    bytes,
    expectedBytes: 2_800_000_000,
    isComplete: false,
    isPartial: true,
  };
}

describe('GemmaModelManager', () => {
  let manager;

  beforeEach(() => {
    jest.resetModules();
    mockIsReady = false;
    mockClose.mockClear();
    mockLoadModel.mockClear();
    mockCreateLLM.mockClear();
    mockDownload.mockClear();
    mockGetCacheStatus.mockReset();
    manager = require('../src/gemma/GemmaModelManager');
  });

  test('downloadGemmaModel caches without loading into memory', async () => {
    mockGetCacheStatus.mockReturnValue(cacheMissing());
    await manager.downloadGemmaModel('e2b');
    expect(mockDownload).toHaveBeenCalled();
    expect(mockCreateLLM).not.toHaveBeenCalled();
    expect(manager.getGemmaModelState().isReady).toBe(false);
    expect(manager.getGemmaModelState().loadedVariant).toBeNull();
  });

  test('downloadGemmaModel skips transfer when already complete', async () => {
    mockGetCacheStatus.mockReturnValue(cacheComplete());
    await manager.downloadGemmaModel('e2b');
    expect(mockDownload).not.toHaveBeenCalled();
  });

  test('loadCachedGemmaModel loads a complete cache file', async () => {
    mockGetCacheStatus.mockReturnValue(cacheComplete());
    await manager.loadCachedGemmaModel('e2b');
    expect(mockCreateLLM).toHaveBeenCalled();
    expect(mockLoadModel).toHaveBeenCalled();
    const state = manager.getGemmaModelState();
    expect(state.isReady).toBe(true);
    expect(state.loadedVariant).toBe('e2b');
  });

  test('loadCachedGemmaModel rejects when model is not downloaded', async () => {
    mockGetCacheStatus.mockReturnValue(cacheMissing());
    await expect(manager.loadCachedGemmaModel('e2b')).rejects.toThrow('not downloaded');
  });

  test('cancelGemmaDownload preserves a loaded model', async () => {
    mockGetCacheStatus.mockImplementation(({ expectedBytes }) => {
      if (expectedBytes === 1_400_000_000) return cacheComplete(1_400_000_000);
      return cachePartial();
    });
    await manager.loadCachedGemmaModel('gemma3n-e2b');

    mockDownload.mockImplementation(() => new Promise(() => {}));
    manager.downloadGemmaModel('e2b');
    await Promise.resolve();
    manager.cancelGemmaDownload();

    const state = manager.getGemmaModelState();
    expect(state.isReady).toBe(true);
    expect(state.loadedVariant).toBe('gemma3n-e2b');
    expect(state.operation).toBeNull();
  });

  test('loadGemmaModel downloads then loads when cache is missing', async () => {
    let downloaded = false;
    mockGetCacheStatus.mockImplementation(() => (downloaded ? cacheComplete() : cacheMissing()));
    mockDownload.mockImplementation(async () => {
      downloaded = true;
      return 'file://cache/gemma_models/gemma-4-E2B-it.litertlm';
    });
    await manager.loadGemmaModel('e2b');
    expect(mockDownload).toHaveBeenCalled();
    expect(mockLoadModel).toHaveBeenCalled();
    expect(manager.getGemmaModelState().loadedVariant).toBe('e2b');
  });

  test('unloadGemmaModel clears loaded state but keeps disk cache', async () => {
    mockGetCacheStatus.mockReturnValue(cacheComplete());
    await manager.loadCachedGemmaModel('e2b');
    await manager.unloadGemmaModel();
    expect(mockClose).toHaveBeenCalled();
    const state = manager.getGemmaModelState();
    expect(state.isReady).toBe(false);
    expect(state.loadedVariant).toBeNull();
  });

  test('deleteCachedGemmaModel only unloads when deleting the loaded variant', async () => {
    mockGetCacheStatus.mockReturnValue(cacheComplete());
    await manager.loadCachedGemmaModel('e2b');
    mockClose.mockClear();
    await manager.deleteCachedGemmaModel('gemma3n-e2b');
    expect(mockClose).not.toHaveBeenCalled();
    expect(manager.getGemmaModelState().loadedVariant).toBe('e2b');
  });
});
