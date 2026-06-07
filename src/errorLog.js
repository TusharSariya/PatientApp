const MAX_ENTRIES = 20;
const MAX_STACK_LENGTH = 2000;

const ALLOWED_CONTEXT_KEYS = new Set(['screen', 'action', 'prefill']);

const PHI_KEY_PATTERN = /patient|name|phone|address|notes|dob|family|medicine|complaint|diagnosis|registration|contact|hours|qualification/i;

let entries = [];
let sentryReporter = null;

export function setSentryReporter(reporter) {
  sentryReporter = typeof reporter === 'function' ? reporter : null;
}

function normalizeError(error) {
  if (error instanceof Error) {
    return {
      message: error.message || 'Unknown error',
      stack: error.stack ? error.stack.slice(0, MAX_STACK_LENGTH) : null,
    };
  }
  return {
    message: String(error ?? 'Unknown error'),
    stack: null,
  };
}

export function sanitizeContext(context = {}) {
  const safe = {};
  for (const [key, value] of Object.entries(context ?? {})) {
    if (!ALLOWED_CONTEXT_KEYS.has(key)) continue;
    if (PHI_KEY_PATTERN.test(key)) continue;
    if (value == null) continue;
    safe[key] = String(value).slice(0, 500);
  }
  return safe;
}

export function reportError(error, context = {}) {
  const normalized = normalizeError(error);
  const safeContext = sanitizeContext(context);
  const entry = {
    timestamp: new Date().toISOString(),
    message: normalized.message,
    stack: normalized.stack,
    context: safeContext,
  };

  entries = [...entries, entry].slice(-MAX_ENTRIES);
  sentryReporter?.(error instanceof Error ? error : new Error(normalized.message), safeContext);
  return entry;
}

export function getRecentErrors() {
  return [...entries];
}

export function clearRecentErrors() {
  entries = [];
}

export function formatErrorsForReport(recentErrors = entries) {
  if (!recentErrors.length) {
    return 'No recent errors recorded in this session.';
  }

  return recentErrors
    .map((entry, index) => {
      const contextText = Object.keys(entry.context ?? {}).length
        ? `\n  Context: ${JSON.stringify(entry.context)}`
        : '';
      const stackText = entry.stack ? `\n  Stack: ${entry.stack}` : '';
      return `${index + 1}. [${entry.timestamp}] ${entry.message}${contextText}${stackText}`;
    })
    .join('\n\n');
}
