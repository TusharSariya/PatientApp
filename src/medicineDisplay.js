export function normalizeDurationInput(value) {
  return String(value ?? '').trim().slice(0, 3);
}

export function durationToInputValue(stored) {
  const text = String(stored ?? '').trim();
  if (!text) return '';
  const match = text.match(/^\d{1,3}/);
  if (match) return match[0];
  return text.slice(0, 3);
}

export function formatMedicineSubtitle(med) {
  const intervalDays = med?.interval_days ?? med?.intervalDays;
  return [
    med?.dosage,
    med?.frequency,
    intervalDays ? `q${intervalDays}d` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

export function medicineToDraftForm(med) {
  return {
    name: med?.name ?? '',
    dosage: med?.dosage ?? '',
    frequency: med?.frequency ?? '',
    intervalDays: med?.interval_days ?? med?.intervalDays ?? 1,
    duration: durationToInputValue(med?.duration),
    route: med?.route ?? 'Oral',
    instructions: med?.instructions ?? '',
  };
}
