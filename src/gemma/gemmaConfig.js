import { Platform } from 'react-native';
import { GEMMA_4_E2B_IT, GEMMA_4_E4B_IT } from 'react-native-litert-lm';

export const GEMMA_VARIANTS = {
  e2b: {
    id: 'e2b',
    label: 'Gemma 4 E2B',
    url: GEMMA_4_E2B_IT,
    sizeLabel: '~2.6 GB',
    minRamBytes: 4 * 1024 * 1024 * 1024,
  },
  e4b: {
    id: 'e4b',
    label: 'Gemma 4 E4B',
    url: GEMMA_4_E4B_IT,
    sizeLabel: '~3.7 GB',
    minRamBytes: 6 * 1024 * 1024 * 1024,
  },
};

export const MAX_VISIT_RECORDING_SECONDS = 300;

export function normalizeGemmaVariant(value) {
  return value === 'e4b' ? 'e4b' : 'e2b';
}

export function getGemmaModelUrl(variant) {
  const normalized = normalizeGemmaVariant(variant);
  return GEMMA_VARIANTS[normalized].url;
}

export function getDefaultGemmaBackend() {
  return Platform.OS === 'ios' ? 'gpu' : 'cpu';
}
