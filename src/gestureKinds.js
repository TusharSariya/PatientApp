export const GESTURE_KINDS = {
  GLYPH: 'glyph',
  EXPANSION: 'expansion',
  SEQUENCE: 'sequence',
};

export function normalizeGestureKind(row) {
  return row?.kind || GESTURE_KINDS.SEQUENCE;
}
