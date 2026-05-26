function parseIsoDateParts(value) {
  const match = `${value ?? ''}`.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function calculateAgeInYears(dob, referenceDate = new Date(Date.now())) {
  const birth = parseIsoDateParts(dob);
  if (!birth) return null;

  const today = {
    year: referenceDate.getFullYear(),
    month: referenceDate.getMonth() + 1,
    day: referenceDate.getDate(),
  };

  const isFutureBirthDate =
    birth.year > today.year ||
    (birth.year === today.year && birth.month > today.month) ||
    (birth.year === today.year && birth.month === today.month && birth.day > today.day);
  if (isFutureBirthDate) return null;

  let age = today.year - birth.year;
  const birthdayHasPassed =
    today.month > birth.month ||
    (today.month === birth.month && today.day >= birth.day);
  if (!birthdayHasPassed) age -= 1;

  return age >= 0 ? age : null;
}

export function formatPatientAge(dob, referenceDate) {
  const age = calculateAgeInYears(dob, referenceDate);
  if (age == null) return null;
  return `Age: ${age} ${age === 1 ? 'year' : 'years'}`;
}
