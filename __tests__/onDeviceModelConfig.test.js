import { Platform } from 'react-native';

import {
  getDefaultGemmaVariant,
  MODEL_CATALOG_ORDER,
  normalizeGemmaVariant,
  ON_DEVICE_MODEL_IDS,
  ON_DEVICE_MODELS,
  toNativeFilesystemPath,
} from '../src/gemma/gemmaConfig';

describe('onDeviceModelConfig', () => {
  test('catalog includes six models in display order', () => {
    expect(ON_DEVICE_MODEL_IDS).toHaveLength(6);
    expect(MODEL_CATALOG_ORDER.map((m) => m.id)).toEqual([
      'gemma3n-e2b',
      'gemma3-1b',
      'qwen2.5-1.5b',
      'e2b',
      'phi4-mini',
      'e4b',
    ]);
  });

  test('normalizeGemmaVariant accepts all catalog ids', () => {
    for (const id of ON_DEVICE_MODEL_IDS) {
      expect(normalizeGemmaVariant(id)).toBe(id);
      expect(ON_DEVICE_MODELS[normalizeGemmaVariant(id)].url).toMatch(/^https?:\/\//);
    }
  });

  test('normalizeGemmaVariant falls back to platform default for unknown ids', () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    expect(normalizeGemmaVariant('unknown')).toBe('gemma3n-e2b');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    expect(normalizeGemmaVariant('unknown')).toBe('e2b');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: original });
  });

  test('normalizeGemmaVariant preserves legacy default for empty values', () => {
    expect(normalizeGemmaVariant(null)).toBe('e2b');
    expect(normalizeGemmaVariant(undefined)).toBe('e2b');
  });

  test('getDefaultGemmaVariant prefers gemma3n on iOS without entitlement', () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    expect(getDefaultGemmaVariant()).toBe('gemma3n-e2b');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: original });
  });

  test('gemma3n is iOS friendly without entitlement', () => {
    expect(ON_DEVICE_MODELS['gemma3n-e2b'].iosRequiresEntitlement).toBe(false);
    expect(ON_DEVICE_MODELS['gemma3n-e2b'].supportsNativeAudio).toBe(true);
  });

  test('text-only models do not support native audio', () => {
    expect(ON_DEVICE_MODELS['gemma3-1b'].supportsNativeAudio).toBe(false);
    expect(ON_DEVICE_MODELS['qwen2.5-1.5b'].supportsNativeAudio).toBe(false);
    expect(ON_DEVICE_MODELS['phi4-mini'].supportsNativeAudio).toBe(false);
  });

  test('toNativeFilesystemPath strips file URI scheme for native loadModel', () => {
    expect(toNativeFilesystemPath('file:///data/user/0/cache/model.litertlm'))
      .toBe('/data/user/0/cache/model.litertlm');
    expect(toNativeFilesystemPath('/data/user/0/cache/model.litertlm'))
      .toBe('/data/user/0/cache/model.litertlm');
  });
});
