import {
  backoffDelayMs,
  createStallWatcher,
  isRetryableError,
  retryWithBackoff,
  sleep,
} from '../src/gemma/gemmaDownloadPolicy';

describe('gemmaDownloadPolicy', () => {
  test('isRetryableError accepts network and timeout failures', () => {
    expect(isRetryableError(new Error('Network request failed'))).toBe(true);
    expect(isRetryableError(new Error('Download stalled. Check your connection.'))).toBe(true);
    expect(isRetryableError(new Error('HTTP 503'))).toBe(true);
  });

  test('isRetryableError rejects cancellation', () => {
    expect(isRetryableError(new Error('Download cancelled.'))).toBe(false);
  });

  test('retryWithBackoff retries retryable errors', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce('ok');
    const result = await retryWithBackoff(fn, { maxAttempts: 3, baseMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('createStallWatcher aborts after stall window', async () => {
    jest.useFakeTimers();
    const start = 1_000_000;
    jest.setSystemTime(start);
    const onAbort = jest.fn();
    const watcher = createStallWatcher({ stallMs: 1000 });
    watcher.start(onAbort);
    watcher.touch(0.1);
    jest.setSystemTime(start + 1500);
    jest.advanceTimersByTime(5000);
    expect(onAbort).toHaveBeenCalled();
    watcher.clear();
    jest.useRealTimers();
  });

  test('backoffDelayMs grows exponentially', () => {
    expect(backoffDelayMs(1, 1000)).toBe(1000);
    expect(backoffDelayMs(3, 1000)).toBe(4000);
  });

  test('sleep resolves after delay', async () => {
    jest.useFakeTimers();
    const promise = sleep(500);
    jest.advanceTimersByTime(500);
    await expect(promise).resolves.toBeUndefined();
    jest.useRealTimers();
  });
});
