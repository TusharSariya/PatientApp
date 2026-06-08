export const EXTRACT_VISIT_TOOL_NAME = 'extract_visit';

export function getExtractVisitParametersSchema() {
  return {
    type: 'object',
    properties: {
      visitDate: { type: 'string', description: 'ISO date YYYY-MM-DD if mentioned' },
      complaints: { type: 'string', description: 'Chief complaints' },
      findings: { type: 'string', description: 'Clinical findings' },
      bp: { type: 'string', description: 'Blood pressure like 120/80' },
      weight: { type: 'string', description: 'Weight number only' },
      weightUnit: { type: 'string', enum: ['kg', 'lbs'] },
      investigations: { type: 'string' },
      procedures: { type: 'string' },
      diagnosis: { type: 'string' },
      notes: { type: 'string' },
      visitCost: { type: 'string', description: 'Visit fee amount' },
      paymentAmount: { type: 'string', description: 'Payment collected' },
      paymentScope: { type: 'string', enum: ['patient', 'family'] },
      medicines: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            dosage: { type: 'string' },
            frequency: { type: 'string' },
            intervalDays: { type: 'number' },
            duration: { type: 'string', description: 'Days as 1-3 digit string' },
            route: { type: 'string' },
            instructions: { type: 'string' },
          },
          required: ['name'],
        },
      },
    },
    required: [],
  };
}

export function getExtractVisitToolDefinition() {
  return {
    name: EXTRACT_VISIT_TOOL_NAME,
    description: 'Extract structured clinic visit data from the dictated encounter.',
    parametersJson: JSON.stringify(getExtractVisitParametersSchema()),
  };
}

export function createEmptyExtractedVisit() {
  return {
    visitDate: '',
    complaints: '',
    findings: '',
    bp: '',
    weight: '',
    weightUnit: 'kg',
    investigations: '',
    procedures: '',
    diagnosis: '',
    notes: '',
    visitCost: '',
    paymentAmount: '',
    paymentScope: 'patient',
    medicines: [],
  };
}
