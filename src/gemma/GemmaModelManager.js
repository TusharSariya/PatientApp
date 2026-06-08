import { Platform } from 'react-native';

import { humanizeGemmaLoadError } from './gemmaLoadErrors';
import {
  checkBackendSupport,
  checkMultimodalSupport,
  createLLM,
} from 'react-native-litert-lm';

import {
  getDefaultGemmaBackend,
  getDefaultGemmaVariant,
  getExpectedBytes,
  getGemmaCacheFiles,
  getGemmaModelFileName,
  getGemmaModelUrl,
  getOnDeviceModel,
  isGemmaIosExtendedAddressingEnabled,
  normalizeGemmaVariant,
  toNativeFilesystemPath,
} from './gemmaConfig';
import { retryWithBackoff } from './gemmaDownloadPolicy';
import {
  deleteDownloadArtifacts,
  downloadGemmaModelResumable,
  ensureGemmaCacheDirectory,
  getGemmaCacheFileStatus,
} from './gemmaResumableDownload';
import { assessModelCompatibility } from './deviceModelCompatibility';
import { buildVisitExtractionLoadConfig } from '../visitExtraction/visitExtractionPrompt';

let llmInstance = null;
let loadedVariant = null;
let downloadAbortController = null;
let lastNotifiedDownloadProgress = -1;

const MIN_DOWNLOAD_PROGRESS_NOTIFY_DELTA = 0.005;

const state = {
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
  multimodalWarning: checkMultimodalSupport() ?? null,
  backendWarning: null,
};
const listeners = new Set();

function syncDerivedState() {
  const op = state.operation;
  if (op?.type === 'download') {
    state.phase = op.error ? 'error' : 'downloading';
    state.isLoading = true;
    state.downloadProgress = op.progress ?? 0;
    state.attempt = op.attempt ?? 0;
    state.maxAttempts = op.maxAttempts ?? 4;
    state.error = op.error ?? null;
  } else if (op?.type === 'load') {
    state.phase = op.error ? 'error' : 'loading';
    state.isLoading = true;
    state.downloadProgress = 1;
    state.error = op.error ?? null;
  } else if (state.isReady && state.loadedVariant) {
    state.phase = 'ready';
    state.isLoading = false;
    state.error = null;
  } else {
    state.phase = 'idle';
    state.isLoading = false;
    if (!op) state.error = null;
  }
  state.loadedVariant = loadedVariant;
  state.variant = loadedVariant;
  state.cachedOnDisk = loadedVariant
    ? getGemmaCacheStatus(loadedVariant).isComplete
    : false;
}

function notify() {
  syncDerivedState();
  const snapshot = { ...state, operation: state.operation ? { ...state.operation } : null };
  listeners.forEach((listener) => listener(snapshot));
}

function setOperation(operation) {
  state.operation = operation;
  notify();
}

function clearOperation() {
  state.operation = null;
  notify();
}

function notifyDownloadProgress(progress) {
  const clamped = Math.max(0, Math.min(1, progress));
  if (
    clamped < 1
    && lastNotifiedDownloadProgress >= 0
    && clamped - lastNotifiedDownloadProgress < MIN_DOWNLOAD_PROGRESS_NOTIFY_DELTA
  ) {
    if (state.operation?.type === 'download') {
      state.operation.progress = clamped;
    }
    return;
  }
  lastNotifiedDownloadProgress = clamped;
  if (state.operation?.type === 'download') {
    state.operation.progress = clamped;
    notify();
  }
}

export function subscribeGemmaModelManager(listener) {
  listeners.add(listener);
  syncDerivedState();
  listener({ ...state, operation: state.operation ? { ...state.operation } : null });
  return () => listeners.delete(listener);
}

export function getGemmaModelState() {
  syncDerivedState();
  return { ...state, operation: state.operation ? { ...state.operation } : null };
}

export function getGemmaLlm() {
  return llmInstance;
}

export function getGemmaCacheStatus(variant = loadedVariant ?? getDefaultGemmaVariant()) {
  const normalizedVariant = normalizeGemmaVariant(variant);
  const files = getGemmaCacheFiles(normalizedVariant);
  return getGemmaCacheFileStatus({
    ...files,
    expectedBytes: getExpectedBytes(normalizedVariant),
  });
}

function assertNoConflictingOperation(variant, allowedType) {
  const op = state.operation;
  if (!op) return;
  if (op.variant === variant && op.type === allowedType) return;
  throw new Error('Another model operation is already in progress.');
}

export function cancelGemmaDownload() {
  if (state.operation?.type !== 'download') return;
  downloadAbortController?.abort();
  downloadAbortController = null;
  lastNotifiedDownloadProgress = -1;
  clearOperation();
}

export async function unloadGemmaModel() {
  if (llmInstance) {
    try {
      llmInstance.close();
    } catch {
      // ignore cleanup errors
    }
  }
  llmInstance = null;
  loadedVariant = null;
  state.isReady = false;
  clearOperation();
}

async function downloadGemmaModelFile(variant, onProgress) {
  const normalizedVariant = normalizeGemmaVariant(variant);
  const url = getGemmaModelUrl(normalizedVariant);
  const expectedBytes = getExpectedBytes(normalizedVariant);
  const files = getGemmaCacheFiles(normalizedVariant);
  ensureGemmaCacheDirectory();

  return retryWithBackoff(async () => {
    const controller = new AbortController();
    downloadAbortController = controller;
    return downloadGemmaModelResumable({
      url,
      ...files,
      expectedBytes,
      onProgress,
      signal: controller.signal,
    });
  }, {
    onAttempt: (attempt, maxAttempts) => {
      if (state.operation?.type === 'download') {
        state.operation.attempt = attempt;
        state.operation.maxAttempts = maxAttempts;
        notify();
      }
    },
    signal: {
      get aborted() {
        return downloadAbortController?.signal.aborted ?? false;
      },
    },
  });
}

export async function downloadGemmaModel(variant = getDefaultGemmaVariant()) {
  const normalizedVariant = normalizeGemmaVariant(variant);
  const model = getOnDeviceModel(normalizedVariant);
  const cacheStatus = getGemmaCacheStatus(normalizedVariant);

  if (cacheStatus.isComplete) {
    return getGemmaCacheFiles(normalizedVariant).finalFile.uri;
  }

  assertNoConflictingOperation(normalizedVariant, 'download');

  lastNotifiedDownloadProgress = -1;
  setOperation({
    type: 'download',
    variant: normalizedVariant,
    progress: cacheStatus.isPartial && cacheStatus.expectedBytes
      ? cacheStatus.bytes / cacheStatus.expectedBytes
      : 0,
    attempt: 0,
    maxAttempts: 4,
    error: null,
  });

  try {
    const localUri = await downloadGemmaModelFile(normalizedVariant, notifyDownloadProgress);
    downloadAbortController = null;
    lastNotifiedDownloadProgress = -1;
    clearOperation();
    return localUri;
  } catch (error) {
    downloadAbortController = null;
    lastNotifiedDownloadProgress = -1;
    const friendlyError = humanizeGemmaLoadError(error, {
      variantLabel: model.label,
      platform: Platform.OS,
      iosEntitlementEnabled: isGemmaIosExtendedAddressingEnabled(),
      iosRequiresEntitlement: model.iosRequiresEntitlement,
    });
    setOperation({
      type: 'download',
      variant: normalizedVariant,
      progress: state.operation?.progress ?? 0,
      attempt: state.operation?.attempt ?? 0,
      maxAttempts: state.operation?.maxAttempts ?? 4,
      error: friendlyError,
    });
    throw new Error(friendlyError);
  }
}

export async function loadCachedGemmaModel(variant = getDefaultGemmaVariant()) {
  const normalizedVariant = normalizeGemmaVariant(variant);
  const model = getOnDeviceModel(normalizedVariant);
  const cacheStatus = getGemmaCacheStatus(normalizedVariant);

  if (!cacheStatus.isComplete) {
    throw new Error('Model is not downloaded yet. Download it first.');
  }

  if (llmInstance?.isReady?.() && loadedVariant === normalizedVariant) {
    state.isReady = true;
    notify();
    return llmInstance;
  }

  assertNoConflictingOperation(normalizedVariant, 'load');

  setOperation({
    type: 'load',
    variant: normalizedVariant,
    error: null,
  });

  try {
    if (llmInstance) {
      try {
        llmInstance.close();
      } catch {
        // ignore cleanup errors
      }
      llmInstance = null;
      loadedVariant = null;
      state.isReady = false;
    }

    const backend = getDefaultGemmaBackend(normalizedVariant);
    const localUri = getGemmaCacheFiles(normalizedVariant).finalFile.uri;
    const llm = createLLM({ enableMemoryTracking: true });
    const modelPath = toNativeFilesystemPath(localUri);
    const loadConfig = buildVisitExtractionLoadConfig({
      backend,
      multimodal: model.multimodal,
      platform: Platform.OS,
    });
    await llm.loadModel(modelPath, loadConfig);

    llmInstance = llm;
    loadedVariant = normalizedVariant;
    state.isReady = true;
    clearOperation();
    return llmInstance;
  } catch (error) {
    llmInstance = null;
    loadedVariant = null;
    state.isReady = false;
    const friendlyError = humanizeGemmaLoadError(error, {
      variantLabel: model.label,
      platform: Platform.OS,
      iosEntitlementEnabled: isGemmaIosExtendedAddressingEnabled(),
      iosRequiresEntitlement: model.iosRequiresEntitlement,
    });
    setOperation({
      type: 'load',
      variant: normalizedVariant,
      error: friendlyError,
    });
    throw new Error(friendlyError);
  }
}

export async function loadGemmaModel(variant = getDefaultGemmaVariant()) {
  const normalizedVariant = normalizeGemmaVariant(variant);

  if (llmInstance?.isReady?.() && loadedVariant === normalizedVariant) {
    state.isReady = true;
    notify();
    return llmInstance;
  }

  if (!getGemmaCacheStatus(normalizedVariant).isComplete) {
    await downloadGemmaModel(normalizedVariant);
  }
  return loadCachedGemmaModel(normalizedVariant);
}

export async function deleteCachedGemmaModel(variant) {
  const normalizedVariant = normalizeGemmaVariant(variant);

  if (state.operation?.variant === normalizedVariant) {
    if (state.operation.type === 'download') {
      cancelGemmaDownload();
    } else {
      throw new Error('Cannot delete while the model is loading.');
    }
  }

  if (loadedVariant === normalizedVariant) {
    await unloadGemmaModel();
  }

  const files = getGemmaCacheFiles(normalizedVariant);
  deleteDownloadArtifacts(files);

  const llm = createLLM();
  try {
    await llm.deleteModel(getGemmaModelFileName(normalizedVariant));
  } catch {
    // Model may not exist in native cache.
  }
  notify();
}

export function getDeviceReadiness(
  memoryUsage,
  variant = loadedVariant ?? getDefaultGemmaVariant(),
  deviceProfile = null,
) {
  const model = getOnDeviceModel(variant);
  const profile = deviceProfile ?? {
    availableMemoryBytes: memoryUsage?.availableMemoryBytes ?? null,
    totalMemoryBytes: null,
    maxHeapBytes: null,
    isLowMemory: memoryUsage?.isLowMemory ?? false,
  };
  const compatibility = assessModelCompatibility(model, profile);
  const iosRequiresEntitlement = Platform.OS === 'ios' && model.iosRequiresEntitlement;
  return {
    variant: normalizeGemmaVariant(variant),
    lowMemory: profile.isLowMemory ?? memoryUsage?.isLowMemory ?? false,
    availableRamGb: compatibility.deviceRamGb,
    meetsMinRam: compatibility.meetsMinRam,
    iosRequiresEntitlement,
    iosNeedsEntitlement: iosRequiresEntitlement,
    iosBlocked: compatibility.iosBlocked,
    supported: compatibility.supported,
    ramKnown: compatibility.ramKnown,
    incompatibilityReasons: compatibility.reasons,
    multimodalWarning: compatibility.multimodalWarning ?? state.multimodalWarning,
    backendWarning: compatibility.backendWarning,
  };
}
