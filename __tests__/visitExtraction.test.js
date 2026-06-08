import { applyExtractedVisit, buildDefaultSelection } from '../src/visitExtraction/applyExtractedVisit';
import { parseExtractionResponse } from '../src/visitExtraction/parseExtractionResponse';
import { validateExtractedVisit } from '../src/visitExtraction/validateExtractedVisit';

describe('visitExtraction', () => {
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
});
