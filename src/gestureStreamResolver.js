import { GESTURE_KINDS, normalizeGestureKind } from './gestureKinds';
import { matchGesture, matchGestureSequence } from './gestureRecognizer';

export function partitionGestures(rows) {
  const glyphs = [];
  const expansions = [];
  const sequences = [];

  for (const row of rows ?? []) {
    const kind = normalizeGestureKind(row);
    if (kind === GESTURE_KINDS.GLYPH) {
      glyphs.push(row);
    } else if (kind === GESTURE_KINDS.EXPANSION) {
      expansions.push(row);
    } else {
      sequences.push(row);
    }
  }

  return { glyphs, expansions, sequences };
}

export function hasDrawableGestures(rows) {
  const { glyphs, sequences } = partitionGestures(rows);
  return glyphs.length > 0 || sequences.length > 0;
}

export function matchGlyphStroke(stroke, glyphs, threshold = 0.24) {
  if (!stroke || !Array.isArray(glyphs) || glyphs.length === 0) {
    return null;
  }

  const match = matchGesture(stroke, glyphs, threshold);
  const symbol = match?.symbol?.trim();
  return symbol || null;
}

export function longestExpansion(symbolBuffer, expansions) {
  if (!symbolBuffer || !Array.isArray(expansions) || expansions.length === 0) {
    return null;
  }

  let best = null;
  for (const expansion of expansions) {
    const code = expansion.code?.trim();
    if (!code || code !== symbolBuffer) continue;
    if (!best || code.length > best.code.length) {
      best = { code, output: expansion.word };
    }
  }

  return best;
}

export function resolveStreamOutput({
  symbolBuffer,
  strokeSession,
  glyphs,
  expansions,
  sequences,
  threshold = 0.24,
}) {
  const expansionResult = longestExpansion(symbolBuffer, expansions);
  const sequenceMatch = matchGestureSequence(strokeSession, sequences, threshold);
  const sequenceResult = sequenceMatch
    ? {
        code: sequenceMatch.code?.trim() || `${strokeSession?.length ?? 0}`,
        output: sequenceMatch.word,
        source: 'sequence',
      }
    : null;

  if (!expansionResult && !sequenceResult) {
    return null;
  }

  const expansionCandidate = expansionResult
    ? { ...expansionResult, source: 'expansion' }
    : null;

  if (!expansionCandidate) return sequenceResult;
  if (!sequenceResult) return expansionCandidate;

  return expansionCandidate.code.length >= sequenceResult.code.length
    ? expansionCandidate
    : sequenceResult;
}

export function applyOpenSegment({ text, checkpointIndex, output }) {
  const safeText = text ?? '';
  const checkpoint = Math.max(0, Math.min(checkpointIndex ?? 0, safeText.length));
  const before = safeText.slice(0, checkpoint);
  const needsLeadingSpace = before.length > 0 && !/\s$/.test(before);
  const token = `${needsLeadingSpace ? ' ' : ''}${output ?? ''}`;
  const nextText = `${before}${token}`;
  const rangeStart = before.length + (needsLeadingSpace ? 1 : 0);

  return {
    text: nextText,
    openRange: { start: rangeStart, end: rangeStart + (output?.length ?? 0) },
    selection: { start: nextText.length, end: nextText.length },
  };
}

export function buildSymbolBuffer(symbols) {
  return (symbols ?? []).filter(Boolean).join('');
}
