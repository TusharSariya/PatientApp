export function humanizeGemmaLoadError(error, {
  variantLabel,
  platform,
  iosEntitlementEnabled = false,
  iosRequiresEntitlement = false,
} = {}) {
  const message = String(error?.message ?? error ?? '');
  const lower = message.toLowerCase();

  if (
    lower.includes('failed to construct litert-lm engine')
    || lower.includes('checked backends and fallback chains')
    || lower.includes('litertlm code=500')
  ) {
    if (platform === 'ios' && iosRequiresEntitlement && !iosEntitlementEnabled) {
      return [
        `Could not load ${variantLabel ?? 'the model'} into memory on this iPhone.`,
        'This model is larger than 2 GB and needs the iOS extended virtual addressing entitlement (paid Apple Developer Program).',
        'Try Gemma 3n E2B instead — it works without the entitlement.',
        'Or enable extra.gemmaIosExtendedAddressing in app.json, run npx expo prebuild --clean, then rebuild.',
      ].join(' ');
    }
    if (platform === 'ios') {
      return [
        `Could not load ${variantLabel ?? 'the model'} into memory on this iPhone.`,
        'Try Gemma 3n E2B on 4 GB devices, or a smaller text-only model.',
        'Gemma 4 models also need the iOS extended virtual addressing entitlement when over 2 GB.',
      ].join(' ');
    }
    return [
      `Could not load ${variantLabel ?? 'the model'} into memory.`,
      'Try a smaller model, free storage and RAM, then tap Resume download.',
    ].join(' ');
  }

  if (lower.includes('http 401') || lower.includes('http 403')) {
    return [
      `Could not download ${variantLabel ?? 'the model'}.`,
      'This HuggingFace model may require accepting the Gemma license while logged in.',
    ].join(' ');
  }

  if (lower.includes('invalid magic number') || lower.includes('failed to read')) {
    return [
      `The cached ${variantLabel ?? 'model'} file is corrupted or incomplete.`,
      'Delete it (or tap Download after we clear the bad cache), then download again over Wi‑Fi.',
    ].join(' ');
  }

  if (lower.includes('jetsam') || lower.includes('memory') || lower.includes('low memory')) {
    return [
      `Not enough memory to load ${variantLabel ?? 'the model'}.`,
      'Close other apps, pick a smaller model (Gemma 3n E2B or Gemma 3 1B), or delete the cached model and retry.',
    ].join(' ');
  }

  return message || 'Failed to load on-device model.';
}
