import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { flatSelectedRow, screenColors } from '../screenLayout';

function isOperationOnModel(modelState, modelId, type) {
  const op = modelState.operation;
  return op?.variant === modelId && op?.type === type;
}

export function getModelCardStatus(model, cacheStatus, modelState) {
  const isLoaded = modelState.loadedVariant === model.id && modelState.isReady;
  if (isOperationOnModel(modelState, model.id, 'load')) {
    return 'Loading into memory…';
  }
  if (isOperationOnModel(modelState, model.id, 'download')) {
    const op = modelState.operation;
    if (op?.error) {
      return cacheStatus.isPartial ? 'Download interrupted' : 'Download failed';
    }
    const pct = Math.round((op?.progress ?? modelState.downloadProgress ?? 0) * 100);
    if (op?.attempt > 1) {
      return `Downloading ${pct}% (retry ${op.attempt}/${op.maxAttempts})`;
    }
    return `Downloading ${pct}%`;
  }
  if (isLoaded) {
    return 'Loaded';
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

export function getModelCardActions(model, cacheStatus, modelState) {
  const isLoaded = modelState.loadedVariant === model.id && modelState.isReady;
  const isDownloading = isOperationOnModel(modelState, model.id, 'download')
    && !modelState.operation?.error;
  const isLoading = isOperationOnModel(modelState, model.id, 'load');
  const otherOpInFlight = Boolean(
    modelState.operation && modelState.operation.variant !== model.id
  );

  if (isLoading) {
    return { primary: null, secondary: null, busy: true };
  }
  if (isDownloading) {
    return { primary: { label: 'Cancel', action: 'cancel' }, secondary: null, busy: false };
  }
  if (isLoaded) {
    return {
      primary: { label: 'Unload', action: 'unload' },
      secondary: { label: 'Delete', action: 'delete', destructive: true },
      busy: false,
    };
  }
  if (cacheStatus.isComplete) {
    return {
      primary: { label: 'Load', action: 'load', disabled: otherOpInFlight },
      secondary: { label: 'Delete', action: 'delete', destructive: true, disabled: otherOpInFlight },
      busy: false,
    };
  }
  if (cacheStatus.isPartial) {
    return {
      primary: { label: 'Resume', action: 'download', disabled: otherOpInFlight },
      secondary: { label: 'Delete', action: 'delete', destructive: true, disabled: otherOpInFlight },
      busy: false,
    };
  }
  return {
    primary: { label: 'Download', action: 'download', disabled: otherOpInFlight },
    secondary: null,
    busy: false,
  };
}

function ActionButton({ config, onPress, testID }) {
  if (!config) return null;
  const isDestructive = config.destructive;
  return (
    <Pressable
      testID={testID}
      style={[
        styles.actionButton,
        isDestructive ? styles.actionButtonDestructive : styles.actionButtonPrimary,
        config.disabled && styles.actionButtonDisabled,
      ]}
      onPress={(event) => {
        event?.stopPropagation?.();
        if (!config.disabled) onPress(config.action);
      }}
      disabled={config.disabled}
    >
      <Text
        style={[
          styles.actionButtonText,
          isDestructive ? styles.actionButtonTextDestructive : styles.actionButtonTextPrimary,
          config.disabled && styles.actionButtonTextDisabled,
        ]}
      >
        {config.label}
      </Text>
    </Pressable>
  );
}

export default function OnDeviceModelCard({
  model,
  selected,
  cacheStatus,
  modelState,
  entitlementEnabled,
  compatibility = null,
  showDevWarnings = false,
  devOnly = false,
  onPress,
  onDownload,
  onLoad,
  onUnload,
  onCancel,
  onDelete,
  testID,
}) {
  const isDownloading = isOperationOnModel(modelState, model.id, 'download');
  const isLoading = isOperationOnModel(modelState, model.id, 'load');
  const showProgress = isDownloading || isLoading;
  const op = modelState.operation;
  const progressValue = isLoading
    ? 1
    : Math.max(0, Math.min(1, op?.progress ?? modelState.downloadProgress ?? 0));
  const status = getModelCardStatus(model, cacheStatus, modelState);
  const actions = getModelCardActions(model, cacheStatus, modelState);
  const isLoaded = modelState.loadedVariant === model.id && modelState.isReady;
  const needsEntitlementWarning = showDevWarnings
    && (compatibility?.iosBlocked ?? (model.iosRequiresEntitlement && !entitlementEnabled));
  const opError = isOperationOnModel(modelState, model.id, 'download') || isOperationOnModel(modelState, model.id, 'load')
    ? modelState.operation?.error ?? modelState.error
    : null;

  function handleAction(action) {
    switch (action) {
      case 'download':
        onDownload?.(model.id);
        break;
      case 'load':
        onLoad?.(model.id);
        break;
      case 'unload':
        onUnload?.(model.id);
        break;
      case 'cancel':
        onCancel?.(model.id);
        break;
      case 'delete':
        onDelete?.(model.id);
        break;
      default:
        break;
    }
  }

  return (
    <TouchableOpacity
      testID={testID ?? `on-device-model-card-${model.id}`}
      style={[
        styles.card,
        flatSelectedRow(selected),
        selected && styles.cardSelected,
        devOnly && styles.cardDevOnly,
      ]}
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
        <Text style={styles.warning} testID={`${model.id}-entitlement-warning`}>
          Requires paid iOS developer entitlement to load.
        </Text>
      ) : null}
      {showDevWarnings && devOnly && compatibility?.reasons?.length ? (
        <Text style={styles.devOnlyReason} testID={`${model.id}-dev-only-reason`}>
          {`Hidden in production: ${compatibility.reasons.join('; ')}`}
        </Text>
      ) : null}
      <View style={styles.footer}>
        <Text style={[styles.status, isLoaded && styles.statusReady]}>
          {status}
        </Text>
        {selected ? <Text style={styles.selectedMark}>Selected for visits</Text> : null}
      </View>
      {opError ? (
        <Text style={styles.errorText} testID={`${model.id}-error-text`}>{opError}</Text>
      ) : null}
      {showProgress ? (
        <View style={styles.progressTrack} testID={`${model.id}-progress-track`}>
          <View style={[styles.progressFill, { width: `${Math.round(progressValue * 100)}%` }]} />
        </View>
      ) : null}
      <View style={styles.actionsRow}>
        {actions.busy ? (
          <ActivityIndicator color="#4f6ef7" style={styles.busyIndicator} />
        ) : (
          <>
            <ActionButton
              config={actions.primary}
              onPress={handleAction}
              testID={`${model.id}-primary-action`}
            />
            <ActionButton
              config={actions.secondary}
              onPress={handleAction}
              testID={`${model.id}-secondary-action`}
            />
          </>
        )}
      </View>
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
  cardDevOnly: {
    opacity: 0.72,
    borderStyle: 'dashed',
  },
  devOnlyReason: {
    fontSize: 12,
    color: '#5f6d8a',
    marginTop: 4,
    fontStyle: 'italic',
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
  errorText: {
    fontSize: 12,
    color: '#b42318',
    marginTop: 6,
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
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    minHeight: 36,
    alignItems: 'center',
  },
  actionButton: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  actionButtonPrimary: {
    borderColor: '#4f6ef7',
    backgroundColor: '#4f6ef7',
  },
  actionButtonDestructive: {
    borderColor: '#dce2f7',
    backgroundColor: 'transparent',
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionButtonTextPrimary: {
    color: '#fff',
  },
  actionButtonTextDestructive: {
    color: '#b42318',
  },
  actionButtonTextDisabled: {
    color: '#8a94b8',
  },
  busyIndicator: {
    marginVertical: 6,
  },
});
