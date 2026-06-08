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
} from './gemmaConfig';
import { retryWithBackoff } from './gemmaDownloadPolicy';
import {
  deleteDownloadArtifacts,
  downloadGemmaModelResumable,
  ensureGemmaCacheDirectory,
  getGemmaCacheFileStatus,
} from './gemmaResumableDownload';
import { getExtractVisitTools, VISIT_EXTRACTION_SYSTEM_PROMPT } from '../visitExtraction/visitExtractionPrompt';

let llmInstance = null;
let currentVariant = getDefaultGemmaVariant();
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
  variant: 'e2b',
  multimodalWarning: null,
  backendWarning: null,
};
const listeners = new Set();

function notify() {
  const snapshot = { ...state };
  listeners.forEach((listener) => listener(snapshot));
}

function notifyDownloadProgress(progress) {
  const clamped = Math.max(0, Math.min(1, progress));
  if (
    clamped < 1
    && lastNotifiedDownloadProgress >= 0
    && clamped - lastNotifiedDownloadProgress < MIN_DOWNLOAD_PROGRESS_NOTIFY_DELTA
  ) {
    state.downloadProgress = clamped;
    return;
  }
  lastNotifiedDownloadProgress = clamped;
  state.downloadProgress = clamped;
  state.phase = 'downloading';
  notify();
}

export function subscribeGemmaModelManager(listener) {
  listeners.add(listener);
  listener({ ...state });
  return () => listeners.delete(listener);
}

export function getGemmaModelState() {
  return { ...state };
}

export function getGemmaLlm() {
  return llmInstance;
}

function resetState(partial = {}) {
  if ('downloadProgress' in partial) {
    lastNotifiedDownloadProgress = partial.downloadProgress;
  } else {
    lastNotifiedDownloadProgress = -1;
  }
  const next = {
    phase: 'idle',
    isReady: false,
    isLoading: false,
    downloadProgress: 0,
    attempt: 0,
    maxAttempts: 4,
    cachedOnDisk: false,
    error: null,
    variant: currentVariant,
    multimodalWarning: checkMultimodalSupport() ?? null,
    backendWarning: checkBackendSupport(getDefaultGemmaBackend(currentVariant)) ?? null,
    ...partial,
  };
  if (next.isReady) next.phase = 'ready';
  Object.assign(state, next);
  notify();
}

export function getGemmaCacheStatus(variant = currentVariant) {
  const normalizedVariant = normalizeGemmaVariant(variant);
  const files = getGemmaCacheFiles(normalizedVariant);
  return getGemmaCacheFileStatus({
    ...files,
    expectedBytes: getExpectedBytes(normalizedVariant),
  });
}

function refreshCachedOnDisk(variant = currentVariant) {
  state.cachedOnDisk = getGemmaCacheStatus(variant).isComplete;
}

export function cancelGemmaDownload() {
  downloadAbortController?.abort();
  downloadAbortController = null;
  resetState({
    phase: 'idle',
    variant: currentVariant,
    cachedOnDisk: getGemmaCacheStatus(currentVariant).isComplete,
  });
}

export async function unloadGemmaModel() {
  downloadAbortController?.abort();
  downloadAbortController = null;
  if (llmInstance) {
    try {
      llmInstance.close();
    } catch {
      // ignore cleanup errors
    }
  }
  llmInstance = null;
  const cachedOnDisk = getGemmaCacheStatus(currentVariant).isComplete;
  resetState({ variant: currentVariant, cachedOnDisk, phase: cachedOnDisk ? 'idle' : 'idle' });
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
      state.attempt = attempt;
      state.maxAttempts = maxAttempts;
      notify();
    },
    signal: {
      get aborted() {
        return downloadAbortController?.signal.aborted ?? false;
      },
    },
  });
}

export async function loadGemmaModel(variant = getDefaultGemmaVariant()) {
  const normalizedVariant = normalizeGemmaVariant(variant);
  const model = getOnDeviceModel(normalizedVariant);
  currentVariant = normalizedVariant;

  if (llmInstance?.isReady?.()) {
    if (state.isReady && state.variant === normalizedVariant) {
      return llmInstance;
    }
    await unloadGemmaModel();
  }

  resetState({
    phase: 'downloading',
    isLoading: true,
    variant: normalizedVariant,
    error: null,
    downloadProgress: 0,
    attempt: 0,
    cachedOnDisk: getGemmaCacheStatus(normalizedVariant).isComplete,
  });

  try {
    const backend = getDefaultGemmaBackend(normalizedVariant);
    const llm = createLLM({ enableMemoryTracking: true });
    const cacheStatus = getGemmaCacheStatus(normalizedVariant);
    let localUri = cacheStatus.isComplete
      ? getGemmaCacheFiles(normalizedVariant).finalFile.uri
      : null;

    if (!localUri) {
      localUri = await downloadGemmaModelFile(normalizedVariant, notifyDownloadProgress);
    } else {
      state.downloadProgress = 1;
      notify();
    }

    resetState({
      phase: 'loading',
      isLoading: true,
      variant: normalizedVariant,
      downloadProgress: 1,
      attempt: state.attempt,
      maxAttempts: state.maxAttempts,
      cachedOnDisk: true,
    });

    await llm.loadModel(
      localUri,
      {
        backend,
        multimodal: model.multimodal,
        systemPrompt: VISIT_EXTRACTION_SYSTEM_PROMPT,
        tools: getExtractVisitTools(),
        temperature: 0.2,
        maxTokens: 2048,
      }
    );

    llmInstance = llm;
    downloadAbortController = null;
    resetState({
      phase: 'ready',
      isReady: true,
      isLoading: false,
      variant: normalizedVariant,
      downloadProgress: 1,
      cachedOnDisk: true,
    });
    return llmInstance;
  } catch (error) {
    llmInstance = null;
    downloadAbortController = null;
    refreshCachedOnDisk(normalizedVariant);
    const friendlyError = humanizeGemmaLoadError(error, {
      variantLabel: model.label,
      platform: Platform.OS,
      iosEntitlementEnabled: isGemmaIosExtendedAddressingEnabled(),
      iosRequiresEntitlement: model.iosRequiresEntitlement,
    });
    resetState({
      phase: 'error',
      isLoading: false,
      error: friendlyError,
      variant: normalizedVariant,
      cachedOnDisk: state.cachedOnDisk,
    });
    throw new Error(friendlyError);
  }
}

export async function deleteCachedGemmaModel(variant = currentVariant) {
  await unloadGemmaModel();
  const normalizedVariant = normalizeGemmaVariant(variant);
  const files = getGemmaCacheFiles(normalizedVariant);
  deleteDownloadArtifacts(files);

  const llm = createLLM();
  try {
    await llm.deleteModel(getGemmaModelFileName(normalizedVariant));
  } catch {
    // Model may not exist in native cache.
  }
  resetState({ variant: normalizedVariant, cachedOnDisk: false, phase: 'idle' });
}

export function getDeviceReadiness(memoryUsage, variant = currentVariant) {
  const model = getOnDeviceModel(variant);
  const available = memoryUsage?.availableMemoryBytes ?? 0;
  const lowMemory = memoryUsage?.isLowMemory ?? false;
  const iosRequiresEntitlement = Platform.OS === 'ios' && model.iosRequiresEntitlement;
  return {
    variant: normalizeGemmaVariant(variant),
    lowMemory,
    availableRamGb: available ? (available / (1024 ** 3)).toFixed(1) : null,
    meetsMinRam: !available || available >= model.minRamBytes,
    iosRequiresEntitlement,
    iosNeedsEntitlement: iosRequiresEntitlement,
    multimodalWarning: state.multimodalWarning,
    backendWarning: checkBackendSupport(getDefaultGemmaBackend(variant)) ?? null,
  };
}
