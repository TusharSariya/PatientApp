jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

function expectedPatientColumns() {
  return [
    { name: 'first_name' },
    { name: 'middle_name' },
    { name: 'last_name' },
    { name: 'dob' },
    { name: 'family_id' },
    { name: 'phone' },
    { name: 'address' },
    { name: 'notes' },
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
  test('concurrent getDb calls share one initialization', async () => {
    const db = createMockDb();
    let releaseOpen;
    const openGate = new Promise((resolve) => {
      releaseOpen = () => resolve(db);
    });
    const { database, SQLite } = await loadDatabaseModule({ dev: true, db });
    SQLite.openDatabaseAsync.mockImplementation(() => openGate);

    const pendingA = database.getDb();
    const pendingB = database.getDb();
    expect(SQLite.openDatabaseAsync).toHaveBeenCalledTimes(1);
    releaseOpen();
    const [first, second] = await Promise.all([pendingA, pendingB]);

    expect(first).toBe(second);
    expect(first).toBe(db);
  });

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
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS clinic_profile'));
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS app_settings'));
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS draft_visits'));
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('follow_up_mode TEXT'));
    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('follow_up_date TEXT'));
  });

  test('seeds dev mock patients when sqlite COUNT returns a string zero', async () => {
    const db = createMockDb();
    db.getFirstAsync.mockImplementation(async (sql) => {
      if (sql.includes('COUNT(*) AS count FROM patients')) return { count: '0' };
      if (sql.includes('COUNT(*) AS count FROM visits')) return { count: '0' };
      if (sql.includes('FROM clinic_profile')) return { doctor_name: '' };
      if (sql.includes('PRAGMA table_info(patients)')) return expectedPatientColumns();
      if (sql.includes('FROM patients ORDER BY id ASC LIMIT 2')) return [];
      return { count: 0 };
    });
    let familyId = 1;
    db.runAsync.mockImplementation(async (sql) => {
      if (sql.includes('INSERT INTO families')) {
        const id = familyId;
        familyId += 1;
        return { lastInsertRowId: id, changes: 1 };
      }
      return { lastInsertRowId: familyId, changes: 1 };
    });
    const { database } = await loadDatabaseModule({ dev: true, db });

    await database.getDb();

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO patients'),
      expect.arrayContaining(['Alice', 'Marie', 'Johnson'])
    );
  });

  test('backfills missing dev mock patients after a partial seed', async () => {
    const db = createMockDb();
    const existingPatients = [
      { id: 1, first_name: 'Alice', last_name: 'Johnson' },
      { id: 2, first_name: 'Bob', last_name: 'Martinez' },
    ];
    db.getFirstAsync.mockImplementation(async (sql, params) => {
      if (sql.includes('COUNT(*) AS count FROM patients')) return { count: 2 };
      if (sql.includes('COUNT(*) AS count FROM visits')) return { count: 0 };
      if (sql.includes('COUNT(*) AS count FROM medicines')) return { count: 3 };
      if (sql.includes('FROM clinic_profile')) return { doctor_name: '' };
      if (sql.includes('PRAGMA table_info(patients)')) return expectedPatientColumns();
      if (sql.includes('SELECT id FROM patients WHERE first_name = ? AND last_name = ?')) {
        const match = existingPatients.find(
          (p) => p.first_name === params[0] && p.last_name === params[1]
        );
        return match ? { id: match.id } : null;
      }
      if (sql.includes('FROM patients ORDER BY id ASC LIMIT 2')) {
        return existingPatients.map((p) => ({ id: p.id, family_id: 1 }));
      }
      return { count: 0 };
    });
    let familyId = 10;
    db.runAsync.mockImplementation(async (sql) => {
      if (sql.includes('INSERT INTO families')) {
        const id = familyId;
        familyId += 1;
        return { lastInsertRowId: id, changes: 1 };
      }
      return { lastInsertRowId: 3, changes: 1 };
    });
    const { database } = await loadDatabaseModule({ dev: true, db });

    await database.getDb();

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO patients'),
      expect.arrayContaining(['Carol', 'Anh', 'Nguyen'])
    );
    expect(db.runAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO patients'),
      expect.arrayContaining(['Alice', 'Marie', 'Johnson'])
    );
  });

  test('getAppSettings returns INR by default', async () => {
    const db = createMockDb();
    db.getFirstAsync.mockImplementation(async (sql) => {
      if (sql.includes('FROM app_settings')) {
        return { id: 1, currency_code: 'INR', default_input_mode: 'gestures' };
      }
      if (sql.includes('PRAGMA table_info(patients)')) return expectedPatientColumns();
      return { count: 0 };
    });
    const { database } = await loadDatabaseModule({ dev: false, db });

    const settings = await database.getAppSettings();
    expect(settings).toEqual({
      currencyCode: 'INR',
      defaultInputMode: 'gestures',
      gemmaModelVariant: 'e2b',
      gemmaModelDownloaded: false,
    });
  });

  test('saveAppSettings updates currency_code and preserves input mode', async () => {
    const db = createMockDb();
    db.getFirstAsync.mockImplementation(async (sql) => {
      if (sql.includes('FROM app_settings')) {
        return { id: 1, currency_code: 'INR', default_input_mode: 'voice' };
      }
      if (sql.includes('PRAGMA table_info(patients)')) return expectedPatientColumns();
      return { count: 0 };
    });
    db.runAsync.mockResolvedValue({ changes: 1 });
    const { database } = await loadDatabaseModule({ dev: false, db });

    const settings = await database.saveAppSettings({ currencyCode: 'USD' });
    expect(settings).toEqual({
      currencyCode: 'USD',
      defaultInputMode: 'voice',
      gemmaModelVariant: 'e2b',
      gemmaModelDownloaded: false,
    });
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE app_settings'),
      ['USD', 'voice', 'e2b', 0]
    );
  });

  test('saveAppSettings updates input mode and preserves currency_code', async () => {
    const db = createMockDb();
    db.getFirstAsync.mockImplementation(async (sql) => {
      if (sql.includes('FROM app_settings')) {
        return { id: 1, currency_code: 'USD', default_input_mode: 'gestures' };
      }
      if (sql.includes('PRAGMA table_info(patients)')) return expectedPatientColumns();
      return { count: 0 };
    });
    db.runAsync.mockResolvedValue({ changes: 1 });
    const { database } = await loadDatabaseModule({ dev: false, db });

    const settings = await database.saveAppSettings({ defaultInputMode: 'keyboard' });

    expect(settings).toEqual({
      currencyCode: 'USD',
      defaultInputMode: 'keyboard',
      gemmaModelVariant: 'e2b',
      gemmaModelDownloaded: false,
    });
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE app_settings'),
      ['USD', 'keyboard', 'e2b', 0]
    );
  });

  test('app settings normalize invalid input mode to gestures', async () => {
    const db = createMockDb();
    db.getFirstAsync.mockImplementation(async (sql) => {
      if (sql.includes('FROM app_settings')) {
        return { id: 1, currency_code: 'USD', default_input_mode: 'unknown' };
      }
      if (sql.includes('PRAGMA table_info(patients)')) return expectedPatientColumns();
      return { count: 0 };
    });
    const { database } = await loadDatabaseModule({ dev: false, db });

    const settings = await database.getAppSettings();

    expect(settings).toEqual({
      currencyCode: 'USD',
      defaultInputMode: 'gestures',
      gemmaModelVariant: 'e2b',
      gemmaModelDownloaded: false,
    });
  });

  test('adds default input mode column for existing app settings tables', async () => {
    const db = createMockDb();
    db.getAllAsync.mockImplementation(async (sql) => {
      if (sql.includes('PRAGMA table_info(patients)')) return expectedPatientColumns();
      if (sql.includes('PRAGMA table_info(app_settings)')) return [{ name: 'currency_code' }];
      return [];
    });
    const { database } = await loadDatabaseModule({ dev: false, db });
    await database.getDb();

    expect(db.execAsync).toHaveBeenCalledWith("ALTER TABLE app_settings ADD COLUMN default_input_mode TEXT NOT NULL DEFAULT 'gestures';");
  });

  test('adds gemma settings columns when saving app settings on legacy tables', async () => {
    const db = createMockDb();
    db.getAllAsync.mockImplementation(async (sql) => {
      if (sql.includes('PRAGMA table_info(patients)')) return expectedPatientColumns();
      if (sql.includes('PRAGMA table_info(app_settings)')) {
        return [{ name: 'currency_code' }, { name: 'default_input_mode' }];
      }
      return [];
    });
    db.getFirstAsync.mockImplementation(async (sql) => {
      if (sql.includes('FROM app_settings')) {
        return { id: 1, currency_code: 'INR', default_input_mode: 'gestures' };
      }
      if (sql.includes('PRAGMA table_info(patients)')) return expectedPatientColumns();
      return { count: 0 };
    });
    const { database } = await loadDatabaseModule({ dev: false, db });

    await database.saveAppSettings({ gemmaModelDownloaded: true });

    expect(db.execAsync).toHaveBeenCalledWith("ALTER TABLE app_settings ADD COLUMN gemma_model_variant TEXT NOT NULL DEFAULT 'e2b';");
    expect(db.execAsync).toHaveBeenCalledWith('ALTER TABLE app_settings ADD COLUMN gemma_model_downloaded INTEGER NOT NULL DEFAULT 0;');
  });

  test('saveAppSettings persists expanded on-device model variant ids', async () => {
    const db = createMockDb();
    db.getFirstAsync.mockImplementation(async (sql) => {
      if (sql.includes('FROM app_settings')) {
        return {
          id: 1,
          currency_code: 'INR',
          default_input_mode: 'gestures',
          gemma_model_variant: 'e2b',
          gemma_model_downloaded: 0,
        };
      }
      if (sql.includes('PRAGMA table_info(app_settings)')) {
        return [
          { name: 'currency_code' },
          { name: 'default_input_mode' },
          { name: 'gemma_model_variant' },
          { name: 'gemma_model_downloaded' },
        ];
      }
      return { count: 0 };
    });
    const { database } = await loadDatabaseModule({ dev: false, db });

    const saved = await database.saveAppSettings({ gemmaModelVariant: 'gemma3n-e2b' });

    expect(saved.gemmaModelVariant).toBe('gemma3n-e2b');
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('gemma_model_variant'),
      expect.arrayContaining(['gemma3n-e2b'])
    );
  });

  test('addPatient inserts patient and uses existing family id when provided', async () => {
    const db = createMockDb();
    db.getFirstAsync.mockImplementation(async (sql, params) => {
      if (sql.includes('SELECT id FROM families WHERE id = ?')) {
        return { id: params[0] };
      }
      return { count: 0 };
    });
    db.runAsync.mockResolvedValueOnce({ lastInsertRowId: 77 });
    const { database } = await loadDatabaseModule({ dev: false, db });

    const result = await database.addPatient('John', 'Q', 'Public', '2000-01-01', '555', '1 Main', '12');

    expect(result).toEqual({ patientId: 77, familyId: 12, createdNewFamily: false });
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO patients'),
      ['John', 'Q', 'Public', '2000-01-01', 12, '555', '1 Main']
    );
  });

  test('addPatient creates a new family when no family id is provided', async () => {
    const db = createMockDb();
    db.runAsync
      .mockResolvedValueOnce({ lastInsertRowId: 45, changes: 1 })
      .mockResolvedValueOnce({ lastInsertRowId: 88, changes: 1 });
    const { database } = await loadDatabaseModule({ dev: false, db });

    const result = await database.addPatient('Jane', '', 'Public', '1999-12-31', '555', '2 Main', '');

    expect(result).toEqual({ patientId: 88, familyId: 45, createdNewFamily: true });
    expect(db.runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO families')
    );
    expect(db.runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO patients'),
      ['Jane', '', 'Public', '1999-12-31', 45, '555', '2 Main']
    );
  });

  test('updatePatient persists demographics contact fields and notes', async () => {
    const db = createMockDb();
    const { database } = await loadDatabaseModule({ dev: false, db });

    await database.updatePatient(7, {
      firstName: 'Jane',
      middleName: 'Q',
      lastName: 'Public',
      dob: '2000-01-01',
      phone: '',
      address: '',
      notes: 'Follow-up notes',
    });

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE patients'),
      ['Jane', 'Q', 'Public', '2000-01-01', '', '', 'Follow-up notes', 7]
    );
  });

  test('updatePatientFamily moves patient with zero balance to an existing family', async () => {
    const db = createMockDb();
    db.getFirstAsync.mockImplementation(async (sql, params) => {
      if (sql.includes('SELECT id, family_id FROM patients WHERE id = ?')) {
        return { id: params[0], family_id: 4 };
      }
      if (sql.includes('SELECT id FROM families WHERE id = ?')) {
        return { id: params[0] };
      }
      if (sql.includes('SUM(visit_cost)') || sql.includes('SUM(amount)')) {
        return { total: 0 };
      }
      return { count: 0 };
    });
    const { database } = await loadDatabaseModule({ dev: false, db });

    const result = await database.updatePatientFamily(7, '12');

    expect(result).toEqual({ familyId: 12, changed: true });
    expect(db.runAsync).toHaveBeenCalledWith(
      'UPDATE patients SET family_id = ? WHERE id = ?',
      [12, 7]
    );
    expect(db.runAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE payments'),
      expect.anything()
    );
  });

  test('updatePatientFamily blocks moving families with nonzero patient balance', async () => {
    const db = createMockDb();
    db.getFirstAsync.mockImplementation(async (sql, params) => {
      if (sql.includes('SELECT id, family_id FROM patients WHERE id = ?')) {
        return { id: params[0], family_id: 4 };
      }
      if (sql.includes('SELECT id FROM families WHERE id = ?')) {
        return { id: params[0] };
      }
      if (sql.includes('FROM visits WHERE patient_id = ?')) {
        return { total: 100 };
      }
      if (sql.includes("scope = 'patient'")) {
        return { total: 25 };
      }
      if (sql.includes('SUM(v.visit_cost)') || sql.includes('WHERE family_id = ?')) {
        return { total: 0 };
      }
      return { count: 0 };
    });
    const { database } = await loadDatabaseModule({ dev: false, db });

    await expect(database.updatePatientFamily(7, '12')).rejects.toThrow(
      'Patient balance must be zero before moving to another family.'
    );
    expect(db.runAsync).not.toHaveBeenCalledWith(
      'UPDATE patients SET family_id = ? WHERE id = ?',
      expect.anything()
    );
  });

  test('updatePatientFamily allows patient without a family to join any existing family', async () => {
    const db = createMockDb();
    db.getFirstAsync.mockImplementation(async (sql, params) => {
      if (sql.includes('SELECT id, family_id FROM patients WHERE id = ?')) {
        return { id: params[0], family_id: null };
      }
      if (sql.includes('SELECT id FROM families WHERE id = ?')) {
        return { id: params[0] };
      }
      return { count: 0 };
    });
    const { database } = await loadDatabaseModule({ dev: false, db });

    const result = await database.updatePatientFamily(7, '12');

    expect(result).toEqual({ familyId: 12, changed: true });
    expect(db.runAsync).toHaveBeenCalledWith(
      'UPDATE patients SET family_id = ? WHERE id = ?',
      [12, 7]
    );
  });

  test('updatePatientFamily rejects nonexistent target family', async () => {
    const db = createMockDb();
    db.getFirstAsync.mockImplementation(async (sql, params) => {
      if (sql.includes('SELECT id, family_id FROM patients WHERE id = ?')) {
        return { id: params[0], family_id: null };
      }
      if (sql.includes('SELECT id FROM families WHERE id = ?')) {
        return null;
      }
      return { count: 0 };
    });
    const { database } = await loadDatabaseModule({ dev: false, db });

    await expect(database.updatePatientFamily(7, '12')).rejects.toThrow('Family ID 12 does not exist.');
    expect(db.runAsync).not.toHaveBeenCalledWith(
      'UPDATE patients SET family_id = ? WHERE id = ?',
      expect.anything()
    );
  });

  test('adds patient notes column for existing databases', async () => {
    const db = createMockDb();
    db.getAllAsync.mockImplementation(async (sql) => {
      if (sql.includes('PRAGMA table_info(patients)')) {
        return expectedPatientColumns().filter((column) => column.name !== 'notes');
      }
      return [];
    });
    const { database } = await loadDatabaseModule({ dev: false, db });
    await database.getDb();

    expect(db.execAsync).toHaveBeenCalledWith("ALTER TABLE patients ADD COLUMN notes TEXT NOT NULL DEFAULT '';");
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
      [99, 'Ibuprofen', '', '', 1, '', '', '']
    );
    expect(db.runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO medicine_history'),
      [99, 42, 'Ibuprofen', '', '', 1, '', '', '', 'added']
    );
    expect(db.runAsync).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('DELETE FROM medicines'),
      [42]
    );
    expect(db.runAsync).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('INSERT INTO medicine_history'),
      [99, 42, 'Ibuprofen', '', '', 1, '', '', '', 'removed']
    );
    expect(db.getFirstAsync).toHaveBeenCalledWith('SELECT * FROM medicines WHERE id = ?', [42]);
  });

  test('getClinicProfile and saveClinicProfile read and update singleton row', async () => {
    const db = createMockDb();
    db.getFirstAsync.mockImplementation(async (sql) => {
      if (sql.includes('FROM clinic_profile')) {
        return {
          id: 1,
          doctor_name: 'Dr A',
          qualifications: 'MBBS',
          address: '1 Main St',
          contact: '555',
          registration: 'Reg 1',
          hours: '9–5',
        };
      }
      return { count: 0 };
    });
    db.runAsync.mockResolvedValue({ changes: 1 });
    const { database } = await loadDatabaseModule({ dev: false, db });

    const profile = await database.getClinicProfile();
    expect(profile).toEqual({
      doctorName: 'Dr A',
      qualifications: 'MBBS',
      address: '1 Main St',
      contact: '555',
      registration: 'Reg 1',
      hours: '9–5',
    });

    await database.saveClinicProfile({
      doctorName: 'Dr B',
      qualifications: 'MD',
      address: '2 Oak',
      contact: 'x',
      registration: 'r',
      hours: 'h',
    });
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE clinic_profile'),
      ['Dr B', 'MD', '2 Oak', 'x', 'r', 'h']
    );
  });

  test('getVisitsInDateRange joins patients and filters by visit_date', async () => {
    const db = createMockDb();
    const rows = [
      {
        id: 1,
        patient_id: 9,
        visit_date: '2026-05-02',
        complaints: 'Fever',
        diagnosis: 'URI',
        visit_cost: 120,
        patient_name: 'Bob Smith',
        medicine_count: 2,
      },
    ];
    db.getAllAsync.mockImplementation(async (sql, params) => {
      if (sql.includes('PRAGMA table_info(patients)')) return expectedPatientColumns();
      if (sql.includes('FROM visits v') && sql.includes('visit_date >=')) {
        expect(params).toEqual(['2026-05-01', '2026-05-31']);
        return rows;
      }
      return [];
    });
    const { database } = await loadDatabaseModule({ dev: false, db });

    const visits = await database.getVisitsInDateRange({
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    });

    expect(visits).toEqual(rows);
    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('INNER JOIN patients p ON p.id = v.patient_id'),
      ['2026-05-01', '2026-05-31']
    );
  });

  test('draft visit helpers save, parse, and clear patient drafts', async () => {
    const db = createMockDb();
    db.getFirstAsync.mockImplementation(async (sql, params) => {
      if (sql.includes('FROM draft_visits')) {
        expect(params).toEqual([9]);
        return {
          patient_id: 9,
          visit_date: '2026-05-20',
          complaints: 'Cough',
          diagnosis: 'URI',
          investigations: '',
          procedures: '',
          findings: '',
          bp: '120/80',
          weight: '72',
          weight_unit: 'kg',
          notes: 'Review',
          visit_cost: '150',
          payment_amount: '25',
          payment_scope: 'family',
          follow_up_mode: 'date',
          follow_up_days: '0',
          follow_up_date: '2026-06-03',
          draft_med_json: '{"name":"Azithro","intervalDays":1}',
          medicines_json: '[{"draftId":1,"name":"Paracetamol"}]',
          narrative_transcript: '',
          updated_at: '2026-05-20 10:00:00',
        };
      }
      return { count: 0 };
    });
    const { database } = await loadDatabaseModule({ dev: false, db });

    await database.saveDraftVisit(9, {
      visitDate: '2026-05-20',
      complaints: 'Cough',
      diagnosis: 'URI',
      investigations: '',
      procedures: '',
      findings: '',
      bp: '120/80',
      weight: '72',
      weightUnit: 'kg',
      notes: 'Review',
      visitCost: '150',
      paymentAmount: '25',
      paymentScope: 'family',
      followUpMode: 'date',
      followUpDays: '0',
      followUpDate: '2026-06-03',
      draftMed: { name: 'Azithro', intervalDays: 1 },
      medicines: [{ draftId: 1, name: 'Paracetamol' }],
    });
    const draft = await database.getDraftVisit(9);
    await database.clearDraftVisit(9);

    expect(db.runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO draft_visits'),
      [
        9,
        '2026-05-20',
        'Cough',
        'URI',
        '',
        '',
        '',
        '120/80',
        '72',
        'kg',
        'Review',
        '150',
        '25',
        'family',
        JSON.stringify({ name: 'Azithro', intervalDays: 1 }),
        JSON.stringify([{ draftId: 1, name: 'Paracetamol' }]),
        '',
        'date',
        '0',
        '2026-06-03',
      ]
    );
    expect(draft).toEqual({
      visitDate: '2026-05-20',
      complaints: 'Cough',
      diagnosis: 'URI',
      investigations: '',
      procedures: '',
      findings: '',
      bp: '120/80',
      weight: '72',
      weightUnit: 'kg',
      notes: 'Review',
      visitCost: '150',
      paymentAmount: '25',
      paymentScope: 'family',
      followUpMode: 'date',
      followUpDays: '0',
      followUpDate: '2026-06-03',
      draftMed: { name: 'Azithro', intervalDays: 1 },
      medicines: [{ draftId: 1, name: 'Paracetamol' }],
      narrativeTranscript: '',
      updatedAt: '2026-05-20 10:00:00',
    });
    expect(db.runAsync).toHaveBeenNthCalledWith(
      2,
      'DELETE FROM draft_visits WHERE patient_id = ?',
      [9]
    );
  });

  test('getDraftVisit returns safe defaults for invalid draft json', async () => {
    const db = createMockDb();
    db.getFirstAsync.mockImplementation(async (sql) => {
      if (sql.includes('FROM draft_visits')) {
        return {
          visit_date: '',
          complaints: '',
          diagnosis: '',
          investigations: '',
          procedures: '',
          findings: '',
          bp: '',
          weight: '',
          weight_unit: '',
          notes: '',
          visit_cost: '',
          payment_amount: '',
          payment_scope: 'patient',
          draft_med_json: '{bad',
          medicines_json: '{bad',
        };
      }
      return { count: 0 };
    });
    const { database } = await loadDatabaseModule({ dev: false, db });

    const draft = await database.getDraftVisit(9);

    expect(draft.draftMed).toEqual({});
    expect(draft.medicines).toEqual([]);
    expect(draft.paymentScope).toBe('patient');
  });

  test('getAllPatients returns ordered patient rows', async () => {
    const db = createMockDb();
    db.getAllAsync.mockImplementation(async (sql) => {
      if (sql.includes('PRAGMA table_info(patients)')) return expectedPatientColumns();
      if (sql.includes('FROM patients')) {
        return [{ id: 1, first_name: 'Ann', middle_name: '', last_name: 'Lee', name: 'Ann Lee' }];
      }
      return [];
    });
    const { database } = await loadDatabaseModule({ dev: false, db });

    const patients = await database.getAllPatients();
    expect(patients).toEqual([{ id: 1, first_name: 'Ann', middle_name: '', last_name: 'Lee', name: 'Ann Lee' }]);
  });

  test('searchFamiliesByRelativeName returns matching families', async () => {
    const db = createMockDb();
    db.getAllAsync.mockImplementation(async (sql) => {
      if (sql.includes('PRAGMA table_info(patients)')) return expectedPatientColumns();
      if (sql.includes('FROM ranked')) {
        return [{ family_id: 3, relative_name: 'Ann Lee', member_count: 2 }];
      }
      return [];
    });
    const { database } = await loadDatabaseModule({ dev: false, db });

    const families = await database.searchFamiliesByRelativeName('Lee');
    expect(families).toEqual([{ family_id: 3, relative_name: 'Ann Lee', member_count: 2 }]);
  });

  test('getVisits and getVisitMedicines return visit data', async () => {
    const db = createMockDb();
    db.getAllAsync.mockImplementation(async (sql) => {
      if (sql.includes('PRAGMA table_info(patients)')) return expectedPatientColumns();
      if (sql.includes('FROM visits')) {
        return [{ id: 10, patient_id: 9, visit_date: '2026-05-01', visit_cost: 100 }];
      }
      if (sql.includes('FROM visit_medicines')) {
        return [{ id: 1, visit_id: 10, name: 'Paracetamol' }];
      }
      return [];
    });
    const { database } = await loadDatabaseModule({ dev: false, db });

    const visits = await database.getVisits(9);
    const meds = await database.getVisitMedicines(10);
    expect(visits).toHaveLength(1);
    expect(meds).toHaveLength(1);
  });

  test('addVisit inserts visit, medicines, and optional payment', async () => {
    const db = createMockDb();
    let insertCount = 0;
    db.runAsync.mockImplementation(async () => {
      insertCount += 1;
      return { lastInsertRowId: insertCount, changes: 1 };
    });
    db.getFirstAsync.mockImplementation(async (sql) => {
      if (sql.includes('PRAGMA table_info(patients)')) return expectedPatientColumns();
      if (sql.includes('SELECT id, family_id FROM patients')) {
        return { id: 9, family_id: 2 };
      }
      return { total: 0 };
    });
    const { database } = await loadDatabaseModule({ dev: false, db });

    const visitId = await database.addVisit(9, {
      familyId: 2,
      visitDate: '2026-05-20',
      complaints: 'Fever',
      visitCost: 200,
      paymentAmount: 50,
      paymentScope: 'family',
      followUpMode: 'days',
      followUpDays: 14,
      medicines: [{ name: 'Ibuprofen', dosage: '400mg', intervalDays: 1 }],
    });

    expect(visitId).toBe(1);
    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO visits'), expect.any(Array));
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO visits'),
      expect.arrayContaining(['days', 14, ''])
    );
    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO visit_medicines'), expect.any(Array));
    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO payments'), expect.any(Array));
  });

  test('addPayment skips zero amounts', async () => {
    const db = createMockDb();
    const { database } = await loadDatabaseModule({ dev: false, db });

    const result = await database.addPayment(9, { familyId: 2, amount: 0 });
    expect(result).toBeNull();
    expect(db.runAsync).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO payments'), expect.any(Array));
  });

  test('getBalanceSummary computes patient and family balances', async () => {
    const db = createMockDb();
    db.getFirstAsync.mockImplementation(async (sql) => {
      if (sql.includes('PRAGMA table_info(patients)')) return expectedPatientColumns();
      if (sql.includes('SELECT id, family_id FROM patients')) return { id: 9, family_id: 2 };
      if (sql.includes('FROM visits WHERE patient_id')) return { total: 300 };
      if (sql.includes("scope = 'patient'")) return { total: 100 };
      if (sql.includes('p.family_id')) return { total: 500 };
      if (sql.includes('payments WHERE family_id')) return { total: 150 };
      return { total: 0 };
    });
    const { database } = await loadDatabaseModule({ dev: false, db });

    const summary = await database.getBalanceSummary(9);
    expect(summary.patientBalance).toBe(200);
    expect(summary.familyBalance).toBe(350);
    expect(summary.totalVisitCostPatient).toBe(300);
    expect(summary.totalPaymentsPatient).toBe(100);
  });

  test('gesture helpers list, insert, and delete gestures', async () => {
    const db = createMockDb();
    db.getAllAsync.mockImplementation(async (sql) => {
      if (sql.includes('PRAGMA table_info(patients)')) return expectedPatientColumns();
      if (sql.includes('PRAGMA table_info(gestures)')) {
        return [{ name: 'id' }, { name: 'word' }, { name: 'data' }, { name: 'code' }, { name: 'kind' }, { name: 'symbol' }];
      }
      if (sql.includes('FROM gestures')) return [{ id: 1, word: 'cold', data: '{}' }];
      return [];
    });
    db.runAsync.mockResolvedValue({ lastInsertRowId: 5, changes: 1 });
    const { database } = await loadDatabaseModule({ dev: false, db });

    const gestures = await database.getGestures();
    const glyphId = await database.addGlyphGesture('U', '{"kind":"touch-path-v1"}');
    const expansionId = await database.addExpansion('URI', 'Upper Respiratory Infection');
    await database.deleteGesture(glyphId);
    await database.deleteGesture(expansionId);

    expect(gestures).toEqual([{ id: 1, word: 'cold', data: '{}' }]);
    expect(glyphId).toBe(5);
    expect(expansionId).toBe(5);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO gestures'),
      ['', '{"kind":"touch-path-v1"}', null, 'glyph', 'U']
    );
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO gestures'),
      ['Upper Respiratory Infection', '{}', 'URI', 'expansion', null]
    );
    expect(db.runAsync).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('DELETE FROM gestures'),
      [5]
    );
    expect(db.runAsync).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('DELETE FROM gestures'),
      [5]
    );
  });
});
