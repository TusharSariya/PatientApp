export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function startOfMonthIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

export function isValidIsoDate(value) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const parsed = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === trimmed;
}

export function formatDateLabel(value) {
  if (!value) return '';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

export function groupVisitsByDate(visits) {
  const sections = [];
  for (const visit of visits) {
    const dateKey = visit.visit_date;
    const last = sections[sections.length - 1];
    if (last?.dateKey === dateKey) {
      last.data.push(visit);
    } else {
      sections.push({ dateKey, data: [visit] });
    }
  }
  return sections.map(({ dateKey, data }) => ({
    title: formatDateLabel(dateKey),
    dateKey,
    data,
  }));
}
