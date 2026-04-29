import { formatPatientNameParts, splitPatientName } from '../src/patientName';

describe('patientName utilities', () => {
  describe('formatPatientNameParts', () => {
    test('joins and trims all parts', () => {
      expect(formatPatientNameParts('  John  ', '  Quincy ', ' Adams ')).toBe('John Quincy Adams');
    });

    test('skips empty parts', () => {
      expect(formatPatientNameParts('Alice', '', 'Johnson')).toBe('Alice Johnson');
      expect(formatPatientNameParts('Alice', '   ', 'Johnson')).toBe('Alice Johnson');
    });

    test('handles nullish values', () => {
      expect(formatPatientNameParts(undefined, null, 'Nguyen')).toBe('Nguyen');
    });
  });

  describe('splitPatientName', () => {
    test('returns empty parts for empty input', () => {
      expect(splitPatientName('')).toEqual({ firstName: '', middleName: '', lastName: '' });
      expect(splitPatientName('   ')).toEqual({ firstName: '', middleName: '', lastName: '' });
      expect(splitPatientName(null)).toEqual({ firstName: '', middleName: '', lastName: '' });
    });

    test('splits one-part names', () => {
      expect(splitPatientName('Prince')).toEqual({ firstName: 'Prince', middleName: '', lastName: '' });
    });

    test('splits two-part names', () => {
      expect(splitPatientName('Jane Doe')).toEqual({ firstName: 'Jane', middleName: '', lastName: 'Doe' });
    });

    test('splits multi-part names into first/middle/last', () => {
      expect(splitPatientName('Mary Ann Elizabeth Smith')).toEqual({
        firstName: 'Mary',
        middleName: 'Ann Elizabeth',
        lastName: 'Smith',
      });
    });

    test('normalizes extra whitespace while splitting', () => {
      expect(splitPatientName('  Bob   Alan   Ross  ')).toEqual({
        firstName: 'Bob',
        middleName: 'Alan',
        lastName: 'Ross',
      });
    });
  });
});
