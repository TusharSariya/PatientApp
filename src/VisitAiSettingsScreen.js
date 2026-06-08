import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getAppSettings, saveAppSettings } from './database';
import {
  cancelGemmaDownload,
  deleteCachedGemmaModel,
  getDeviceReadiness,
  getGemmaCacheStatus,
  getGemmaLlm,
  getGemmaModelState,
  loadGemmaModel,
  subscribeGemmaModelManager,
  unloadGemmaModel,
} from './gemma/GemmaModelManager';
import {
  getOnDeviceModel,
  isGemmaIosExtendedAddressingEnabled,
  MODEL_CATALOG_ORDER,
} from './gemma/gemmaConfig';
import OnDeviceModelCard, { getModelCardStatus } from './gemma/OnDeviceModelCard';
import { flatSection, screenColors, screenContent } from './screenLayout';

function getPrimaryActionLabel(modelState, cacheStatus) {
  if (modelState.isLoading) return null;
  if (modelState.isReady) return 'Reload model';
  if (cacheStatus.isPartial || (modelState.phase === 'error' && cacheStatus.exists)) {
    return 'Resume download';
  }
  if (cacheStatus.isComplete) return 'Load model';
  return 'Download model';
}

export default function VisitAiSettingsScreen() {
  const [settings, setSettings] = useState({ gemmaModelVariant: 'e2b' });
  const [modelState, setModelState] = useState(getGemmaModelState);
  const entitlementEnabled = isGemmaIosExtendedAddressingEnabled();

  const selectedId = settings.gemmaModelVariant;
  const selectedModel = getOnDeviceModel(selectedId);

  const cacheByModel = useMemo(() => {
    const map = {};
    for (const model of MODEL_CATALOG_ORDER) {
      map[model.id] = getGemmaCacheStatus(model.id);
    }
    return map;
  }, [selectedId, modelState.phase, modelState.cachedOnDisk]);

  const cacheStatus = cacheByModel[selectedId] ?? getGemmaCacheStatus(selectedId);

  useEffect(() => subscribeGemmaModelManager(setModelState), []);

  useEffect(() => {
    getAppSettings().then(setSettings).catch(() => {});
  }, []);

  const readiness = getDeviceReadiness(getGemmaLlm()?.getMemoryUsage?.(), selectedId);
  const primaryLabel = useMemo(
    () => getPrimaryActionLabel(modelState, cacheStatus),
    [modelState, cacheStatus]
  );
  const statusLabel = useMemo(
    () => getModelCardStatus(selectedModel, cacheStatus, modelState),
    [selectedModel, cacheStatus, modelState]
  );

  async function handleVariantChange(variant) {
    const next = { ...settings, gemmaModelVariant: variant };
    setSettings(next);
    await saveAppSettings({ gemmaModelVariant: variant });
    if (modelState.isReady && modelState.variant !== variant) {
      await unloadGemmaModel();
    }
  }

  async function handleDownload() {
    try {
      await loadGemmaModel(selectedId);
      await saveAppSettings({ gemmaModelDownloaded: true });
    } catch (error) {
      Alert.alert('Model download failed', error?.message ?? 'Could not download the on-device model.');
    }
  }

  function handleCancel() {
    cancelGemmaDownload();
  }

  async function handleDelete() {
    Alert.alert(
      'Delete cached model?',
      `This frees about ${selectedModel.sizeLabel} of storage. You can download again later over Wi‑Fi.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteCachedGemmaModel(selectedId);
            await saveAppSettings({ gemmaModelDownloaded: false });
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
          Use Wi‑Fi for downloads. Partial files resume automatically. Only one model is loaded in memory at a time.
        </Text>
        {readiness.multimodalWarning ? (
          <Text style={styles.warning}>{readiness.multimodalWarning}</Text>
        ) : null}
        {readiness.backendWarning ? (
          <Text style={styles.warning}>{readiness.backendWarning}</Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>On-device models</Text>
        {MODEL_CATALOG_ORDER.map((model) => (
          <OnDeviceModelCard
            key={model.id}
            model={model}
            selected={selectedId === model.id}
            cacheStatus={cacheByModel[model.id]}
            modelState={modelState}
            entitlementEnabled={entitlementEnabled}
            onPress={() => handleVariantChange(model.id)}
            testID={`gemma-variant-${model.id}`}
          />
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{selectedModel.label}</Text>
        <Text style={styles.status} testID="gemma-status-label">{statusLabel}</Text>
        {modelState.phase === 'error' && modelState.variant === selectedId && modelState.error ? (
          <Text style={styles.error} testID="gemma-error-text">{modelState.error}</Text>
        ) : null}
        {modelState.phase === 'error' && cacheStatus.isPartial ? (
          <Text style={styles.note}>Download paused — check your connection and tap Resume download.</Text>
        ) : null}
        {readiness.iosRequiresEntitlement && !entitlementEnabled ? (
          <Text style={styles.warning}>
            This model needs the iOS extended virtual addressing entitlement (paid Apple Developer Program).
            Try Gemma 3n E2B instead, or enable extra.gemmaIosExtendedAddressing in app.json and rebuild.
          </Text>
        ) : null}
        {!readiness.meetsMinRam && readiness.availableRamGb ? (
          <Text style={styles.warning}>
            {`Available RAM (${readiness.availableRamGb} GB) may be below this model's ${selectedModel.minRamLabel} recommendation.`}
          </Text>
        ) : null}
        {primaryLabel ? (
          <TouchableOpacity
            testID="download-gemma-model"
            style={styles.primaryButton}
            onPress={handleDownload}
            disabled={modelState.isLoading}
          >
            {modelState.isLoading && modelState.variant === selectedId ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
            )}
          </TouchableOpacity>
        ) : modelState.variant === selectedId ? (
          <TouchableOpacity
            testID="download-gemma-model"
            style={styles.primaryButton}
            disabled
          >
            <ActivityIndicator color="#fff" />
          </TouchableOpacity>
        ) : null}
        {modelState.phase === 'downloading' && modelState.variant === selectedId ? (
          <TouchableOpacity testID="cancel-gemma-download" style={styles.secondaryButton} onPress={handleCancel}>
            <Text style={styles.secondaryButtonText}>Cancel download</Text>
          </TouchableOpacity>
        ) : null}
        {modelState.phase === 'error' && modelState.variant === selectedId && cacheStatus.isPartial ? (
          <TouchableOpacity testID="retry-gemma-download" style={styles.secondaryButton} onPress={handleDownload}>
            <Text style={styles.secondaryButtonText}>Retry download</Text>
          </TouchableOpacity>
        ) : null}
        {(cacheStatus.isComplete || (modelState.isReady && modelState.variant === selectedId)) ? (
          <TouchableOpacity testID="delete-gemma-model" style={styles.secondaryButton} onPress={handleDelete}>
            <Text style={styles.secondaryButtonText}>Delete cached model</Text>
          </TouchableOpacity>
        ) : null}
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
  status: {
    fontSize: 15,
    color: '#1a1a2e',
    marginBottom: 12,
  },
  error: {
    color: '#b42318',
    marginBottom: 12,
    fontSize: 13,
  },
  primaryButton: {
    backgroundColor: '#4f6ef7',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#dce2f7',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  secondaryButtonText: {
    color: '#4f6ef7',
    fontWeight: '700',
  },
});
