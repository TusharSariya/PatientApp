import { EXTRACT_VISIT_TOOL_NAME, createEmptyExtractedVisit } from './visitExtractionSchema';

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractJsonBlock(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsed = tryParseJson(fenced[1].trim());
    if (parsed) return parsed;
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return tryParseJson(text.slice(start, end + 1));
  }
  return null;
}

function normalizeToolPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return createEmptyExtractedVisit();
  }
  if (payload[EXTRACT_VISIT_TOOL_NAME]) {
    return payload[EXTRACT_VISIT_TOOL_NAME];
  }
  if (payload.arguments) {
    return typeof payload.arguments === 'string'
      ? tryParseJson(payload.arguments) ?? createEmptyExtractedVisit()
      : payload.arguments;
  }
  if (payload.name === EXTRACT_VISIT_TOOL_NAME && payload.parameters) {
    return payload.parameters;
  }
  return payload;
}

export function parseExtractionResponse(responseText, transcript = '') {
  const text = String(responseText ?? '').trim();
  const direct = tryParseJson(text);
  if (direct) {
    return {
      fields: normalizeToolPayload(direct),
      transcript: transcript || text,
    };
  }

  const toolMatch = text.match(new RegExp(`${EXTRACT_VISIT_TOOL_NAME}\\s*\\(([\s\S]*?)\\)`, 'i'))
    || text.match(new RegExp(`${EXTRACT_VISIT_TOOL_NAME}[^{]*({[\s\S]*})`, 'i'));
  if (toolMatch?.[1]) {
    const parsed = tryParseJson(toolMatch[1]);
    if (parsed) {
      return { fields: normalizeToolPayload(parsed), transcript: transcript || text };
    }
  }

  const block = extractJsonBlock(text);
  if (block) {
    return { fields: normalizeToolPayload(block), transcript: transcript || text };
  }

  return {
    fields: createEmptyExtractedVisit(),
    transcript: transcript || text,
    parseError: 'Could not parse model response',
  };
}
