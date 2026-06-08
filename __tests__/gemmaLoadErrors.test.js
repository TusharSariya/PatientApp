import { humanizeGemmaLoadError } from '../src/gemma/gemmaLoadErrors';

describe('humanizeGemmaLoadError', () => {
  test('suggests gemma3n when iOS entitlement is missing', () => {
    const message = humanizeGemmaLoadError(
      new Error('Error Domain=LiteRTLM Code=500 "Failed to construct LiteRT-LM engine. Checked backends and fallback chains."'),
      {
        variantLabel: 'Gemma 4 E4B',
        platform: 'ios',
        iosRequiresEntitlement: true,
        iosEntitlementEnabled: false,
      }
    );
    expect(message).toContain('Gemma 3n E2B');
    expect(message).toContain('extended virtual addressing');
  });

  test('explains corrupt cached model files', () => {
    const message = humanizeGemmaLoadError(
      new Error('INVALID_ARGUMENT: Invalid magic number or failed to read'),
      { variantLabel: 'Gemma 4 E4B', platform: 'android' },
    );
    expect(message).toContain('corrupted');
    expect(message).toContain('download again');
  });

  test('falls back to original message when unrecognized', () => {
    expect(humanizeGemmaLoadError(new Error('Something else'), { platform: 'ios' }))
      .toBe('Something else');
  });
});
