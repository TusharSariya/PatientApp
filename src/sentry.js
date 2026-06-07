import * as Sentry from '@sentry/react-native';

import { setSentryReporter } from './errorLog';

const PHI_KEY_PATTERN = /patient|name|phone|address|notes|dob|family|medicine|complaint|diagnosis|registration|contact|hours|qualification/i;

function redactValue(value) {
  if (value == null) return value;
  if (typeof value === 'string') return '[redacted]';
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return '[redacted]';
}

function sanitizeEvent(event) {
  if (event?.extra) {
    const nextExtra = {};
    for (const [key, value] of Object.entries(event.extra)) {
      nextExtra[key] = PHI_KEY_PATTERN.test(key) ? '[redacted]' : redactValue(value);
    }
    event.extra = nextExtra;
  }
  return event;
}

export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    enableInExpoDevelopment: false,
    tracesSampleRate: 0.2,
    beforeSend: sanitizeEvent,
  });

  setSentryReporter((error, context) => {
    Sentry.captureException(error, { extra: context });
  });

  return true;
}

export { Sentry };
