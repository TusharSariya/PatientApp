import React, { useEffect, useState } from 'react';
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
  deleteCachedGemmaModel,
  getDeviceReadiness,
  getGemmaLlm,
  loadGemmaModel,
  subscribeGemmaModelManager,
  unloadGemmaModel,
} from './gemma/GemmaModelManager';
import { GEMMA_VARIANTS } from './gemma/gemmaConfig';
import { flatPressableRow, flatSection, screenColors, screenContent } from './screenLayout';

export default function VisitAiSettingsScreen() {
  const [settings, setSettings] = useState({ gemmaModelVariant: 'e2b' });
  const [modelState, setModelState] = useState({
    isReady: false,
    isLoading: false,
    downloadProgress: 0,
    error: null,
    variant: 'e2b',
  });

  useEffect(() => subscribeGemmaModelManager(setModelState), []);

  useEffect(() => {
    getAppSettings().then(setSettings).catch(() => {});
  }, []);

  const readiness = getDeviceReadiness(getGemmaLlm()?.getMemoryUsage?.());

  async function handleVariantChange(variant) {
    const next = { ...settings, gemmaModelVariant: variant };
    setSettings(next);
    await saveAppSettings({ gemmaModelVariant: variant });
    if (modelState.isReady) {
      await unloadGemmaModel();
    }
  }

  async function handleDownload() {
    try {
      await loadGemmaModel(settings.gemmaModelVariant);
      await saveAppSettings({ gemmaModelDownloaded: true });
    } catch (error) {
      Alert.alert('Model download failed', error?.message ?? 'Could not download the on-device model.');
    }
  }

  async function handleDelete() {
    await deleteCachedGemmaModel(settings.gemmaModelVariant);
    await saveAppSettings({ gemmaModelDownloaded: false });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.intro}>
          Visit dictation uses Gemma 4 on your phone. Audio and extracted fields stay on-device.
        </Text>
        {readiness.multimodalWarning ? (
          <Text style={styles.warning}>{readiness.multimodalWarning}</Text>
        ) : null}
        {readiness.backendWarning ? (
          <Text style={styles.warning}>{readiness.backendWarning}</Text>
        ) : null}
        {readiness.iosNeedsEntitlement ? (
          <Text style={styles.note}>
            iOS requires the extended virtual addressing entitlement for Gemma 4 models.
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Model variant</Text>
        {Object.values(GEMMA_VARIANTS).map((variant, index, list) => (
          <TouchableOpacity
            key={variant.id}
            testID={`gemma-variant-${variant.id}`}
            style={flatPressableRow({ last: index === list.length - 1 })}
            onPress={() => handleVariantChange(variant.id)}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{variant.label}</Text>
              <Text style={styles.rowSub}>{variant.sizeLabel}</Text>
            </View>
            <Text style={styles.selectedMark}>
              {settings.gemmaModelVariant === variant.id ? '✓' : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>On-device model</Text>
        <Text style={styles.status}>
          {modelState.isReady
            ? 'Ready for visit extraction'
            : modelState.isLoading
              ? `Downloading… ${Math.round(modelState.downloadProgress * 100)}%`
              : 'Not loaded'}
        </Text>
        {modelState.error ? <Text style={styles.error}>{modelState.error}</Text> : null}
        <TouchableOpacity
          testID="download-gemma-model"
          style={styles.primaryButton}
          onPress={handleDownload}
          disabled={modelState.isLoading}
        >
          {modelState.isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {modelState.isReady ? 'Reload model' : 'Download model'}
            </Text>
          )}
        </TouchableOpacity>
        {modelState.isReady ? (
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
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  rowSub: {
    marginTop: 2,
    fontSize: 13,
    color: '#5f6d8a',
  },
  selectedMark: {
    fontSize: 18,
    color: '#4f6ef7',
    fontWeight: '800',
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
  },
  secondaryButtonText: {
    color: '#4f6ef7',
    fontWeight: '700',
  },
});
