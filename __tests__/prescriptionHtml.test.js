const { formatMoney } = require('../src/currency');
const {
  escapeHtml,
  formatVisitDateDisplay,
  formatMedicineLine,
  buildPrescriptionHtml,
} = require('../src/prescriptionHtml');

describe('prescriptionHtml', () => {
  test('escapeHtml escapes special characters', () => {
    expect(escapeHtml('<script>&"\'</script>')).toBe(
      '&lt;script&gt;&amp;&quot;&#39;&lt;/script&gt;'
    );
    expect(escapeHtml(null)).toBe('');
  });

  test('formatVisitDateDisplay converts ISO date to DD/MM/YYYY', () => {
    expect(formatVisitDateDisplay('2026-04-30')).toBe('30/04/2026');
    expect(formatVisitDateDisplay('')).toBe('—');
  });

  test('formatMedicineLine combines visit_medicine fields', () => {
    const line = formatMedicineLine({
      name: 'Tab. Paracetamol',
      dosage: '500 mg',
      route: 'Oral',
      frequency: '4x/day',
      duration: '5 days',
      interval_days: 1,
      instructions: 'Take with food',
    });
    expect(line).toContain('Tab. Paracetamol');
    expect(line).toContain('500 mg');
    expect(line).toContain('/ Oral');
    expect(line).toContain('Take with food');
  });

  test('buildPrescriptionHtml includes escaped patient name and diagnosis', () => {
    const html = buildPrescriptionHtml({
      patient: { id: 42, name: 'Mr <Evil> Test' },
      visit: { visit_date: '2026-01-15', diagnosis: 'URI', visit_cost: 180 },
      medicines: [{ name: 'Med A', dosage: '10mg', frequency: '', interval_days: 1, duration: '', route: 'Oral', instructions: '' }],
      clinic: { doctorName: 'Dr Good', qualifications: '', address: '', contact: '', registration: '', hours: '' },
      patientBalance: 12.5,
      currencyCode: 'USD',
    });
    expect(html).toContain('Mr &lt;Evil&gt; Test');
    expect(html).not.toContain('Mr <Evil>');
    expect(html).toContain('URI');
    expect(html).toContain('Card No :-');
    expect(html).toContain('42');
    expect(html).toContain('15/01/2026');
    expect(html).toContain('Med A');
    expect(html).toContain('Visit Cost :-');
    expect(html).toContain(escapeHtml(formatMoney(180, 'USD')));
    expect(html).toContain(escapeHtml(formatMoney(12.5, 'USD')));
  });

  test('buildPrescriptionHtml uses INR by default', () => {
    const html = buildPrescriptionHtml({
      patient: { id: 1, name: 'A' },
      visit: { visit_date: '2026-05-01', diagnosis: '', visit_cost: 200 },
      medicines: [],
      clinic: {},
      patientBalance: 50,
    });
    expect(html).toContain(escapeHtml(formatMoney(200, 'INR')));
    expect(html).toContain(escapeHtml(formatMoney(50, 'INR')));
  });

  test('buildPrescriptionHtml shows empty treatment message when no medicines', () => {
    const html = buildPrescriptionHtml({
      patient: { id: 1, name: 'A' },
      visit: { visit_date: '2026-05-01', diagnosis: '—' },
      medicines: [],
      clinic: {},
      patientBalance: 0,
    });
    expect(html).toContain('No medicines recorded for this visit.');
  });
});
