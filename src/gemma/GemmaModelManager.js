import { Platform } from 'react-native';
import {
  checkBackendSupport,
  checkMultimodalSupport,
  createLLM,
} from 'react-native-litert-lm';

import {
  GEMMA_VARIANTS,
  getDefaultGemmaBackend,
  getGemmaModelUrl,
  normalizeGemmaVariant,
} from './gemmaConfig';
import { getExtractVisitTools, VISIT_EXTRACTION_SYSTEM_PROMPT } from '../visitExtraction/visitExtractionPrompt';

let llmInstance = null;
let currentVariant = 'e2b';
const state = {
  isReady: false,
  isLoading: false,
  downloadProgress: 0,
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
  Object.assign(state, {
    isReady: false,
    isLoading: false,
    downloadProgress: 0,
    error: null,
    multimodalWarning: checkMultimodalSupport() ?? null,
    backendWarning: checkBackendSupport(getDefaultGemmaBackend()) ?? null,
    ...partial,
  });
  notify();
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
  resetState({ variant: currentVariant });
}

export async function loadGemmaModel(variant = 'e2b') {
  const normalizedVariant = normalizeGemmaVariant(variant);
  currentVariant = normalizedVariant;

  if (llmInstance?.isReady?.()) {
    if (state.isReady && state.variant === normalizedVariant) {
      return llmInstance;
    }
    await unloadGemmaModel();
  }

  resetState({
    isLoading: true,
    variant: normalizedVariant,
    error: null,
    downloadProgress: 0,
  });

  try {
    const backend = getDefaultGemmaBackend();
    const llm = createLLM({ enableMemoryTracking: true });
    await llm.loadModel(
      getGemmaModelUrl(normalizedVariant),
      {
        backend,
        multimodal: true,
        systemPrompt: VISIT_EXTRACTION_SYSTEM_PROMPT,
        tools: getExtractVisitTools(),
        temperature: 0.2,
        maxTokens: 2048,
      },
      (progress) => {
        state.downloadProgress = progress;
        notify();
      }
    );
    llmInstance = llm;
    resetState({
      isReady: true,
      isLoading: false,
      variant: normalizedVariant,
      downloadProgress: 1,
    });
    return llmInstance;
  } catch (error) {
    llmInstance = null;
    resetState({
      isLoading: false,
      error: error?.message ?? 'Failed to load on-device model.',
      variant: normalizedVariant,
    });
    throw error;
  }
}

export async function deleteCachedGemmaModel(variant = currentVariant) {
  await unloadGemmaModel();
  const llm = createLLM();
  const fileName = `${normalizeGemmaVariant(variant)}.litertlm`;
  try {
    await llm.deleteModel(fileName);
  } catch {
    // Model may not exist yet.
  }
  resetState({ variant: normalizeGemmaVariant(variant) });
}

export function getDeviceReadiness(memoryUsage) {
  const variant = GEMMA_VARIANTS[normalizeGemmaVariant(currentVariant)];
  const available = memoryUsage?.availableMemoryBytes ?? 0;
  const lowMemory = memoryUsage?.isLowMemory ?? false;
  const iosNeedsEntitlement = Platform.OS === 'ios';
  return {
    variant: currentVariant,
    lowMemory,
    availableRamGb: available ? (available / (1024 ** 3)).toFixed(1) : null,
    meetsMinRam: available >= variant.minRamBytes,
    iosNeedsEntitlement,
    multimodalWarning: state.multimodalWarning,
    backendWarning: state.backendWarning,
  };
}
