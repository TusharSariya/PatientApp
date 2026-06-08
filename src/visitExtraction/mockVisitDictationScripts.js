/**
 * Read-aloud scripts for manual visit dictation testing (__DEV__ reference UI).
 * expectedFields are approximate targets for review-sheet verification only.
 */

export const MOCK_VISIT_DICTATION_SCRIPTS = {
  fullVisit: {
    id: 'fullVisit',
    label: 'Full visit',
    transcript:
      'Visit date June seventh twenty twenty six. Chief complaints: sore throat, dry cough, and low grade fever for three days. Blood pressure one eighteen over seventy six. Weight seventy kilograms. Findings: mild throat erythema, lungs clear, no wheeze. Investigations: rapid strep test and CBC. Procedure: throat swab. Diagnosis: acute pharyngitis. Notes: hydration, rest, follow up in one week if not improving. Visit cost two hundred. Payment collected one hundred fifty, patient scope. Prescribe amoxicillin five hundred milligrams three times daily for seven days, oral, after meals. Also paracetamol six fifty milligrams as needed for fever for five days, oral.',
    expectedFields: {
      visitDate: '2026-06-07',
      complaints: 'sore throat, dry cough, low grade fever',
      bp: '118/76',
      weight: '70',
      weightUnit: 'kg',
      findings: 'mild throat erythema, lungs clear',
      investigations: 'rapid strep test and CBC',
      procedures: 'throat swab',
      diagnosis: 'acute pharyngitis',
      notes: 'hydration, rest, follow up',
      visitCost: '200',
      paymentAmount: '150',
      paymentScope: 'patient',
      medicines: ['Amoxicillin', 'Paracetamol'],
    },
    tips: [
      'Pause briefly after vitals before findings.',
      'Say "patient scope" explicitly for payment scope.',
      'Speak medicine names clearly: amoxicillin, paracetamol.',
    ],
  },
  quickSmoke: {
    id: 'quickSmoke',
    label: 'Quick smoke',
    transcript:
      'Chief complaints: headache and mild fever for two days. Blood pressure one twenty over eighty. Diagnosis: viral fever. Prescribe paracetamol five hundred milligrams twice daily for three days, oral.',
    expectedFields: {
      complaints: 'headache, mild fever',
      bp: '120/80',
      diagnosis: 'viral fever',
      medicines: ['Paracetamol'],
    },
    tips: [
      'Short script for a fast mic and extraction check.',
      'Confirm transcript preview before Stop and Extract.',
    ],
  },
};

export const MOCK_VISIT_DICTATION_SCRIPT_LIST = Object.values(MOCK_VISIT_DICTATION_SCRIPTS);

export function getMockVisitDictationScript(id) {
  return MOCK_VISIT_DICTATION_SCRIPTS[id] ?? MOCK_VISIT_DICTATION_SCRIPTS.fullVisit;
}
