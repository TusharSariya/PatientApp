import { Platform } from 'react-native';
import {
  checkBackendSupport,
  checkMultimodalSupport,
} from 'react-native-litert-lm';

import {
  getDefaultGemmaBackend,
  getDefaultGemmaVariant,
  isGemmaIosExtendedAddressingEnabled,
} from './gemmaConfig';

function readExpoDevice() {
  try {
    return require('expo-device');
  } catch {
    return null;
  }
}

function formatRamGb(bytes) {
  if (!bytes) return null;
  return (bytes / (1024 ** 3)).toFixed(1);
}

function pickEffectiveRamBytes(profile) {
  if (!profile) return null;
  // Native on-device models use physical RAM, not the Android JVM heap cap.
  if (typeof profile.totalMemoryBytes === 'number' && profile.totalMemoryBytes > 0) {
    return profile.totalMemoryBytes;
  }
  if (typeof profile.availableMemoryBytes === 'number' && profile.availableMemoryBytes > 0) {
    return profile.availableMemoryBytes;
  }
  return null;
}

export async function getDeviceMemoryProfile(memoryUsageFromLlm = null) {
  const Device = readExpoDevice();
  const availableMemoryBytes = memoryUsageFromLlm?.availableMemoryBytes ?? null;
  const totalMemoryBytes = Device?.totalMemory ?? null;

  const effectiveRamBytes = pickEffectiveRamBytes({
    availableMemoryBytes,
    totalMemoryBytes,
  });

  return {
    availableMemoryBytes,
    totalMemoryBytes,
    effectiveRamBytes,
    effectiveRamGb: formatRamGb(effectiveRamBytes),
    totalRamGb: formatRamGb(totalMemoryBytes),
    isLowMemory: memoryUsageFromLlm?.isLowMemory ?? false,
    ramKnown: effectiveRamBytes != null,
  };
}

export function assessModelCompatibility(model, profile) {
  const reasons = [];
  const effectiveRamBytes = pickEffectiveRamBytes(profile);
  const ramKnown = effectiveRamBytes != null;
  const meetsMinRam = !ramKnown || effectiveRamBytes >= model.minRamBytes;
  const iosBlocked = Platform.OS === 'ios'
    && model.iosRequiresEntitlement
    && !isGemmaIosExtendedAddressingEnabled();
  const backendWarning = checkBackendSupport(getDefaultGemmaBackend(model.id)) ?? null;
  const multimodalWarning = model.multimodal ? (checkMultimodalSupport() ?? null) : null;

  if (ramKnown && !meetsMinRam) {
    reasons.push(`Needs ${model.minRamLabel} RAM (device reports ${formatRamGb(effectiveRamBytes)} GB)`);
  }
  if (iosBlocked) {
    reasons.push('Needs iOS extended virtual addressing entitlement');
  }
  if (backendWarning) {
    reasons.push(backendWarning);
  }
  if (multimodalWarning) {
    reasons.push(multimodalWarning);
  }

  return {
    modelId: model.id,
    supported: reasons.length === 0,
    reasons,
    meetsMinRam,
    iosBlocked,
    backendWarning,
    multimodalWarning,
    deviceRamGb: formatRamGb(effectiveRamBytes),
    ramKnown,
  };
}

function modelHasCache(cacheByModelId, modelId) {
  const cache = cacheByModelId?.[modelId];
  return Boolean(cache?.isComplete || cache?.isPartial);
}

export function filterVisibleModels(models, profile, cacheByModelId, { devMode = __DEV__ } = {}) {
  return models
    .map((model) => {
      const compatibility = assessModelCompatibility(model, profile);
      const cached = modelHasCache(cacheByModelId, model.id);
      const visible = compatibility.supported || cached || (devMode && !cached);
      return {
        model,
        compatibility,
        cached,
        visible,
        devOnly: devMode && !compatibility.supported && !cached,
      };
    })
    .filter((entry) => entry.visible);
}

export function pickDefaultSupportedVariant(models, profile, cacheByModelId, { devMode = __DEV__ } = {}) {
  const visible = filterVisibleModels(models, profile, cacheByModelId, { devMode });
  const supported = visible.find((entry) => entry.compatibility.supported);
  if (supported) return supported.model.id;
  if (visible.length) return visible[0].model.id;
  return getDefaultGemmaVariant();
}

export function isVariantVisible(variant, models, profile, cacheByModelId, options) {
  const visible = filterVisibleModels(models, profile, cacheByModelId, options);
  return visible.some((entry) => entry.model.id === variant);
}
