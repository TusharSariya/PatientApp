import { Platform } from 'react-native';

import {
  buildTextExtractionPrompt,
  getVisitExtractionAudioPrompt,
} from '../visitExtraction/visitExtractionPrompt';
import { parseExtractionResponse } from '../visitExtraction/parseExtractionResponse';
import { validateExtractedVisit } from '../visitExtraction/validateExtractedVisit';
import { getGemmaLlm, loadGemmaModel } from './GemmaModelManager';

async function ensureReadyLlm(variant) {
  let llm = getGemmaLlm();
  if (!llm?.isReady?.()) {
    llm = await loadGemmaModel(variant);
  }
  return llm;
}

function finalizeExtraction(responseText, transcript = '') {
  const parsed = parseExtractionResponse(responseText, transcript);
  const validated = validateExtractedVisit(parsed.fields);
  return {
    fields: validated.fields,
    warnings: [...(parsed.parseError ? [parsed.parseError] : []), ...validated.warnings],
    transcript: parsed.transcript,
  };
}

export async function extractVisitFromAudio(audioPath, { variant = 'e2b' } = {}) {
  const llm = await ensureReadyLlm(variant);
  llm.resetConversation();
  const response = await llm.sendMessageWithAudio(
    getVisitExtractionAudioPrompt(Platform.OS),
    audioPath,
  );
  return finalizeExtraction(response);
}

export async function extractVisitFromText(transcript, { variant = 'e2b' } = {}) {
  const llm = await ensureReadyLlm(variant);
  llm.resetConversation();
  const response = await llm.sendMessage(buildTextExtractionPrompt(transcript, Platform.OS));
  return finalizeExtraction(response, transcript);
}
