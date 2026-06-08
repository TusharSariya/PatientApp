import { applyExtractedVisit, buildDefaultSelection } from '../src/visitExtraction/applyExtractedVisit';
import {
  getMockVisitDictationScript,
  MOCK_VISIT_DICTATION_SCRIPT_LIST,
  MOCK_VISIT_DICTATION_SCRIPTS,
} from '../src/visitExtraction/mockVisitDictationScripts';
import { buildVisitExtractionLoadConfig } from '../src/visitExtraction/visitExtractionPrompt';
import { parseExtractionResponse } from '../src/visitExtraction/parseExtractionResponse';
import { validateExtractedVisit } from '../src/visitExtraction/validateExtractedVisit';

describe('visitExtraction', () => {
  test('buildVisitExtractionLoadConfig omits tools on Android', () => {
    const android = buildVisitExtractionLoadConfig({
      backend: 'cpu',
      multimodal: true,
      platform: 'android',
    });
    expect(android.tools).toBeUndefined();
    expect(android.systemPrompt).toContain('JSON object');

    const ios = buildVisitExtractionLoadConfig({
      backend: 'gpu',
      multimodal: true,
      platform: 'ios',
    });
    expect(ios.tools).toHaveLength(1);
  });

  test('parseExtractionResponse reads JSON tool payload', () => {
    const result = parseExtractionResponse(
      JSON.stringify({
        complaints: 'fever',
        bp: '120/80',
        medicines: [{ name: 'Paracetamol', dosage: '500mg', duration: '5 days' }],
      })
    );
    expect(result.fields.complaints).toBe('fever');
    expect(result.fields.bp).toBe('120/80');
  });

  test('validateExtractedVisit normalizes medicines and warns on bad bp', () => {
    const { fields, warnings } = validateExtractedVisit({
      bp: 'high',
      medicines: [{ name: 'Amoxicillin', duration: '7 days', intervalDays: 40 }],
    });
    expect(fields.medicines[0].duration).toBe('7');
    expect(fields.medicines[0].intervalDays).toBe(30);
    expect(warnings.some((warning) => warning.includes('Blood pressure'))).toBe(true);
  });

  test('applyExtractedVisit merges selected fields and medicines', () => {
    const fields = {
      complaints: 'cough',
      bp: '118/76',
      medicines: [{ name: 'Med A', dosage: '10mg', frequency: '', intervalDays: 1, duration: '3', route: 'Oral', instructions: '' }],
    };
    const selection = buildDefaultSelection(fields);
    const updates = applyExtractedVisit(fields, selection, {
      prescribedMeds: [],
      nextDraftId: 2,
      narrativeTranscript: 'Patient has cough',
    });
    expect(updates.complaints).toBe('cough');
    expect(updates.prescribedMeds).toHaveLength(1);
    expect(updates.prescribedMeds[0].draftId).toBe(2);
    expect(updates.narrativeTranscript).toBe('Patient has cough');
  });

  test('mock visit dictation scripts export full and quick transcripts', () => {
    expect(MOCK_VISIT_DICTATION_SCRIPT_LIST).toHaveLength(2);
    expect(MOCK_VISIT_DICTATION_SCRIPTS.fullVisit.transcript.length).toBeGreaterThan(100);
    expect(MOCK_VISIT_DICTATION_SCRIPTS.quickSmoke.transcript.length).toBeGreaterThan(20);
    expect(getMockVisitDictationScript('fullVisit').id).toBe('fullVisit');
    expect(getMockVisitDictationScript('unknown').id).toBe('fullVisit');
  });

  test('fullVisit transcript includes extraction anchors', () => {
    const { transcript } = MOCK_VISIT_DICTATION_SCRIPTS.fullVisit;
    expect(transcript.toLowerCase()).toContain('sore throat');
    expect(transcript).toMatch(/one eighteen over seventy six/i);
    expect(transcript.toLowerCase()).toContain('amoxicillin');
    expect(transcript.toLowerCase()).toContain('paracetamol');
    expect(transcript.toLowerCase()).toContain('patient scope');
  });
});
