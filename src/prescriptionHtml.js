/**
 * Builds a print-friendly HTML prescription (replaces legacy .frx layout for mobile).
 */

export function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatVisitDateDisplay(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return '—';
  const trimmed = isoDate.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return trimmed;
}

export function formatMedicineLine(med) {
  const name = med?.name?.trim?.() || '';
  const dosage = med?.dosage?.trim?.() || '';
  const route = med?.route?.trim?.() || '';
  const frequency = med?.frequency?.trim?.() || '';
  const duration = med?.duration?.trim?.() || '';
  const intervalDays = med?.interval_days ?? med?.intervalDays;
  const instructions = med?.instructions?.trim?.() || '';

  const parts = [];
  if (name) parts.push(name);
  if (dosage) parts.push(dosage);
  const head = parts.join(' ');
  const routeBit = route ? ` / ${route}` : '';
  const meta = [frequency, duration && `for ${duration}`, intervalDays ? `q${intervalDays}d` : '']
    .filter(Boolean)
    .join(' · ');

  const lines = [];
  if (head || routeBit) lines.push(`${head}${routeBit}${meta ? `  (${meta})` : ''}`.trim());
  if (instructions) lines.push(instructions);
  return lines.join('\n') || '—';
}

/**
 * @param {object} params
 * @param {{ id: number, name: string }} params.patient
 * @param {object} params.visit — visit row from SQLite
 * @param {object[]} params.medicines — visit_medicines rows
 * @param {{ doctorName: string, qualifications: string, address: string, contact: string, registration: string, hours: string }} params.clinic
 * @param {number} [params.patientBalance]
 */
export function buildPrescriptionHtml({ patient, visit, medicines = [], clinic = {}, patientBalance = 0 }) {
  const c = clinic || {};
  const doctor = escapeHtml(c.doctorName || 'Practice');
  const qual = escapeHtml(c.qualifications || '');
  const addr = escapeHtml(c.address || '');
  const contact = escapeHtml(c.contact || '');
  const reg = escapeHtml(c.registration || '');
  const hours = escapeHtml(c.hours || '');

  const cardNo = escapeHtml(String(patient?.id ?? ''));
  const dt = escapeHtml(formatVisitDateDisplay(visit?.visit_date));
  const ptName = escapeHtml(patient?.name ?? '');
  const diagnosisHtml = escapeHtml((visit?.diagnosis ?? '').trim() || '—').replace(/\n/g, '<br/>');

  const medBlocks = (medicines || []).length
    ? (medicines || [])
        .map((med) => {
          const text = escapeHtml(formatMedicineLine(med)).replace(/\n/g, '<br/>');
          return `<div class="med">${text}</div>`;
        })
        .join('')
    : `<div class="med muted">No medicines recorded for this visit.</div>`;

  const bal = Number(patientBalance ?? 0);
  const balStr = escapeHtml(Number.isFinite(bal) ? bal.toFixed(2) : '0.00');
  const footerDate = dt;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    @page { margin: 16mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11pt;
      color: #111;
      line-height: 1.35;
      margin: 0;
      padding: 0;
    }
    .header { text-align: center; margin-bottom: 8px; }
    .doctor { font-size: 16pt; font-weight: 700; }
    .qual { font-size: 10pt; margin-top: 2px; }
    .meta { font-size: 9.5pt; margin-top: 6px; text-align: left; }
    .meta-right { float: right; text-align: right; max-width: 55%; }
    .rule { border: none; border-top: 1px solid #000; margin: 10px 0 12px; clear: both; }
    .row { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; }
    .label { font-weight: 600; }
    .section { margin-top: 12px; }
    .section-title { font-weight: 700; margin-bottom: 4px; }
    .body-text { white-space: pre-wrap; word-break: break-word; }
    .med {
      margin-bottom: 10px;
      page-break-inside: avoid;
    }
    .muted { color: #555; font-style: italic; }
    .footer { margin-top: 20px; font-size: 10pt; }
    .sig { margin-top: 24px; text-align: right; }
    .sig-line { display: inline-block; border-bottom: 1px solid #000; min-width: 140px; margin-top: 4px; }
    .balance { margin-top: 14px; font-size: 10pt; }
  </style>
</head>
<body>
  <div class="header">
    <div class="doctor">${doctor}</div>
    ${qual ? `<div class="qual">${qual}</div>` : ''}
  </div>
  <div class="meta">
    <div class="meta-right">
      ${reg ? `<div>${reg}</div>` : ''}
      ${hours ? `<div>${hours}</div>` : ''}
    </div>
    ${addr ? `<div>${addr.replace(/\n/g, '<br/>')}</div>` : ''}
    ${contact ? `<div style="margin-top:4px">${contact}</div>` : ''}
  </div>
  <hr class="rule"/>
  <div class="row">
    <div><span class="label">Card No :-</span> ${cardNo}</div>
    <div><span class="label">Dt:-</span> ${dt}</div>
  </div>
  <div style="margin-top:6px"><span class="label">Name :-</span> ${ptName}</div>
  <div class="section">
    <div class="section-title">Diagnosis :-</div>
    <div class="body-text">${diagnosisHtml}</div>
  </div>
  <div class="section">
    <div class="section-title">Treatment :-</div>
    ${medBlocks}
  </div>
  <div class="footer">
    <span class="label">Review on :-</span> / /
  </div>
  <div class="sig">
    <div class="sig-line"></div>
  </div>
  <div class="balance">${footerDate} Bal. = ${balStr} .</div>
</body>
</html>`;
}
