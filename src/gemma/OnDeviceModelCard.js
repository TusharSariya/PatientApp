import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { flatSelectedRow, screenColors } from '../screenLayout';

export function getModelCardStatus(model, cacheStatus, modelState) {
  const isActive = modelState.variant === model.id;
  if (isActive && (modelState.phase === 'ready' || modelState.isReady)) {
    return 'Ready';
  }
  if (isActive && modelState.phase === 'loading') {
    return 'Loading into memory…';
  }
  if (isActive && modelState.phase === 'downloading') {
    const pct = Math.round((modelState.downloadProgress ?? 0) * 100);
    if (modelState.attempt > 1) {
      return `Downloading ${pct}% (retry ${modelState.attempt}/${modelState.maxAttempts})`;
    }
    return `Downloading ${pct}%`;
  }
  if (isActive && modelState.phase === 'error') {
    return cacheStatus.isPartial ? 'Download interrupted' : 'Load failed';
  }
  if (cacheStatus.isComplete) {
    return 'Downloaded';
  }
  if (cacheStatus.isPartial) {
    const pct = cacheStatus.expectedBytes
      ? Math.round((cacheStatus.bytes / cacheStatus.expectedBytes) * 100)
      : null;
    return pct != null ? `Partial ${pct}%` : 'Partial download';
  }
  return 'Not downloaded';
}

export default function OnDeviceModelCard({
  model,
  selected,
  cacheStatus,
  modelState,
  entitlementEnabled,
  onPress,
  testID,
}) {
  const isActive = modelState.variant === model.id;
  const showProgress = isActive && (modelState.phase === 'downloading' || modelState.phase === 'loading');
  const progressValue = modelState.phase === 'loading'
    ? 1
    : Math.max(0, Math.min(1, modelState.downloadProgress ?? 0));
  const status = getModelCardStatus(model, cacheStatus, modelState);
  const needsEntitlementWarning = model.iosRequiresEntitlement && !entitlementEnabled;

  return (
    <TouchableOpacity
      testID={testID ?? `on-device-model-card-${model.id}`}
      style={[styles.card, flatSelectedRow(selected), selected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{model.label}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{model.badge}</Text>
        </View>
      </View>
      <Text style={styles.description}>{model.description}</Text>
      <Text style={styles.meta}>
        {model.sizeLabel} · {model.minRamLabel} RAM
        {model.supportsNativeAudio ? ' · Native audio' : ' · System speech'}
      </Text>
      {model.huggingFaceLicenseRequired ? (
        <Text style={styles.warning}>HuggingFace Gemma license required to download.</Text>
      ) : null}
      {needsEntitlementWarning ? (
        <Text style={styles.warning}>Requires paid iOS developer entitlement to load.</Text>
      ) : null}
      <View style={styles.footer}>
        <Text style={[styles.status, isActive && modelState.phase === 'ready' && styles.statusReady]}>
          {status}
        </Text>
        {selected ? <Text style={styles.selectedMark}>Selected</Text> : null}
      </View>
      {showProgress ? (
        <View style={styles.progressTrack} testID={`${model.id}-progress-track`}>
          <View style={[styles.progressFill, { width: `${Math.round(progressValue * 100)}%` }]} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: screenColors.borderLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    backgroundColor: screenColors.surface,
  },
  cardSelected: {
    borderColor: '#4f6ef7',
    backgroundColor: screenColors.tint,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    flex: 1,
  },
  badge: {
    backgroundColor: '#e8ecf8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4f6ef7',
  },
  description: {
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
    marginBottom: 6,
  },
  meta: {
    fontSize: 12,
    color: '#5f6d8a',
    marginBottom: 4,
  },
  warning: {
    fontSize: 12,
    color: '#8a5a00',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  status: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5f6d8a',
  },
  statusReady: {
    color: '#1a7f4b',
  },
  selectedMark: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4f6ef7',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#e8ecf8',
    overflow: 'hidden',
    marginTop: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4f6ef7',
    borderRadius: 999,
  },
});
