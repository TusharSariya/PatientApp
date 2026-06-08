import { buildTouchGesture } from '../src/gestureRecognizer';
import {
  applyOpenSegment,
  buildSymbolBuffer,
  longestExpansion,
  matchGlyphStroke,
  partitionGestures,
  resolveStreamOutput,
} from '../src/gestureStreamResolver';
import { makeRawPath } from './helpers/gesturePadSim';

function glyphRow(symbol, preset) {
  const stroke = buildTouchGesture(makeRawPath(preset));
  return {
    id: symbol.charCodeAt(0),
    kind: 'glyph',
    symbol,
    word: '',
    code: null,
    data: JSON.stringify(stroke),
  };
}

describe('gestureStreamResolver', () => {
  const glyphs = [
    glyphRow('U', { count: 24, stepX: 10, stepY: 0 }),
    glyphRow('R', { count: 24, stepX: 0, stepY: 10 }),
    glyphRow('I', { count: 24, stepX: 8, stepY: 8 }),
  ];
  const expansions = [
    { id: 10, kind: 'expansion', code: 'U', word: 'urine', data: '{}' },
    { id: 11, kind: 'expansion', code: 'URI', word: 'Upper Respiratory Infection', data: '{}' },
  ];

  test('partitionGestures splits rows by kind', () => {
    const rows = [
      ...glyphs,
      ...expansions,
      { id: 12, kind: 'sequence', word: 'cold', code: 'C', data: '{"kind":"touch-sequence-v1","strokes":[]}' },
      { id: 13, word: 'legacy', data: '{}' },
    ];
    const partitioned = partitionGestures(rows);
    expect(partitioned.glyphs).toHaveLength(3);
    expect(partitioned.expansions).toHaveLength(2);
    expect(partitioned.sequences).toHaveLength(2);
  });

  test('longestExpansion matches exact symbol buffer only', () => {
    expect(longestExpansion('U', expansions)).toEqual({ code: 'U', output: 'urine' });
    expect(longestExpansion('UR', expansions)).toBeNull();
    expect(longestExpansion('URI', expansions)).toEqual({
      code: 'URI',
      output: 'Upper Respiratory Infection',
    });
  });

  test('resolveStreamOutput upgrades from U to URI as buffer grows', () => {
    const strokeU = buildTouchGesture(makeRawPath({ count: 24, stepX: 10, stepY: 1 }));
    const strokeR = buildTouchGesture(makeRawPath({ count: 24, stepX: 1, stepY: 10 }));
    const strokeI = buildTouchGesture(makeRawPath({ count: 24, stepX: 8, stepY: 9 }));

    const afterU = resolveStreamOutput({
      symbolBuffer: 'U',
      strokeSession: [strokeU],
      glyphs,
      expansions,
      sequences: [],
    });
    expect(afterU).toEqual({ code: 'U', output: 'urine', source: 'expansion' });

    const afterURI = resolveStreamOutput({
      symbolBuffer: 'URI',
      strokeSession: [strokeU, strokeR, strokeI],
      glyphs,
      expansions,
      sequences: [],
    });
    expect(afterURI).toEqual({
      code: 'URI',
      output: 'Upper Respiratory Infection',
      source: 'expansion',
    });
  });

  test('matchGlyphStroke returns symbol for closest glyph', () => {
    const stroke = buildTouchGesture(makeRawPath({ count: 24, stepX: 10, stepY: 1 }));
    expect(matchGlyphStroke(stroke, glyphs)).toBe('U');
  });

  test('applyOpenSegment replaces open text from checkpoint', () => {
    const applied = applyOpenSegment({
      text: 'Notes fever',
      checkpointIndex: 11,
      output: 'urine',
    });
    expect(applied.text).toBe('Notes fever urine');
    expect(applied.openRange).toEqual({ start: 12, end: 17 });
  });

  test('buildSymbolBuffer joins matched symbols', () => {
    expect(buildSymbolBuffer(['U', 'R', 'I'])).toBe('URI');
    expect(buildSymbolBuffer(['U', null, 'I'])).toBe('UI');
  });
});
