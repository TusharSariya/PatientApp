import { getOnDeviceModel } from './gemmaConfig';

function isOperationOnModel(modelState, modelId, type) {
  const op = modelState.operation;
  return op?.variant === modelId && op?.type === type;
}

function downloadStatusLabel(modelState, modelId) {
  const op = modelState.operation;
  if (!isOperationOnModel(modelState, modelId, 'download')) {
    return 'Downloading…';
  }
  if (op?.error) {
    return 'Download failed';
  }
  const pct = Math.round((op?.progress ?? modelState.downloadProgress ?? 0) * 100);
  if (op?.attempt > 1) {
    return `Downloading ${pct}% (retry ${op.attempt}/${op.maxAttempts})`;
  }
  return `Downloading ${pct}%`;
}

/**
 * Dictation-sheet model UI — load/download only (no unload/delete).
 */
export function getVisitDictationModelUi({ gemmaVariant, modelState, cacheStatus }) {
  const visitModel = getOnDeviceModel(gemmaVariant);
  const isReady = modelState.isReady && modelState.loadedVariant === gemmaVariant;
  const loadedOther =
    modelState.isReady
    && modelState.loadedVariant
    && modelState.loadedVariant !== gemmaVariant;

  const mismatchLoadedLabel = loadedOther
    ? getOnDeviceModel(modelState.loadedVariant).label
    : null;

  const isLoading = isOperationOnModel(modelState, gemmaVariant, 'load')
    && !modelState.operation?.error;
  const loadFailed = isOperationOnModel(modelState, gemmaVariant, 'load')
    && modelState.operation?.error;
  const isDownloading = isOperationOnModel(modelState, gemmaVariant, 'download')
    && !modelState.operation?.error;
  const otherOpInFlight = Boolean(
    modelState.operation && modelState.operation.variant !== gemmaVariant
  );

  if (isReady) {
    return {
      statusLabel: 'Ready for extraction',
      isReady: true,
      mismatchLoadedLabel: null,
      primaryAction: null,
      secondaryAction: null,
      busy: false,
    };
  }

  if (isLoading) {
    return {
      statusLabel: 'Loading into memory…',
      isReady: false,
      mismatchLoadedLabel,
      primaryAction: null,
      secondaryAction: null,
      busy: true,
    };
  }

  if (loadFailed) {
    return {
      statusLabel: 'Load failed',
      isReady: false,
      mismatchLoadedLabel,
      primaryAction: { label: 'Retry load', action: 'load', disabled: otherOpInFlight },
      secondaryAction: null,
      busy: false,
    };
  }

  if (isDownloading) {
    return {
      statusLabel: downloadStatusLabel(modelState, gemmaVariant),
      isReady: false,
      mismatchLoadedLabel,
      primaryAction: { label: 'Cancel', action: 'cancel', disabled: false },
      secondaryAction: null,
      busy: false,
    };
  }

  if (loadedOther) {
    return {
      statusLabel: 'Different model loaded',
      isReady: false,
      mismatchLoadedLabel,
      primaryAction: {
        label: 'Load',
        action: 'load',
        disabled: otherOpInFlight || !cacheStatus.isComplete,
      },
      secondaryAction: null,
      busy: false,
    };
  }

  if (cacheStatus.isComplete) {
    return {
      statusLabel: 'Downloaded',
      isReady: false,
      mismatchLoadedLabel: null,
      primaryAction: { label: 'Load', action: 'load', disabled: otherOpInFlight },
      secondaryAction: null,
      busy: false,
    };
  }

  if (cacheStatus.isPartial) {
    const pct = cacheStatus.expectedBytes
      ? Math.round((cacheStatus.bytes / cacheStatus.expectedBytes) * 100)
      : null;
    return {
      statusLabel: pct != null ? `Partial download ${pct}%` : 'Partial download',
      isReady: false,
      mismatchLoadedLabel: null,
      primaryAction: { label: 'Resume', action: 'download', disabled: otherOpInFlight },
      secondaryAction: null,
      busy: false,
    };
  }

  return {
    statusLabel: 'Not downloaded',
    isReady: false,
    mismatchLoadedLabel: null,
    primaryAction: { label: 'Download', action: 'download', disabled: otherOpInFlight },
    secondaryAction: null,
    busy: false,
  };
}
