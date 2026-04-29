jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

function expectedPatientColumns() {
  return [
    { name: 'first_name' },
    { name: 'middle_name' },
    { name: 'last_name' },
  ];
}

function createMockDb() {
  return {
    execAsync: jest.fn().mockResolvedValue(undefined),
    getAllAsync: jest.fn(async (sql) => {
      if (sql.includes('PRAGMA table_info(patients)')) {
        return expectedPatientColumns();
      }
      return [];
    }),
    getFirstAsync: jest.fn().mockResolvedValue({ count: 0 }),
    runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
  };
}

async function loadDatabaseModule({ dev = false, db } = {}) {
  jest.resetModules();
  global.__DEV__ = dev;
  const SQLite = require('expo-sqlite');
  SQLite.openDatabaseAsync.mockResolvedValue(db);
  const database = require('../src/database');
  return { database, SQLite };
}

describe('database', () => {
  test('initializes sqlite schema once and caches db instance', async () => {
    const db = createMockDb();
    const { database, SQLite } = await loadDatabaseModule({ dev: false, db });

    const first = await database.getDb();
    const second = await database.getDb();

    expect(first).toBe(db);
    expect(second).toBe(db);
    expect(SQLite.openDatabaseAsync).toHaveBeenCalledTimes(1);
    expect(SQLite.openDatabaseAsync).toHaveBeenCalledWith('patients.db');
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS patients'));
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS medicine_history'));
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS gestures'));
  });

  test('addPatient inserts trimmed name parts and returns row id', async () => {
    const db = createMockDb();
    db.runAsync.mockResolvedValueOnce({ lastInsertRowId: 77 });
    const { database } = await loadDatabaseModule({ dev: false, db });

    const id = await database.addPatient('John', 'Q', 'Public', '555', '1 Main');

    expect(id).toBe(77);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO patients'),
      ['John', 'Q', 'Public', '555', '1 Main']
    );
  });

  test('searchPatients builds prefix SQL with ordering and normalized params', async () => {
    const db = createMockDb();
    db.getAllAsync.mockImplementation(async (sql, params) => {
      if (sql.includes('PRAGMA table_info(patients)')) return expectedPatientColumns();
      if (sql.includes('WHERE')) {
        expect(sql).toContain('first_name LIKE ? COLLATE NOCASE');
        expect(sql).toContain('last_name LIKE ? COLLATE NOCASE');
        expect(params).toEqual(['Al%', 'Sm%', 'Al', 'Sm']);
        return [{ id: 1, name: 'Alice Smith' }];
      }
      return [];
    });
    const { database } = await loadDatabaseModule({ dev: false, db });

    const rows = await database.searchPatients({
      firstName: '  Al ',
      middleName: '',
      lastName: ' Sm ',
    });

    expect(rows).toEqual([{ id: 1, name: 'Alice Smith' }]);
  });

  test('searchPatients returns full list when no filters are provided', async () => {
    const db = createMockDb();
    db.getAllAsync.mockImplementation(async (sql) => {
      if (sql.includes('PRAGMA table_info(patients)')) return expectedPatientColumns();
      if (sql.includes('FROM patients')) {
        expect(sql).toContain('ORDER BY');
        return [{ id: 1, name: 'Alice Johnson' }, { id: 2, name: 'Bob Smith' }];
      }
      return [];
    });
    const { database } = await loadDatabaseModule({ dev: false, db });

    const rows = await database.searchPatients({});
    expect(rows).toHaveLength(2);
  });

  test('medicine helpers read, insert, delete, and history medicines', async () => {
    const db = createMockDb();
    db.getAllAsync.mockImplementation(async (sql, params) => {
      if (sql.includes('PRAGMA table_info(patients)')) return expectedPatientColumns();
      if (sql.includes('FROM medicines')) {
        expect(params).toEqual([99]);
        return [{ id: 1, patient_id: 99, name: 'Ibuprofen' }];
      }
      if (sql.includes('FROM medicine_history')) {
        expect(params).toEqual([99]);
        return [{ id: 10, patient_id: 99, name: 'Ibuprofen', action: 'removed' }];
      }
      return [];
    });
    db.getFirstAsync.mockResolvedValue({
      id: 42,
      patient_id: 99,
      name: 'Ibuprofen',
      dosage: '',
      frequency: '',
      duration: '',
      route: '',
      instructions: '',
    });
    db.runAsync
      .mockResolvedValueOnce({ lastInsertRowId: 42, changes: 1 })
      .mockResolvedValueOnce({ lastInsertRowId: 43, changes: 1 })
      .mockResolvedValueOnce({ lastInsertRowId: 0, changes: 1 })
      .mockResolvedValueOnce({ lastInsertRowId: 44, changes: 1 });
    const { database } = await loadDatabaseModule({ dev: false, db });

    const meds = await database.getMedicines(99);
    const medId = await database.addMedicine(99, { name: 'Ibuprofen' });
    await database.deleteMedicine(medId);
    const history = await database.getMedicineHistory(99);

    expect(meds).toEqual([{ id: 1, patient_id: 99, name: 'Ibuprofen' }]);
    expect(medId).toBe(42);
    expect(history).toEqual([{ id: 10, patient_id: 99, name: 'Ibuprofen', action: 'removed' }]);

    expect(db.runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO medicines'),
      [99, 'Ibuprofen', '', '', '', '', '']
    );
    expect(db.runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO medicine_history'),
      [99, 42, 'Ibuprofen', '', '', '', '', '', 'added']
    );
    expect(db.runAsync).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('DELETE FROM medicines'),
      [42]
    );
    expect(db.runAsync).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('INSERT INTO medicine_history'),
      [99, 42, 'Ibuprofen', '', '', '', '', '', 'removed']
    );
    expect(db.getFirstAsync).toHaveBeenCalledWith('SELECT * FROM medicines WHERE id = ?', [42]);
  });

  test('gesture helpers list, insert, and delete gestures', async () => {
    const db = createMockDb();
    db.getAllAsync.mockImplementation(async (sql) => {
      if (sql.includes('PRAGMA table_info(patients)')) return expectedPatientColumns();
      if (sql.includes('FROM gestures')) return [{ id: 1, word: 'cold', data: '{}' }];
      return [];
    });
    db.runAsync.mockResolvedValue({ lastInsertRowId: 5, changes: 1 });
    const { database } = await loadDatabaseModule({ dev: false, db });

    const gestures = await database.getGestures();
    const id = await database.addGesture('cold', '{}');
    await database.deleteGesture(id);

    expect(gestures).toEqual([{ id: 1, word: 'cold', data: '{}' }]);
    expect(id).toBe(5);
    expect(db.runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO gestures'),
      ['cold', '{}']
    );
    expect(db.runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('DELETE FROM gestures'),
      [5]
    );
  });
});
