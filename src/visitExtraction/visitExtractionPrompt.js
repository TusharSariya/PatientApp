import { getExtractVisitToolDefinition } from './visitExtractionSchema';

export const VISIT_EXTRACTION_SYSTEM_PROMPT = `You are a clinical documentation assistant for a small clinic app.
Listen to visit audio or read a transcript and extract only facts explicitly stated.
Do not invent medicines, vitals, or payments.
Leave fields empty when unknown.
Normalize blood pressure as systolic/diastolic like 120/80.
Duration for medicines is days only, 1-3 digits without the word days.
Payment scope is patient or family.
Always call the extract_visit tool with your best structured result.`;

export const VISIT_EXTRACTION_AUDIO_PROMPT = `Listen to this clinic visit dictation. Extract all stated visit fields and prescribed medicines. Call extract_visit.`;

export function buildTextExtractionPrompt(transcript) {
  return `Extract structured visit data from this clinic dictation transcript. Call extract_visit.\n\nTranscript:\n${transcript}`;
}

export function getExtractVisitTools() {
  return [getExtractVisitToolDefinition()];
}
