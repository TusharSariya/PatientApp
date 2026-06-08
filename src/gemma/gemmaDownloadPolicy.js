export const DEFAULT_MAX_ATTEMPTS = 4;
export const DEFAULT_BASE_BACKOFF_MS = 2000;
export const DEFAULT_STALL_MS = 90_000;

export function isRetryableError(error) {
  const message = String(error?.message ?? error ?? '').toLowerCase();
  if (!message) return true;
  if (message.includes('aborted') || message.includes('cancelled') || message.includes('canceled')) {
    return false;
  }
  if (message.includes('stall')) return true;
  if (message.includes('timeout') || message.includes('timed out')) return true;
  if (message.includes('network') || message.includes('connection')) return true;
  if (message.includes('socket') || message.includes('reset')) return true;
  if (/http\s*5\d{2}/.test(message) || message.includes('502') || message.includes('503')) {
    return true;
  }
  return false;
}

export function backoffDelayMs(attempt, baseMs = DEFAULT_BASE_BACKOFF_MS) {
  return baseMs * (2 ** Math.max(0, attempt - 1));
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithBackoff(fn, {
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  baseMs = DEFAULT_BASE_BACKOFF_MS,
  shouldRetry = isRetryableError,
  onAttempt,
  signal,
} = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (signal?.aborted) {
      throw new Error('Download cancelled.');
    }
    onAttempt?.(attempt, maxAttempts);
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !shouldRetry(error)) {
        throw error;
      }
      await sleep(backoffDelayMs(attempt, baseMs));
    }
  }
  throw lastError ?? new Error('Download failed.');
}

export function createStallWatcher({ stallMs = DEFAULT_STALL_MS, onStall } = {}) {
  let lastProgress = 0;
  let lastChangeAt = Date.now();
  let timer = null;

  function clear() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function touch(progress) {
    if (progress > lastProgress) {
      lastProgress = progress;
      lastChangeAt = Date.now();
    }
  }

  function start(onAbort) {
    clear();
    timer = setInterval(() => {
      if (Date.now() - lastChangeAt >= stallMs) {
        onStall?.();
        onAbort?.(new Error('Download stalled. Check your connection and try again.'));
        clear();
      }
    }, 5000);
  }

  return { touch, start, clear };
}
