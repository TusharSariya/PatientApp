import { Platform } from 'react-native';

import {
  assessModelCompatibility,
  filterVisibleModels,
  pickDefaultSupportedVariant,
} from '../src/gemma/deviceModelCompatibility';
import { MODEL_CATALOG_ORDER, ON_DEVICE_MODELS } from '../src/gemma/gemmaConfig';

jest.mock('react-native-litert-lm', () => ({
  checkBackendSupport: jest.fn(() => null),
  checkMultimodalSupport: jest.fn(() => null),
}));

const litert = require('react-native-litert-lm');

const gb = (n) => n * 1024 * 1024 * 1024;

describe('deviceModelCompatibility', () => {
  const originalOs = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOs });
    litert.checkBackendSupport.mockReturnValue(null);
    litert.checkMultimodalSupport.mockReturnValue(null);
  });

  test('assessModelCompatibility marks low RAM models unsupported', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const e4b = ON_DEVICE_MODELS.e4b;
    const result = assessModelCompatibility(e4b, { totalMemoryBytes: gb(4) });
    expect(result.supported).toBe(false);
    expect(result.meetsMinRam).toBe(false);
    expect(result.reasons[0]).toContain('6 GB+');
  });

  test('assessModelCompatibility allows models when RAM is sufficient', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const e2b = ON_DEVICE_MODELS.e2b;
    const result = assessModelCompatibility(e2b, { totalMemoryBytes: gb(8) });
    expect(result.supported).toBe(true);
    expect(result.meetsMinRam).toBe(true);
  });

  test('assessModelCompatibility does not block on RAM when unknown', () => {
    const e4b = ON_DEVICE_MODELS.e4b;
    const result = assessModelCompatibility(e4b, {});
    expect(result.meetsMinRam).toBe(true);
    expect(result.ramKnown).toBe(false);
  });

  test('assessModelCompatibility blocks iOS entitlement models without entitlement', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    const e2b = ON_DEVICE_MODELS.e2b;
    const result = assessModelCompatibility(e2b, { totalMemoryBytes: gb(8) });
    expect(result.supported).toBe(false);
    expect(result.iosBlocked).toBe(true);
  });

  test('filterVisibleModels hides unsupported models in production mode', () => {
    const profile = { totalMemoryBytes: gb(4) };
    const visible = filterVisibleModels(MODEL_CATALOG_ORDER, profile, {}, { devMode: false });
    const ids = visible.map((entry) => entry.model.id);
    expect(ids).not.toContain('e4b');
    expect(ids).toContain('gemma3n-e2b');
  });

  test('filterVisibleModels keeps cached incompatible models visible', () => {
    const profile = { totalMemoryBytes: gb(4) };
    const cacheByModel = {
      e4b: { isComplete: true, isPartial: false },
    };
    const visible = filterVisibleModels(MODEL_CATALOG_ORDER, profile, cacheByModel, { devMode: false });
    expect(visible.some((entry) => entry.model.id === 'e4b')).toBe(true);
  });

  test('filterVisibleModels shows unsupported models in dev mode', () => {
    const profile = { totalMemoryBytes: gb(4) };
    const visible = filterVisibleModels(MODEL_CATALOG_ORDER, profile, {}, { devMode: true });
    const e4bEntry = visible.find((entry) => entry.model.id === 'e4b');
    expect(e4bEntry).toBeTruthy();
    expect(e4bEntry.devOnly).toBe(true);
  });

  test('ignores Android JVM heap when physical RAM is available', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const e2b = ON_DEVICE_MODELS.e2b;
    const result = assessModelCompatibility(e2b, {
      totalMemoryBytes: gb(8),
      maxHeapBytes: 512 * 1024 * 1024,
    });
    expect(result.supported).toBe(true);
    expect(result.deviceRamGb).toBe('8.0');
  });

  test('pickDefaultSupportedVariant prefers first supported visible model', () => {
    const profile = { totalMemoryBytes: gb(8) };
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const variant = pickDefaultSupportedVariant(MODEL_CATALOG_ORDER, profile, {}, { devMode: false });
    expect(variant).toBe('gemma3n-e2b');
  });
});
