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
    duration: med?.duration ?? '',
    route: med?.route ?? 'Oral',
    instructions: med?.instructions ?? '',
  };
}
