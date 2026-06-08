import { durationToInputValue, normalizeDurationInput } from '../medicineDisplay';
import { createEmptyExtractedVisit } from './visitExtractionSchema';

const BP_PATTERN = /^\d{2,3}\/\d{2,3}$/;
const ROUTES = new Set(['Oral', 'Topical', 'IV', 'IM', 'Other']);

function clampIntervalDays(value) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 1;
  return Math.min(30, Math.max(1, Math.round(parsed)));
}

function cleanString(value) {
  return String(value ?? '').trim();
}

function normalizeMedicine(med, index) {
  const warnings = [];
  const name = cleanString(med?.name);
  if (!name) {
    warnings.push(`Medicine ${index + 1} has no name and was dropped.`);
    return { medicine: null, warnings };
  }
  const route = cleanString(med?.route) || 'Oral';
  if (!ROUTES.has(route)) {
    warnings.push(`Medicine "${name}" route "${route}" was reset to Oral.`);
  }
  return {
    medicine: {
      name,
      dosage: cleanString(med?.dosage),
      frequency: cleanString(med?.frequency),
      intervalDays: clampIntervalDays(med?.intervalDays),
      duration: normalizeDurationInput(durationToInputValue(med?.duration)),
      route: ROUTES.has(route) ? route : 'Oral',
      instructions: cleanString(med?.instructions),
    },
    warnings,
  };
}

export function validateExtractedVisit(rawFields = {}) {
  const warnings = [];
  const fields = createEmptyExtractedVisit();

  fields.visitDate = cleanString(rawFields.visitDate);
  fields.complaints = cleanString(rawFields.complaints);
  fields.findings = cleanString(rawFields.findings);
  fields.investigations = cleanString(rawFields.investigations);
  fields.procedures = cleanString(rawFields.procedures);
  fields.diagnosis = cleanString(rawFields.diagnosis);
  fields.notes = cleanString(rawFields.notes);
  fields.visitCost = cleanString(rawFields.visitCost);
  fields.paymentAmount = cleanString(rawFields.paymentAmount);

  const bp = cleanString(rawFields.bp);
  if (bp && !BP_PATTERN.test(bp)) {
    warnings.push(`Blood pressure "${bp}" may need manual correction.`);
  }
  fields.bp = bp;

  fields.weight = cleanString(rawFields.weight);
  fields.weightUnit = rawFields.weightUnit === 'lbs' ? 'lbs' : 'kg';

  fields.paymentScope = rawFields.paymentScope === 'family' ? 'family' : 'patient';

  const medicines = Array.isArray(rawFields.medicines) ? rawFields.medicines : [];
  fields.medicines = [];
  medicines.forEach((med, index) => {
    const { medicine, warnings: medWarnings } = normalizeMedicine(med, index);
    warnings.push(...medWarnings);
    if (medicine) fields.medicines.push(medicine);
  });

  return { fields, warnings };
}
