import { Platform } from 'react-native';
import { File, Paths, Directory } from 'expo-file-system';
import {
  GEMMA_3N_E2B_IT_INT4,
  GEMMA_4_E2B_IT,
  GEMMA_4_E4B_IT,
} from 'react-native-litert-lm';

const GEMMA_CACHE_DIR = 'gemma_models';

const GEMMA3_1B_LITERTLM =
  'https://huggingface.co/litert-community/Gemma3-1B-IT/resolve/main/Gemma3-1B-IT_multi-prefill-seq_q4_ekv4096.litertlm';

const QWEN2_5_1_5B_LITERTLM =
  'https://huggingface.co/litert-community/Qwen2.5-1.5B-Instruct/resolve/main/Qwen2.5-1.5B-Instruct_multi-prefill-seq_q8_ekv4096.litertlm';

const PHI4_MINI_LITERTLM =
  'https://huggingface.co/litert-community/Phi-4-mini-instruct/resolve/main/Phi-4-mini-instruct_multi-prefill-seq_q8_ekv4096.litertlm';

export const ON_DEVICE_MODEL_IDS = [
  'gemma3n-e2b',
  'gemma3-1b',
  'qwen2.5-1.5b',
  'e2b',
  'phi4-mini',
  'e4b',
];

export const ON_DEVICE_MODELS = {
  'gemma3n-e2b': {
    id: 'gemma3n-e2b',
    label: 'Gemma 3n E2B',
    family: 'gemma3n',
    url: GEMMA_3N_E2B_IT_INT4,
    fileName: 'gemma-3n-E2B-it-int4.litertlm',
    sizeLabel: '~1.3 GB',
    expectedBytes: 1_400_000_000,
    minRamBytes: 4 * 1024 * 1024 * 1024,
    minRamLabel: '4 GB+',
    badge: 'iOS friendly',
    description: 'Smallest multimodal Gemma; works without paid iOS entitlement.',
    iosRequiresEntitlement: false,
    huggingFaceLicenseRequired: false,
    supportsNativeAudio: true,
    multimodal: true,
    displayOrder: 1,
  },
  'gemma3-1b': {
    id: 'gemma3-1b',
    label: 'Gemma 3 1B',
    family: 'gemma3',
    url: GEMMA3_1B_LITERTLM,
    fileName: 'Gemma3-1B-IT_multi-prefill-seq_q4_ekv4096.litertlm',
    sizeLabel: '~1 GB',
    expectedBytes: 1_100_000_000,
    minRamBytes: 4 * 1024 * 1024 * 1024,
    minRamLabel: '4 GB+',
    badge: 'Smallest',
    description: 'Fastest text model; uses system speech for dictation.',
    iosRequiresEntitlement: false,
    huggingFaceLicenseRequired: true,
    supportsNativeAudio: false,
    multimodal: false,
    displayOrder: 2,
  },
  'qwen2.5-1.5b': {
    id: 'qwen2.5-1.5b',
    label: 'Qwen 2.5 1.5B',
    family: 'qwen',
    url: QWEN2_5_1_5B_LITERTLM,
    fileName: 'Qwen2.5-1.5B-Instruct_multi-prefill-seq_q8_ekv4096.litertlm',
    sizeLabel: '~1.5 GB',
    expectedBytes: 1_600_000_000,
    minRamBytes: 4 * 1024 * 1024 * 1024,
    minRamLabel: '4 GB+',
    badge: 'Multilingual',
    description: 'Text extraction with system speech transcript.',
    iosRequiresEntitlement: false,
    huggingFaceLicenseRequired: false,
    supportsNativeAudio: false,
    multimodal: false,
    displayOrder: 3,
  },
  e2b: {
    id: 'e2b',
    label: 'Gemma 4 E2B',
    family: 'gemma4',
    url: GEMMA_4_E2B_IT,
    fileName: 'gemma-4-E2B-it.litertlm',
    sizeLabel: '~2.6 GB',
    expectedBytes: 2_800_000_000,
    minRamBytes: 4 * 1024 * 1024 * 1024,
    minRamLabel: '4 GB+',
    badge: 'Native audio',
    description: 'Best quality-to-size multimodal Gemma for visit dictation.',
    iosRequiresEntitlement: true,
    huggingFaceLicenseRequired: false,
    supportsNativeAudio: true,
    multimodal: true,
    displayOrder: 4,
  },
  'phi4-mini': {
    id: 'phi4-mini',
    label: 'Phi-4 Mini',
    family: 'phi',
    url: PHI4_MINI_LITERTLM,
    fileName: 'Phi-4-mini-instruct_multi-prefill-seq_q8_ekv4096.litertlm',
    sizeLabel: '~2 GB',
    expectedBytes: 2_200_000_000,
    minRamBytes: 4 * 1024 * 1024 * 1024,
    minRamLabel: '4 GB+',
    badge: 'Text only',
    description: 'Microsoft small LLM; system speech for dictation.',
    iosRequiresEntitlement: true,
    huggingFaceLicenseRequired: false,
    supportsNativeAudio: false,
    multimodal: false,
    displayOrder: 5,
  },
  e4b: {
    id: 'e4b',
    label: 'Gemma 4 E4B',
    family: 'gemma4',
    url: GEMMA_4_E4B_IT,
    fileName: 'gemma-4-E4B-it.litertlm',
    sizeLabel: '~3.7 GB',
    expectedBytes: 4_000_000_000,
    minRamBytes: 6 * 1024 * 1024 * 1024,
    minRamLabel: '6 GB+',
    badge: 'Best quality',
    description: 'Highest quality; needs strong Wi‑Fi and 6 GB+ RAM.',
    iosRequiresEntitlement: true,
    huggingFaceLicenseRequired: false,
    supportsNativeAudio: true,
    multimodal: true,
    displayOrder: 6,
  },
};

/** @deprecated Use ON_DEVICE_MODELS */
export const GEMMA_VARIANTS = ON_DEVICE_MODELS;

export const MODEL_CATALOG_ORDER = Object.values(ON_DEVICE_MODELS)
  .sort((a, b) => a.displayOrder - b.displayOrder);

export const MAX_VISIT_RECORDING_SECONDS = 300;

function getExpoExtra() {
  try {
    return require('expo-constants').default?.expoConfig?.extra ?? {};
  } catch {
    return {};
  }
}

export function isGemmaIosExtendedAddressingEnabled() {
  return getExpoExtra().gemmaIosExtendedAddressing === true;
}

export function getDefaultGemmaVariant() {
  if (Platform.OS === 'ios' && !isGemmaIosExtendedAddressingEnabled()) {
    return 'gemma3n-e2b';
  }
  return 'e2b';
}

export function normalizeGemmaVariant(value) {
  if (value && ON_DEVICE_MODELS[value]) {
    return value;
  }
  if (value == null || value === '') {
    return 'e2b';
  }
  return getDefaultGemmaVariant();
}

export function getOnDeviceModel(variant) {
  return ON_DEVICE_MODELS[normalizeGemmaVariant(variant)];
}

export function getGemmaModelUrl(variant) {
  return getOnDeviceModel(variant).url;
}

export function getGemmaModelFileName(variant) {
  return getOnDeviceModel(variant).fileName;
}

export function getExpectedBytes(variant) {
  return getOnDeviceModel(variant).expectedBytes;
}

export function getGemmaCacheDirectory() {
  return new Directory(Paths.cache, GEMMA_CACHE_DIR);
}

/** Native LiteRT expects a plain filesystem path, not an expo `file://` URI. */
export function toNativeFilesystemPath(fileUri) {
  if (!fileUri || typeof fileUri !== 'string') return fileUri;
  if (fileUri.startsWith('file://')) {
    return decodeURIComponent(fileUri.replace(/^file:\/\//, ''));
  }
  return fileUri;
}

export function getGemmaCacheFiles(variant) {
  const fileName = getGemmaModelFileName(variant);
  const dir = getGemmaCacheDirectory();
  return {
    finalFile: new File(dir, fileName),
    partFile: new File(dir, `${fileName}.part`),
    sidecarFile: new File(dir, `${fileName}.download.json`),
  };
}

export function getDefaultGemmaBackend(variant) {
  const model = getOnDeviceModel(variant);
  if (Platform.OS === 'android') {
    return 'cpu';
  }
  return model.multimodal ? 'gpu' : 'cpu';
}

export function modelSupportsNativeAudio(variant) {
  return getOnDeviceModel(variant).supportsNativeAudio;
}
