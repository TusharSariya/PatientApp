import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getAppSettings, saveAppSettings } from './database';
import {
  filterVisibleModels,
  getDeviceMemoryProfile,
  isVariantVisible,
  pickDefaultSupportedVariant,
} from './gemma/deviceModelCompatibility';
import {
  cancelGemmaDownload,
  deleteCachedGemmaModel,
  downloadGemmaModel,
  getDeviceReadiness,
  getGemmaCacheStatus,
  getGemmaLlm,
  getGemmaModelState,
  loadCachedGemmaModel,
  subscribeGemmaModelManager,
  unloadGemmaModel,
} from './gemma/GemmaModelManager';
import {
  getOnDeviceModel,
  isGemmaIosExtendedAddressingEnabled,
  MODEL_CATALOG_ORDER,
} from './gemma/gemmaConfig';
import OnDeviceModelCard from './gemma/OnDeviceModelCard';
import { flatSection, screenColors, screenContent } from './screenLayout';

const showDevWarnings = __DEV__;

export default function VisitAiSettingsScreen() {
  const [settings, setSettings] = useState({ gemmaModelVariant: 'e2b' });
  const [modelState, setModelState] = useState(getGemmaModelState);
  const [deviceProfile, setDeviceProfile] = useState(null);
  const entitlementEnabled = isGemmaIosExtendedAddressingEnabled();

  const selectedId = settings.gemmaModelVariant;
  const selectedModel = getOnDeviceModel(selectedId);
  const loadedId = modelState.loadedVariant;
  const loadedModel = loadedId ? getOnDeviceModel(loadedId) : null;

  const cacheByModel = useMemo(() => {
    const map = {};
    for (const model of MODEL_CATALOG_ORDER) {
      map[model.id] = getGemmaCacheStatus(model.id);
    }
    return map;
  }, [selectedId, modelState.phase, modelState.operation, modelState.loadedVariant]);

  const visibleModels = useMemo(() => {
    if (!deviceProfile) {
      return MODEL_CATALOG_ORDER.map((model) => ({
        model,
        compatibility: null,
        devOnly: false,
      }));
    }
    return filterVisibleModels(MODEL_CATALOG_ORDER, deviceProfile, cacheByModel, {
      devMode: showDevWarnings,
    });
  }, [deviceProfile, cacheByModel]);

  useEffect(() => subscribeGemmaModelManager(setModelState), []);

  useEffect(() => {
    getAppSettings().then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    getDeviceMemoryProfile(getGemmaLlm()?.getMemoryUsage?.())
      .then((profile) => {
        if (!cancelled) setDeviceProfile(profile);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [modelState.loadedVariant, modelState.isReady]);

  useEffect(() => {
    if (!deviceProfile) return;
    const visible = isVariantVisible(
      selectedId,
      MODEL_CATALOG_ORDER,
      deviceProfile,
      cacheByModel,
      { devMode: showDevWarnings },
    );
    if (visible) return;
    const fallback = pickDefaultSupportedVariant(
      MODEL_CATALOG_ORDER,
      deviceProfile,
      cacheByModel,
      { devMode: showDevWarnings },
    );
    setSettings((current) => ({ ...current, gemmaModelVariant: fallback }));
    saveAppSettings({ gemmaModelVariant: fallback }).catch(() => {});
  }, [deviceProfile, selectedId, cacheByModel]);

  const readiness = getDeviceReadiness(
    getGemmaLlm()?.getMemoryUsage?.(),
    selectedId,
    deviceProfile,
  );
  const selectionMismatch = loadedId && loadedId !== selectedId && modelState.isReady;

  async function handleVariantChange(variant) {
    const next = { ...settings, gemmaModelVariant: variant };
    setSettings(next);
    await saveAppSettings({ gemmaModelVariant: variant });
  }

  async function handleDownload(variant) {
    try {
      await downloadGemmaModel(variant);
    } catch (error) {
      Alert.alert('Model download failed', error?.message ?? 'Could not download the on-device model.');
    }
  }

  async function handleLoad(variant) {
    try {
      await loadCachedGemmaModel(variant);
    } catch (error) {
      Alert.alert('Model load failed', error?.message ?? 'Could not load the on-device model.');
    }
  }

  async function handleUnload() {
    await unloadGemmaModel();
  }

  function handleCancel() {
    cancelGemmaDownload();
  }

  async function handleDelete(variant) {
    const model = getOnDeviceModel(variant);
    Alert.alert(
      'Delete cached model?',
      `This frees about ${model.sizeLabel} of storage. You can download again later over Wi‑Fi.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCachedGemmaModel(variant);
            } catch (error) {
              Alert.alert('Delete failed', error?.message ?? 'Could not delete the cached model.');
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.intro}>
          Visit dictation runs on your phone. Choose a model below — audio and extracted fields stay on-device.
        </Text>
        <Text style={styles.note}>
          Download models over Wi‑Fi. You can cache several models and load one at a time. Visit dictation uses the selected model.
        </Text>
        {selectionMismatch ? (
          <Text style={styles.warning} testID="selection-mismatch-banner">
            {`${loadedModel.label} is loaded; ${selectedModel.label} is selected for visits. Load the selected model before dictation.`}
          </Text>
        ) : null}
        {readiness.multimodalWarning ? (
          <Text style={styles.warning}>{readiness.multimodalWarning}</Text>
        ) : null}
        {readiness.backendWarning ? (
          <Text style={styles.warning}>{readiness.backendWarning}</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>On-device models</Text>
        {deviceProfile?.ramKnown ? (
          <Text style={styles.note} testID="device-ram-banner">
            {`Your device reports ${deviceProfile.totalRamGb ?? deviceProfile.effectiveRamGb} GB RAM. Models that need more are hidden.`}
          </Text>
        ) : null}
        {showDevWarnings && readiness.iosBlocked && !entitlementEnabled ? (
          <Text style={styles.warning} testID="dev-entitlement-banner">
            {`${selectedModel.label} needs the iOS extended virtual addressing entitlement (paid Apple Developer Program). Try Gemma 3n E2B instead, or enable extra.gemmaIosExtendedAddressing in app.json and rebuild.`}
          </Text>
        ) : null}
        {!readiness.meetsMinRam && readiness.availableRamGb && deviceProfile?.ramKnown ? (
          <Text style={styles.warning} testID="ram-warning-banner">
            {`Available RAM (${readiness.availableRamGb} GB) may be below ${selectedModel.label}'s ${selectedModel.minRamLabel} recommendation.`}
          </Text>
        ) : null}
        {visibleModels.map(({ model, compatibility, devOnly }) => (
          <OnDeviceModelCard
            key={model.id}
            model={model}
            selected={selectedId === model.id}
            cacheStatus={cacheByModel[model.id]}
            modelState={modelState}
            entitlementEnabled={entitlementEnabled}
            compatibility={compatibility}
            showDevWarnings={showDevWarnings}
            devOnly={devOnly}
            onPress={() => handleVariantChange(model.id)}
            onDownload={handleDownload}
            onLoad={handleLoad}
            onUnload={handleUnload}
            onCancel={handleCancel}
            onDelete={handleDelete}
            testID={`gemma-variant-${model.id}`}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: screenColors.bg,
  },
  content: screenContent(40),
  section: {
    ...flatSection({ marginBottom: 16, paddingVertical: 12 }),
    paddingHorizontal: 16,
  },
  intro: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  warning: {
    marginTop: 10,
    fontSize: 13,
    color: '#8a5a00',
  },
  note: {
    marginTop: 10,
    fontSize: 13,
    color: '#5f6d8a',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
