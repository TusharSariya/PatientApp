export const VISIT_SCALAR_FIELDS = [
  { key: 'visitDate', label: 'Visit Date' },
  { key: 'complaints', label: 'Complaints' },
  { key: 'findings', label: 'Findings' },
  { key: 'bp', label: 'Blood Pressure' },
  { key: 'weight', label: 'Weight' },
  { key: 'weightUnit', label: 'Weight Unit' },
  { key: 'investigations', label: 'Investigations' },
  { key: 'procedures', label: 'Procedures' },
  { key: 'diagnosis', label: 'Diagnosis' },
  { key: 'notes', label: 'Notes' },
  { key: 'visitCost', label: 'Visit Cost' },
  { key: 'paymentAmount', label: 'Payment Amount' },
  { key: 'paymentScope', label: 'Payment Scope' },
];

export function buildReviewSections(fields) {
  return [
    {
      id: 'clinical',
      title: 'Clinical',
      items: VISIT_SCALAR_FIELDS.filter((field) =>
        ['visitDate', 'complaints', 'findings', 'investigations', 'procedures', 'diagnosis', 'notes'].includes(field.key)
      ).map((field) => ({
        id: field.key,
        label: field.label,
        value: String(fields[field.key] ?? ''),
      })),
    },
    {
      id: 'vitals',
      title: 'Vitals',
      items: [
        { id: 'bp', label: 'Blood Pressure', value: fields.bp ?? '' },
        { id: 'weight', label: 'Weight', value: fields.weight ?? '' },
        { id: 'weightUnit', label: 'Weight Unit', value: fields.weightUnit ?? 'kg' },
      ],
    },
    {
      id: 'payment',
      title: 'Payment',
      items: [
        { id: 'visitCost', label: 'Visit Cost', value: fields.visitCost ?? '' },
        { id: 'paymentAmount', label: 'Payment Amount', value: fields.paymentAmount ?? '' },
        { id: 'paymentScope', label: 'Payment Scope', value: fields.paymentScope ?? 'patient' },
      ],
    },
    {
      id: 'medicines',
      title: 'Medicines',
      items: (fields.medicines ?? []).map((med, index) => ({
        id: `medicine-${index}`,
        label: med.name,
        value: [med.dosage, med.frequency, med.duration && `${med.duration}d`, med.route]
          .filter(Boolean)
          .join(' · '),
        medicine: med,
      })),
    },
  ];
}

export function buildDefaultSelection(fields) {
  const selection = {};
  VISIT_SCALAR_FIELDS.forEach((field) => {
    const value = fields[field.key];
    selection[field.key] = Boolean(String(value ?? '').trim());
  });
  selection.medicines = (fields.medicines ?? []).length > 0;
  return selection;
}

export function applyExtractedVisit(fields, selection, { prescribedMeds = [], nextDraftId = 1, narrativeTranscript = '' } = {}) {
  const updates = {};

  VISIT_SCALAR_FIELDS.forEach((field) => {
    if (!selection[field.key]) return;
    updates[field.key] = fields[field.key] ?? '';
  });

  if (selection.medicines && Array.isArray(fields.medicines) && fields.medicines.length > 0) {
    let draftId = nextDraftId;
    const mapped = fields.medicines.map((med) => {
      const entry = { ...med, draftId };
      draftId += 1;
      return entry;
    });
    updates.prescribedMeds = [...prescribedMeds, ...mapped];
    updates.nextDraftId = draftId;
  }

  if (narrativeTranscript) {
    updates.narrativeTranscript = narrativeTranscript;
  }

  return updates;
}
