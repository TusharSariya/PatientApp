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

export const VISIT_EXTRACTION_AUDIO_JSON_PROMPT =
  'Listen to this clinic visit dictation. Extract all stated visit fields and prescribed medicines. Respond with one JSON object only.';

export const VISIT_EXTRACTION_JSON_SYSTEM_SUFFIX = `Respond with only one JSON object containing visit fields (visitDate, complaints, findings, bp, weight, weightUnit, investigations, procedures, diagnosis, notes, visitCost, paymentAmount, paymentScope, medicines). No markdown fences.`;

export function buildTextExtractionPrompt(transcript, platform = 'ios') {
  if (platform === 'android') {
    return `Extract structured visit data from this clinic dictation transcript. Respond with one JSON object only.\n\nTranscript:\n${transcript}`;
  }
  return `Extract structured visit data from this clinic dictation transcript. Call extract_visit.\n\nTranscript:\n${transcript}`;
}

export function getVisitExtractionAudioPrompt(platform = 'ios') {
  return platform === 'android'
    ? VISIT_EXTRACTION_AUDIO_JSON_PROMPT
    : VISIT_EXTRACTION_AUDIO_PROMPT;
}

export function getExtractVisitTools() {
  return [getExtractVisitToolDefinition()];
}

/** LiteRT tool calling crashes on Android (ToolProvider ClassCastException). Use JSON mode there. */
export function buildVisitExtractionLoadConfig({ backend, multimodal, platform }) {
  const base = {
    backend,
    multimodal,
    temperature: 0.2,
    maxTokens: 2048,
  };
  if (platform === 'android') {
    return {
      ...base,
      systemPrompt: `${VISIT_EXTRACTION_SYSTEM_PROMPT}\n${VISIT_EXTRACTION_JSON_SYSTEM_SUFFIX}`,
    };
  }
  return {
    ...base,
    systemPrompt: VISIT_EXTRACTION_SYSTEM_PROMPT,
    tools: getExtractVisitTools(),
  };
}
