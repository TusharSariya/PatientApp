import * as SQLite from 'expo-sqlite';
import { DEFAULT_CURRENCY_CODE, isValidCurrencyCode } from './currency';
import { DEFAULT_INPUT_MODE, normalizeInputMode } from './inputMode';
import { splitPatientName } from './patientName';

let db;
const appSettingsListeners = new Set();

const MOCK_PATIENTS = [
  { firstName: 'Alice', middleName: 'Marie', lastName: 'Johnson', dob: '1990-02-14', phone: '555-101-2020', address: '12 Maple Ave, Springfield, IL' },
  { firstName: 'Bob', middleName: '', lastName: 'Martinez', dob: '1985-08-23', phone: '555-303-4040', address: '88 Oak Street, Shelbyville, IL' },
  { firstName: 'Carol', middleName: 'Anh', lastName: 'Nguyen', dob: '1993-11-05', phone: '555-505-6060', address: '4 Elm Court, Capital City, IL' },
];

const ALICE_MEDICINES = [
  { name: 'Amoxicillin',  dosage: '500mg', frequency: 'Three times daily', intervalDays: 1, duration: '7 days',  route: 'Oral', instructions: 'Take after meals'  },
  { name: 'Ibuprofen',    dosage: '400mg', frequency: 'Twice daily',       intervalDays: 1, duration: '5 days',  route: 'Oral', instructions: 'Take with food'     },
  { name: 'Loratadine',   dosage: '10mg',  frequency: 'Once daily',        intervalDays: 1, duration: '30 days', route: 'Oral', instructions: ''                   },
];

/** Fictional demo header; seeded in __DEV__ only when clinic_profile.doctor_name is still empty. Prescriptions use getClinicProfile(). */
const MOCK_CLINIC_PROFILE = {
  doctorName: 'Dr. Alex Morgan',
  qualifications: 'MBBS, MD (Family Medicine)',
  address: 'Sample Medical Clinic\n100 Health Way\nDemo City, DC 00000',
  contact: 'Office (555) 010-0199',
  registration: 'Demo registration no. 100000',
  hours: 'Mon–Fri 9:00 AM – 5:00 PM',
};

const PATIENT_NAME_SQL = `
  trim(
    coalesce(first_name, '') ||
    CASE
      WHEN trim(coalesce(middle_name, '')) <> '' THEN ' ' || trim(middle_name)
      ELSE ''
    END ||
    CASE
      WHEN trim(coalesce(last_name, '')) <> '' THEN ' ' || trim(last_name)
      ELSE ''
    END
  )
`;

const PATIENT_SELECT_SQL = `
  SELECT
    id,
    first_name,
    middle_name,
    last_name,
    dob,
    family_id,
    phone,
    address,
    notes,
    ${PATIENT_NAME_SQL} AS name
  FROM patients
`;

const PATIENT_ORDER_SQL = `
  ORDER BY
    last_name COLLATE NOCASE ASC,
    first_name COLLATE NOCASE ASC,
    middle_name COLLATE NOCASE ASC,
    id ASC
`;

async function migratePatientsTable(database) {
  const legacyRows = await database.getAllAsync('SELECT * FROM patients ORDER BY id ASC');

  await database.execAsync(`
    ALTER TABLE patients RENAME TO patients_legacy;
    CREATE TABLE patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      middle_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL,
      dob TEXT NOT NULL DEFAULT '',
      family_id INTEGER,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT ''
    );
  `);

  for (const row of legacyRows) {
    const parsed = splitPatientName(row.name ?? '');
    const firstName = row.first_name?.trim?.() || parsed.firstName;
    const middleName = row.middle_name?.trim?.() || parsed.middleName;
    const lastName = row.last_name?.trim?.() || parsed.lastName;

    await database.runAsync(
      'INSERT INTO patients (id, first_name, middle_name, last_name, dob, family_id, phone, address, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [row.id, firstName, middleName, lastName, row.dob ?? '', row.family_id ?? null, row.phone ?? '', row.address ?? '', row.notes ?? '']
    );
  }

  await database.execAsync('DROP TABLE patients_legacy;');
}

async function ensurePatientsSchema(database) {
  const columns = await database.getAllAsync('PRAGMA table_info(patients)');
  const columnNames = new Set(columns.map(column => column.name));
  const hasExpectedColumns =
    columnNames.has('first_name') &&
    columnNames.has('middle_name') &&
    columnNames.has('last_name') &&
    !columnNames.has('name');

  if (!hasExpectedColumns) {
    await migratePatientsTable(database);
  }
}

async function ensurePatientsDobColumn(database) {
  const columns = await database.getAllAsync('PRAGMA table_info(patients)');
  const columnNames = new Set(columns.map(column => column.name));
  if (!columnNames.has('dob')) {
    await database.execAsync("ALTER TABLE patients ADD COLUMN dob TEXT NOT NULL DEFAULT '';");
  }
}

async function ensurePatientsNotesColumn(database) {
  const columns = await database.getAllAsync('PRAGMA table_info(patients)');
  const columnNames = new Set(columns.map(column => column.name));
  if (!columnNames.has('notes')) {
    await database.execAsync("ALTER TABLE patients ADD COLUMN notes TEXT NOT NULL DEFAULT '';");
  }
}

async function ensureFamiliesSchema(database) {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function ensurePatientsFamilyColumn(database) {
  const columns = await database.getAllAsync('PRAGMA table_info(patients)');
  const columnNames = new Set(columns.map(column => column.name));
  if (!columnNames.has('family_id')) {
    await database.execAsync('ALTER TABLE patients ADD COLUMN family_id INTEGER;');
  }
}

async function ensurePatientFamilyAssignments(database) {
  const rows = await database.getAllAsync('SELECT id, family_id FROM patients ORDER BY id ASC');
  for (const row of rows) {
    if (row.family_id != null) continue;
    const familyInsert = await database.runAsync('INSERT INTO families DEFAULT VALUES');
    await database.runAsync('UPDATE patients SET family_id = ? WHERE id = ?', [familyInsert.lastInsertRowId, row.id]);
  }
}

async function ensureMedicineHistoryBackfill(database) {
  await database.execAsync(`
    INSERT INTO medicine_history (
      patient_id,
      medicine_id,
      name,
      dosage,
      frequency,
      interval_days,
      duration,
      route,
      instructions,
      action
    )
    SELECT
      m.patient_id,
      m.id,
      m.name,
      coalesce(m.dosage, ''),
      coalesce(m.frequency, ''),
      coalesce(m.interval_days, 1),
      coalesce(m.duration, ''),
      coalesce(m.route, ''),
      coalesce(m.instructions, ''),
      'added'
    FROM medicines m
    WHERE NOT EXISTS (
      SELECT 1
      FROM medicine_history h
      WHERE h.medicine_id = m.id AND h.action = 'added'
    );
  `);
}

async function ensureMedicationIntervalColumns(database) {
  const medicineColumns = await database.getAllAsync('PRAGMA table_info(medicines)');
  const medicineNames = new Set(medicineColumns.map(column => column.name));
  if (!medicineNames.has('interval_days')) {
    await database.execAsync('ALTER TABLE medicines ADD COLUMN interval_days INTEGER NOT NULL DEFAULT 1;');
  }

  const historyColumns = await database.getAllAsync('PRAGMA table_info(medicine_history)');
  const historyNames = new Set(historyColumns.map(column => column.name));
  if (!historyNames.has('interval_days')) {
    await database.execAsync('ALTER TABLE medicine_history ADD COLUMN interval_days INTEGER NOT NULL DEFAULT 1;');
  }

  const visitMedColumns = await database.getAllAsync('PRAGMA table_info(visit_medicines)');
  const visitMedNames = new Set(visitMedColumns.map(column => column.name));
  if (!visitMedNames.has('interval_days')) {
    await database.execAsync('ALTER TABLE visit_medicines ADD COLUMN interval_days INTEGER NOT NULL DEFAULT 1;');
  }
}

async function ensureVisitsSchema(database) {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      visit_date TEXT NOT NULL,
      complaints TEXT NOT NULL DEFAULT '',
      diagnosis TEXT NOT NULL DEFAULT '',
      investigations TEXT NOT NULL DEFAULT '',
      procedures TEXT NOT NULL DEFAULT '',
      findings TEXT NOT NULL DEFAULT '',
      bp TEXT NOT NULL DEFAULT '',
      weight TEXT NOT NULL DEFAULT '',
      weight_unit TEXT NOT NULL DEFAULT 'kg',
      notes TEXT NOT NULL DEFAULT '',
      visit_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS visit_medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      dosage TEXT NOT NULL DEFAULT '',
      frequency TEXT NOT NULL DEFAULT '',
      duration TEXT NOT NULL DEFAULT '',
      route TEXT NOT NULL DEFAULT '',
      instructions TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      family_id INTEGER NOT NULL,
      visit_id INTEGER,
      amount REAL NOT NULL,
      scope TEXT NOT NULL DEFAULT 'patient',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS draft_visits (
      patient_id INTEGER PRIMARY KEY,
      visit_date TEXT NOT NULL DEFAULT '',
      complaints TEXT NOT NULL DEFAULT '',
      diagnosis TEXT NOT NULL DEFAULT '',
      investigations TEXT NOT NULL DEFAULT '',
      procedures TEXT NOT NULL DEFAULT '',
      findings TEXT NOT NULL DEFAULT '',
      bp TEXT NOT NULL DEFAULT '',
      weight TEXT NOT NULL DEFAULT '',
      weight_unit TEXT NOT NULL DEFAULT 'kg',
      notes TEXT NOT NULL DEFAULT '',
      visit_cost TEXT NOT NULL DEFAULT '',
      payment_amount TEXT NOT NULL DEFAULT '',
      payment_scope TEXT NOT NULL DEFAULT 'patient',
      draft_med_json TEXT NOT NULL DEFAULT '{}',
      medicines_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function ensureAppSettingsSchema(database) {
  // Bootstrap with the oldest known columns only. Newer columns are added via ALTER
  // so upgrades from pre-input-mode databases do not fail on INSERT.
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      currency_code TEXT NOT NULL DEFAULT 'INR'
    );
    INSERT OR IGNORE INTO app_settings (id, currency_code) VALUES (1, 'INR');
  `);
  const columns = await database.getAllAsync('PRAGMA table_info(app_settings)');
  const names = new Set(columns.map(column => column.name));
  if (!names.has('default_input_mode')) {
    await database.execAsync(`ALTER TABLE app_settings ADD COLUMN default_input_mode TEXT NOT NULL DEFAULT '${DEFAULT_INPUT_MODE}';`);
  }
  if (!names.has('gemma_model_variant')) {
    await database.execAsync("ALTER TABLE app_settings ADD COLUMN gemma_model_variant TEXT NOT NULL DEFAULT 'e2b';");
  }
  if (!names.has('gemma_model_downloaded')) {
    await database.execAsync('ALTER TABLE app_settings ADD COLUMN gemma_model_downloaded INTEGER NOT NULL DEFAULT 0;');
  }
}

async function ensureDraftVisitColumns(database) {
  const columns = await database.getAllAsync('PRAGMA table_info(draft_visits)');
  const names = new Set(columns.map((column) => column.name));
  if (!names.has('narrative_transcript')) {
    await database.execAsync("ALTER TABLE draft_visits ADD COLUMN narrative_transcript TEXT NOT NULL DEFAULT '';");
  }
}

async function ensureVisitColumns(database) {
  const columns = await database.getAllAsync('PRAGMA table_info(visits)');
  const names = new Set(columns.map(column => column.name));
  const requiredColumns = [
    { name: 'complaints', defaultValue: "''" },
    { name: 'diagnosis', defaultValue: "''" },
    { name: 'investigations', defaultValue: "''" },
    { name: 'procedures', defaultValue: "''" },
    { name: 'findings', defaultValue: "''" },
    { name: 'bp', defaultValue: "''" },
    { name: 'weight', defaultValue: "''" },
    { name: 'weight_unit', defaultValue: "'kg'" },
    { name: 'notes', defaultValue: "''" },
    { name: 'visit_cost', defaultValue: '0' },
  ];
  for (const column of requiredColumns) {
    if (!names.has(column.name)) {
      await database.execAsync(`ALTER TABLE visits ADD COLUMN ${column.name} TEXT NOT NULL DEFAULT ${column.defaultValue};`);
    }
  }
}

async function insertSeedVisitWithMedicines(database, {
  patientId,
  visitDate,
  complaints,
  diagnosis,
  investigations,
  procedures,
  findings,
  bp,
  weight,
  weightUnit,
  notes,
  visitCost,
  medicines,
}) {
  const visitInsert = await database.runAsync(
    `
      INSERT INTO visits (
        patient_id,
        visit_date,
        complaints,
        diagnosis,
        investigations,
        procedures,
        findings,
        bp,
        weight,
        weight_unit,
        notes,
        visit_cost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [patientId, visitDate, complaints, diagnosis, investigations, procedures, findings, bp, weight, weightUnit, notes, visitCost]
  );
  const visitId = visitInsert.lastInsertRowId;

  for (const med of medicines) {
    await database.runAsync(
      'INSERT INTO visit_medicines (visit_id, patient_id, name, dosage, frequency, interval_days, duration, route, instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [visitId, patientId, med.name, med.dosage ?? '', med.frequency ?? '', med.intervalDays ?? 1, med.duration ?? '', med.route ?? '', med.instructions ?? '']
    );
    const medInsert = await database.runAsync(
      'INSERT INTO medicines (patient_id, name, dosage, frequency, interval_days, duration, route, instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [patientId, med.name, med.dosage ?? '', med.frequency ?? '', med.intervalDays ?? 1, med.duration ?? '', med.route ?? '', med.instructions ?? '']
    );
    await database.runAsync(
      'INSERT INTO medicine_history (patient_id, medicine_id, name, dosage, frequency, interval_days, duration, route, instructions, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [patientId, medInsert.lastInsertRowId, med.name, med.dosage ?? '', med.frequency ?? '', med.intervalDays ?? 1, med.duration ?? '', med.route ?? '', med.instructions ?? '', 'added']
    );
  }

  return visitId;
}

async function ensureDevClinicProfileMock(database) {
  if (!__DEV__) return;
  const row = await database.getFirstAsync('SELECT doctor_name FROM clinic_profile WHERE id = 1');
  if ((row?.doctor_name ?? '').trim() !== '') return;
  await database.runAsync(
    `UPDATE clinic_profile SET
      doctor_name = ?,
      qualifications = ?,
      address = ?,
      contact = ?,
      registration = ?,
      hours = ?
    WHERE id = 1`,
    [
      MOCK_CLINIC_PROFILE.doctorName,
      MOCK_CLINIC_PROFILE.qualifications,
      MOCK_CLINIC_PROFILE.address,
      MOCK_CLINIC_PROFILE.contact,
      MOCK_CLINIC_PROFILE.registration,
      MOCK_CLINIC_PROFILE.hours,
    ]
  );
}

async function ensureDevFamilyMockData(database) {
  const visitsRow = await database.getFirstAsync('SELECT COUNT(*) AS count FROM visits');
  if ((visitsRow?.count ?? 0) > 0) return;

  const patients = await database.getAllAsync('SELECT id, family_id FROM patients ORDER BY id ASC LIMIT 2');
  if (patients.length < 2) return;

  const primary = patients[0];
  const relative = patients[1];
  const familyId = primary.family_id;
  if (!familyId) return;

  if (relative.family_id !== familyId) {
    await database.runAsync('UPDATE patients SET family_id = ? WHERE id = ?', [familyId, relative.id]);
  }

  const visit1Id = await insertSeedVisitWithMedicines(database, {
    patientId: primary.id,
    visitDate: '2026-05-01',
    complaints: 'Cough, fever',
    diagnosis: 'Upper respiratory tract infection',
    investigations: 'CBC, chest exam',
    procedures: 'Nebulization',
    findings: 'Mild wheeze',
    bp: '118/76',
    weight: '70',
    weightUnit: 'kg',
    notes: 'Hydration and follow-up in 1 week.',
    visitCost: 180,
    medicines: [
      { name: 'Amoxicillin', dosage: '500mg', frequency: 'TID', duration: '7 days', route: 'Oral', instructions: 'After meals' },
      { name: 'Paracetamol', dosage: '650mg', frequency: 'PRN', duration: '5 days', route: 'Oral', instructions: 'For fever' },
    ],
  });

  const visit2Id = await insertSeedVisitWithMedicines(database, {
    patientId: relative.id,
    visitDate: '2026-05-03',
    complaints: 'Headache',
    diagnosis: 'Tension headache',
    investigations: 'Blood pressure check',
    procedures: '',
    findings: 'No neuro deficit',
    bp: '126/82',
    weight: '82',
    weightUnit: 'kg',
    notes: 'Lifestyle advice provided.',
    visitCost: 120,
    medicines: [
      { name: 'Ibuprofen', dosage: '400mg', frequency: 'BID', duration: '3 days', route: 'Oral', instructions: 'Take with food' },
    ],
  });

  await database.runAsync(
    'INSERT INTO payments (patient_id, family_id, visit_id, amount, scope) VALUES (?, ?, ?, ?, ?)',
    [primary.id, familyId, visit1Id, 60, 'patient']
  );
  await database.runAsync(
    'INSERT INTO payments (patient_id, family_id, visit_id, amount, scope) VALUES (?, ?, ?, ?, ?)',
    [relative.id, familyId, visit2Id, 90, 'family']
  );
}

export async function getDb() {
  if (!db) {
    console.log('[db] getDb: initializing, __DEV__=', __DEV__);
    db = await SQLite.openDatabaseAsync('patients.db');
    console.log('[db] opened');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS families (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        middle_name TEXT NOT NULL DEFAULT '',
        last_name TEXT NOT NULL,
        dob TEXT NOT NULL DEFAULT '',
        family_id INTEGER,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS medicines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        dosage TEXT,
        frequency TEXT,
        interval_days INTEGER NOT NULL DEFAULT 1,
        duration TEXT,
        route TEXT,
        instructions TEXT
      );
      CREATE TABLE IF NOT EXISTS medicine_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        medicine_id INTEGER,
        name TEXT NOT NULL,
        dosage TEXT,
        frequency TEXT,
        interval_days INTEGER NOT NULL DEFAULT 1,
        duration TEXT,
        route TEXT,
        instructions TEXT,
        action TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        visit_date TEXT NOT NULL,
        complaints TEXT NOT NULL DEFAULT '',
        diagnosis TEXT NOT NULL DEFAULT '',
        investigations TEXT NOT NULL DEFAULT '',
        procedures TEXT NOT NULL DEFAULT '',
        findings TEXT NOT NULL DEFAULT '',
        bp TEXT NOT NULL DEFAULT '',
        weight TEXT NOT NULL DEFAULT '',
        weight_unit TEXT NOT NULL DEFAULT 'kg',
        notes TEXT NOT NULL DEFAULT '',
        visit_cost REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS visit_medicines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visit_id INTEGER NOT NULL,
        patient_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        dosage TEXT NOT NULL DEFAULT '',
        frequency TEXT NOT NULL DEFAULT '',
        interval_days INTEGER NOT NULL DEFAULT 1,
        duration TEXT NOT NULL DEFAULT '',
        route TEXT NOT NULL DEFAULT '',
        instructions TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        family_id INTEGER NOT NULL,
        visit_id INTEGER,
        amount REAL NOT NULL,
        scope TEXT NOT NULL DEFAULT 'patient',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS gestures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS clinic_profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        doctor_name TEXT NOT NULL DEFAULT '',
        qualifications TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '',
        contact TEXT NOT NULL DEFAULT '',
        registration TEXT NOT NULL DEFAULT '',
        hours TEXT NOT NULL DEFAULT ''
      );
      INSERT OR IGNORE INTO clinic_profile (id) VALUES (1);
    `);

    await ensureAppSettingsSchema(db);
    await ensureDraftVisitColumns(db);
    await ensurePatientsSchema(db);
    await ensurePatientsDobColumn(db);
    await ensurePatientsNotesColumn(db);
    await ensureFamiliesSchema(db);
    await ensurePatientsFamilyColumn(db);
    await ensurePatientFamilyAssignments(db);
    await ensureVisitsSchema(db);
    await ensureVisitColumns(db);
    await ensureMedicationIntervalColumns(db);
    await ensureMedicineHistoryBackfill(db);
    if (__DEV__) {
      await ensureDevClinicProfileMock(db);
      await ensureDevFamilyMockData(db);
    }

    if (__DEV__) {
      const row = await db.getFirstAsync('SELECT COUNT(*) AS count FROM patients');
      const patientCount = row?.count ?? 0;

      if (patientCount === 0) {
        let aliceId;
        for (const p of MOCK_PATIENTS) {
          const familyInsert = await db.runAsync('INSERT INTO families DEFAULT VALUES');
          const result = await db.runAsync(
            'INSERT INTO patients (first_name, middle_name, last_name, dob, family_id, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [p.firstName, p.middleName, p.lastName, p.dob ?? '', familyInsert.lastInsertRowId, p.phone, p.address]
          );
          if (p.firstName === 'Alice' && p.lastName === 'Johnson') aliceId = result.lastInsertRowId;
        }
        for (const m of ALICE_MEDICINES) {
          const medInsert = await db.runAsync(
            'INSERT INTO medicines (patient_id, name, dosage, frequency, interval_days, duration, route, instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [aliceId, m.name, m.dosage, m.frequency, m.intervalDays ?? 1, m.duration, m.route, m.instructions]
          );
          await db.runAsync(
            'INSERT INTO medicine_history (patient_id, medicine_id, name, dosage, frequency, interval_days, duration, route, instructions, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [aliceId, medInsert.lastInsertRowId, m.name, m.dosage, m.frequency, m.intervalDays ?? 1, m.duration, m.route, m.instructions, 'added']
          );
        }
      }
      await ensureDevFamilyMockData(db);
    }
  }
  return db;
}

function normalizeFamilyIdInput(familyId) {
  const raw = `${familyId ?? ''}`.trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('Family ID must be a positive integer.');
  }
  return parsed;
}

export async function addPatient(firstName, middleName, lastName, dob, phone, address, familyId) {
  const database = await getDb();
  const requestedFamilyId = normalizeFamilyIdInput(familyId);
  let resolvedFamilyId = requestedFamilyId;
  let createdNewFamily = false;

  if (requestedFamilyId != null) {
    const existingFamily = await database.getFirstAsync('SELECT id FROM families WHERE id = ?', [requestedFamilyId]);
    if (!existingFamily) {
      throw new Error(`Family ID ${requestedFamilyId} does not exist.`);
    }
  } else {
    const familyInsert = await database.runAsync('INSERT INTO families DEFAULT VALUES');
    resolvedFamilyId = familyInsert.lastInsertRowId;
    createdNewFamily = true;
  }

  const result = await database.runAsync(
    'INSERT INTO patients (first_name, middle_name, last_name, dob, family_id, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [firstName, middleName ?? '', lastName, dob ?? '', resolvedFamilyId, phone ?? '', address ?? '']
  );
  return {
    patientId: result.lastInsertRowId,
    familyId: resolvedFamilyId,
    createdNewFamily,
  };
}

export async function searchFamiliesByRelativeName(query) {
  const database = await getDb();
  const normalized = (query ?? '').trim().toLowerCase();
  if (!normalized) return [];

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const whereClauses = tokens.map(() => `lower(${PATIENT_NAME_SQL}) LIKE ?`);
  const whereParams = tokens.map(token => `%${token}%`);

  return await database.getAllAsync(
    `
      WITH matched AS (
        SELECT
          family_id AS familyId,
          ${PATIENT_NAME_SQL} AS relativeName,
          lower(${PATIENT_NAME_SQL}) AS relativeNameLower
        FROM patients
        WHERE family_id IS NOT NULL
          AND ${whereClauses.join(' AND ')}
      ),
      ranked AS (
        SELECT
          familyId,
          MIN(relativeName) AS relativeName,
          MIN(
            CASE
              WHEN relativeNameLower = ? THEN 0
              WHEN relativeNameLower LIKE ? THEN 1
              ELSE 2
            END
          ) AS score
        FROM matched
        GROUP BY familyId
      )
      SELECT
        r.familyId AS family_id,
        r.relativeName AS relative_name,
        (
          SELECT COUNT(*)
          FROM patients p2
          WHERE p2.family_id = r.familyId
        ) AS member_count
      FROM ranked r
      ORDER BY
        r.score ASC,
        member_count DESC,
        r.familyId ASC
      LIMIT 12
    `,
    [...whereParams, normalized, `${normalized}%`]
  );
}

export async function updatePatient(patientId, { firstName, middleName, lastName, dob, phone, address, notes }) {
  const database = await getDb();
  await database.runAsync(
    `
      UPDATE patients
      SET
        first_name = ?,
        middle_name = ?,
        last_name = ?,
        dob = ?,
        phone = ?,
        address = ?,
        notes = ?
      WHERE id = ?
    `,
    [firstName, middleName ?? '', lastName, dob ?? '', phone ?? '', address ?? '', notes ?? '', patientId]
  );
}

export async function updatePatientFamily(patientId, familyId) {
  const database = await getDb();
  const targetFamilyId = normalizeFamilyIdInput(familyId);
  if (targetFamilyId == null) {
    throw new Error('Choose a family to add this patient to.');
  }

  const [patientRow, familyRow] = await Promise.all([
    database.getFirstAsync('SELECT id, family_id FROM patients WHERE id = ?', [patientId]),
    database.getFirstAsync('SELECT id FROM families WHERE id = ?', [targetFamilyId]),
  ]);

  if (!patientRow) {
    throw new Error('Patient does not exist.');
  }
  if (!familyRow) {
    throw new Error(`Family ID ${targetFamilyId} does not exist.`);
  }
  if (patientRow.family_id === targetFamilyId) {
    return { familyId: targetFamilyId, changed: false };
  }

  if (patientRow.family_id != null) {
    const summary = await getBalanceSummary(patientId);
    if (Math.abs(Number(summary.patientBalance ?? 0)) > 0.000001) {
      throw new Error('Patient balance must be zero before moving to another family.');
    }
  }

  await database.runAsync(
    'UPDATE patients SET family_id = ? WHERE id = ?',
    [targetFamilyId, patientId]
  );
  return { familyId: targetFamilyId, changed: true };
}

export async function searchPatients({ firstName = '', middleName = '', lastName = '' }) {
  const database = await getDb();
  const filters = [
    { value: firstName, column: 'first_name' },
    { value: middleName, column: 'middle_name' },
    { value: lastName, column: 'last_name' },
  ]
    .map(filter => ({ ...filter, value: filter.value.trim() }))
    .filter(filter => filter.value.length > 0);

  if (filters.length === 0) {
    return await getAllPatients();
  }

  const whereClauses = [];
  const orderClauses = [];
  const whereParams = [];
  const orderParams = [];

  for (const filter of filters) {
    whereClauses.push(`${filter.column} LIKE ? COLLATE NOCASE`);
    whereParams.push(`${filter.value}%`);
    orderClauses.push(`CASE WHEN lower(${filter.column}) = lower(?) THEN 0 ELSE 1 END`);
    orderParams.push(filter.value);
  }

  return await database.getAllAsync(
    `
      ${PATIENT_SELECT_SQL}
      WHERE
        ${whereClauses.join(' AND ')}
      ORDER BY
        ${orderClauses.join(', ')},
        last_name COLLATE NOCASE ASC,
        first_name COLLATE NOCASE ASC,
        middle_name COLLATE NOCASE ASC,
        id ASC
    `,
    [...whereParams, ...orderParams]
  );
}

export async function getAllPatients() {
  const database = await getDb();
  return await database.getAllAsync(`
    ${PATIENT_SELECT_SQL}
    ${PATIENT_ORDER_SQL}
  `);
}

export async function getMedicines(patientId) {
  const database = await getDb();
  return await database.getAllAsync(
    'SELECT * FROM medicines WHERE patient_id = ? ORDER BY id ASC',
    [patientId]
  );
}

export async function addMedicine(patientId, { name, dosage, frequency, intervalDays, duration, route, instructions }) {
  const database = await getDb();
  const normalized = {
    name,
    dosage: dosage ?? '',
    frequency: frequency ?? '',
    intervalDays: normalizeIntervalDays(intervalDays),
    duration: duration ?? '',
    route: route ?? '',
    instructions: instructions ?? '',
  };
  const result = await database.runAsync(
    'INSERT INTO medicines (patient_id, name, dosage, frequency, interval_days, duration, route, instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      patientId,
      normalized.name,
      normalized.dosage,
      normalized.frequency,
      normalized.intervalDays,
      normalized.duration,
      normalized.route,
      normalized.instructions,
    ]
  );
  await database.runAsync(
    'INSERT INTO medicine_history (patient_id, medicine_id, name, dosage, frequency, interval_days, duration, route, instructions, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      patientId,
      result.lastInsertRowId,
      normalized.name,
      normalized.dosage,
      normalized.frequency,
      normalized.intervalDays,
      normalized.duration,
      normalized.route,
      normalized.instructions,
      'added',
    ]
  );
  return result.lastInsertRowId;
}

export async function deleteMedicine(id) {
  const database = await getDb();
  const current = await database.getFirstAsync('SELECT * FROM medicines WHERE id = ?', [id]);
  if (!current) return;

  await database.runAsync('DELETE FROM medicines WHERE id = ?', [id]);
  await database.runAsync(
    'INSERT INTO medicine_history (patient_id, medicine_id, name, dosage, frequency, interval_days, duration, route, instructions, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      current.patient_id,
      current.id,
      current.name,
      current.dosage ?? '',
      current.frequency ?? '',
      current.interval_days ?? 1,
      current.duration ?? '',
      current.route ?? '',
      current.instructions ?? '',
      'removed',
    ]
  );
}

export async function getMedicineHistory(patientId) {
  const database = await getDb();
  return await database.getAllAsync(
    'SELECT * FROM medicine_history WHERE patient_id = ? ORDER BY id DESC',
    [patientId]
  );
}

export async function getVisits(patientId) {
  const database = await getDb();
  return await database.getAllAsync(
    'SELECT * FROM visits WHERE patient_id = ? ORDER BY visit_date DESC, id DESC',
    [patientId]
  );
}

export async function getVisitsInDateRange({ startDate, endDate }) {
  const database = await getDb();
  return await database.getAllAsync(
    `
      SELECT
        v.*,
        p.id AS patient_id,
        p.first_name,
        p.middle_name,
        p.last_name,
        p.dob,
        p.family_id,
        p.phone,
        p.address,
        trim(
          coalesce(p.first_name, '') ||
          CASE
            WHEN trim(coalesce(p.middle_name, '')) <> '' THEN ' ' || trim(p.middle_name)
            ELSE ''
          END ||
          CASE
            WHEN trim(coalesce(p.last_name, '')) <> '' THEN ' ' || trim(p.last_name)
            ELSE ''
          END
        ) AS patient_name,
        (
          SELECT COUNT(*)
          FROM visit_medicines vm
          WHERE vm.visit_id = v.id
        ) AS medicine_count
      FROM visits v
      INNER JOIN patients p ON p.id = v.patient_id
      WHERE v.visit_date >= ? AND v.visit_date <= ?
      ORDER BY v.visit_date DESC, v.id DESC
    `,
    [startDate, endDate]
  );
}

export async function getVisitMedicines(visitId) {
  const database = await getDb();
  return await database.getAllAsync(
    'SELECT * FROM visit_medicines WHERE visit_id = ? ORDER BY id ASC',
    [visitId]
  );
}

function parseDraftJson(value, fallback) {
  try {
    const parsed = JSON.parse(value ?? '');
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

export async function getDraftVisit(patientId) {
  const database = await getDb();
  const row = await database.getFirstAsync(
    'SELECT * FROM draft_visits WHERE patient_id = ?',
    [patientId]
  );
  if (!row) return null;
  return {
    visitDate: row.visit_date ?? '',
    complaints: row.complaints ?? '',
    diagnosis: row.diagnosis ?? '',
    investigations: row.investigations ?? '',
    procedures: row.procedures ?? '',
    findings: row.findings ?? '',
    bp: row.bp ?? '',
    weight: row.weight ?? '',
    weightUnit: row.weight_unit ?? 'kg',
    notes: row.notes ?? '',
    visitCost: row.visit_cost ?? '',
    paymentAmount: row.payment_amount ?? '',
    paymentScope: row.payment_scope === 'family' ? 'family' : 'patient',
    draftMed: parseDraftJson(row.draft_med_json, {}),
    medicines: parseDraftJson(row.medicines_json, []),
    narrativeTranscript: row.narrative_transcript ?? '',
    updatedAt: row.updated_at,
  };
}

export async function saveDraftVisit(patientId, draft) {
  const database = await getDb();
  await database.runAsync(
    `
      INSERT INTO draft_visits (
        patient_id,
        visit_date,
        complaints,
        diagnosis,
        investigations,
        procedures,
        findings,
        bp,
        weight,
        weight_unit,
        notes,
        visit_cost,
        payment_amount,
        payment_scope,
        draft_med_json,
        medicines_json,
        narrative_transcript,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(patient_id) DO UPDATE SET
        visit_date = excluded.visit_date,
        complaints = excluded.complaints,
        diagnosis = excluded.diagnosis,
        investigations = excluded.investigations,
        procedures = excluded.procedures,
        findings = excluded.findings,
        bp = excluded.bp,
        weight = excluded.weight,
        weight_unit = excluded.weight_unit,
        notes = excluded.notes,
        visit_cost = excluded.visit_cost,
        payment_amount = excluded.payment_amount,
        payment_scope = excluded.payment_scope,
        draft_med_json = excluded.draft_med_json,
        medicines_json = excluded.medicines_json,
        narrative_transcript = excluded.narrative_transcript,
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      patientId,
      draft.visitDate ?? '',
      draft.complaints ?? '',
      draft.diagnosis ?? '',
      draft.investigations ?? '',
      draft.procedures ?? '',
      draft.findings ?? '',
      draft.bp ?? '',
      draft.weight ?? '',
      draft.weightUnit ?? 'kg',
      draft.notes ?? '',
      draft.visitCost ?? '',
      draft.paymentAmount ?? '',
      draft.paymentScope === 'family' ? 'family' : 'patient',
      JSON.stringify(draft.draftMed ?? {}),
      JSON.stringify(draft.medicines ?? []),
      draft.narrativeTranscript ?? '',
    ]
  );
}

export async function clearDraftVisit(patientId) {
  const database = await getDb();
  await database.runAsync('DELETE FROM draft_visits WHERE patient_id = ?', [patientId]);
}

function normalizeAmount(value) {
  const parsed = Number(value ?? 0);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error('Amount must be a non-negative number.');
  }
  return parsed;
}

function normalizeIntervalDays(value) {
  const parsed = Number(value ?? 1);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 30) {
    throw new Error('Medication interval must be an integer from 1 to 30 days.');
  }
  return parsed;
}

export async function addPayment(patientId, { familyId, visitId = null, amount, scope = 'patient' }) {
  const database = await getDb();
  const normalizedAmount = normalizeAmount(amount);
  if (normalizedAmount <= 0) return null;
  const normalizedScope = scope === 'family' ? 'family' : 'patient';
  const result = await database.runAsync(
    'INSERT INTO payments (patient_id, family_id, visit_id, amount, scope) VALUES (?, ?, ?, ?, ?)',
    [patientId, familyId, visitId, normalizedAmount, normalizedScope]
  );
  return result.lastInsertRowId;
}

export async function addVisit(
  patientId,
  {
    familyId,
    visitDate,
    complaints,
    diagnosis,
    investigations,
    procedures,
    findings,
    bp,
    weight,
    weightUnit,
    notes,
    visitCost = 0,
    paymentAmount = 0,
    paymentScope = 'patient',
    medicines = [],
  }
) {
  const database = await getDb();
  const normalizedVisitCost = normalizeAmount(visitCost);
  const normalizedPaymentAmount = normalizeAmount(paymentAmount);
  const visitInsert = await database.runAsync(
    `
      INSERT INTO visits (
        patient_id,
        visit_date,
        complaints,
        diagnosis,
        investigations,
        procedures,
        findings,
        bp,
        weight,
        weight_unit,
        notes,
        visit_cost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      patientId,
      visitDate,
      complaints ?? '',
      diagnosis ?? '',
      investigations ?? '',
      procedures ?? '',
      findings ?? '',
      bp ?? '',
      weight ?? '',
      weightUnit ?? 'kg',
      notes ?? '',
      normalizedVisitCost,
    ]
  );
  const visitId = visitInsert.lastInsertRowId;

  if (normalizedPaymentAmount > 0) {
    await addPayment(patientId, {
      familyId,
      visitId,
      amount: normalizedPaymentAmount,
      scope: paymentScope,
    });
  }

  for (const med of medicines) {
    const normalized = {
      name: med.name,
      dosage: med.dosage ?? '',
      frequency: med.frequency ?? '',
      intervalDays: normalizeIntervalDays(med.intervalDays),
      duration: med.duration ?? '',
      route: med.route ?? '',
      instructions: med.instructions ?? '',
    };
    await database.runAsync(
      'INSERT INTO visit_medicines (visit_id, patient_id, name, dosage, frequency, interval_days, duration, route, instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [visitId, patientId, normalized.name, normalized.dosage, normalized.frequency, normalized.intervalDays, normalized.duration, normalized.route, normalized.instructions]
    );
    const medInsert = await database.runAsync(
      'INSERT INTO medicines (patient_id, name, dosage, frequency, interval_days, duration, route, instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [patientId, normalized.name, normalized.dosage, normalized.frequency, normalized.intervalDays, normalized.duration, normalized.route, normalized.instructions]
    );
    await database.runAsync(
      'INSERT INTO medicine_history (patient_id, medicine_id, name, dosage, frequency, interval_days, duration, route, instructions, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [patientId, medInsert.lastInsertRowId, normalized.name, normalized.dosage, normalized.frequency, normalized.intervalDays, normalized.duration, normalized.route, normalized.instructions, 'added']
    );
  }

  return visitId;
}

export async function getBalanceSummary(patientId) {
  const database = await getDb();
  const patientRow = await database.getFirstAsync('SELECT id, family_id FROM patients WHERE id = ?', [patientId]);
  if (!patientRow) {
    return {
      patientBalance: 0,
      familyBalance: 0,
      totalVisitCostPatient: 0,
      totalPaymentsPatient: 0,
      totalVisitCostFamily: 0,
      totalPaymentsFamily: 0,
    };
  }

  const patientChargesRow = await database.getFirstAsync(
    'SELECT coalesce(SUM(visit_cost), 0) AS total FROM visits WHERE patient_id = ?',
    [patientId]
  );
  const patientPaymentsRow = await database.getFirstAsync(
    "SELECT coalesce(SUM(amount), 0) AS total FROM payments WHERE patient_id = ? AND scope = 'patient'",
    [patientId]
  );
  const familyChargesRow = await database.getFirstAsync(
    `
      SELECT coalesce(SUM(v.visit_cost), 0) AS total
      FROM visits v
      INNER JOIN patients p ON p.id = v.patient_id
      WHERE p.family_id = ?
    `,
    [patientRow.family_id]
  );
  const familyPaymentsRow = await database.getFirstAsync(
    'SELECT coalesce(SUM(amount), 0) AS total FROM payments WHERE family_id = ?',
    [patientRow.family_id]
  );

  const totalVisitCostPatient = Number(patientChargesRow?.total ?? 0);
  const totalPaymentsPatient = Number(patientPaymentsRow?.total ?? 0);
  const totalVisitCostFamily = Number(familyChargesRow?.total ?? 0);
  const totalPaymentsFamily = Number(familyPaymentsRow?.total ?? 0);

  return {
    patientBalance: totalVisitCostPatient - totalPaymentsPatient,
    familyBalance: totalVisitCostFamily - totalPaymentsFamily,
    totalVisitCostPatient,
    totalPaymentsPatient,
    totalVisitCostFamily,
    totalPaymentsFamily,
  };
}

export function mapClinicProfileRow(row) {
  if (!row) {
    return {
      doctorName: '',
      qualifications: '',
      address: '',
      contact: '',
      registration: '',
      hours: '',
    };
  }
  return {
    doctorName: row.doctor_name ?? '',
    qualifications: row.qualifications ?? '',
    address: row.address ?? '',
    contact: row.contact ?? '',
    registration: row.registration ?? '',
    hours: row.hours ?? '',
  };
}

export async function getClinicProfile() {
  const database = await getDb();
  const row = await database.getFirstAsync('SELECT * FROM clinic_profile WHERE id = 1');
  return mapClinicProfileRow(row);
}

function normalizeGemmaModelVariant(value) {
  return value === 'e4b' ? 'e4b' : 'e2b';
}

export function mapAppSettingsRow(row) {
  const code = row?.currency_code ?? DEFAULT_CURRENCY_CODE;
  return {
    currencyCode: isValidCurrencyCode(code) ? code : DEFAULT_CURRENCY_CODE,
    defaultInputMode: normalizeInputMode(row?.default_input_mode),
    gemmaModelVariant: normalizeGemmaModelVariant(row?.gemma_model_variant),
    gemmaModelDownloaded: Boolean(row?.gemma_model_downloaded),
  };
}

export async function getAppSettings() {
  const database = await getDb();
  await ensureAppSettingsSchema(database);
  const row = await database.getFirstAsync('SELECT * FROM app_settings WHERE id = 1');
  return mapAppSettingsRow(row);
}

export function subscribeAppSettings(listener) {
  appSettingsListeners.add(listener);
  return () => {
    appSettingsListeners.delete(listener);
  };
}

function notifyAppSettings(settings) {
  appSettingsListeners.forEach((listener) => {
    listener(settings);
  });
}

export async function saveAppSettings({
  currencyCode,
  defaultInputMode,
  gemmaModelVariant,
  gemmaModelDownloaded,
} = {}) {
  const database = await getDb();
  const current = await getAppSettings();
  const normalizedCurrency = currencyCode == null
    ? current.currencyCode
    : isValidCurrencyCode(currencyCode) ? currencyCode : DEFAULT_CURRENCY_CODE;
  const normalizedInputMode = defaultInputMode == null
    ? current.defaultInputMode
    : normalizeInputMode(defaultInputMode);
  const normalizedGemmaVariant = gemmaModelVariant == null
    ? current.gemmaModelVariant
    : normalizeGemmaModelVariant(gemmaModelVariant);
  const normalizedGemmaDownloaded = gemmaModelDownloaded == null
    ? (current.gemmaModelDownloaded ? 1 : 0)
    : (gemmaModelDownloaded ? 1 : 0);
  await database.runAsync(
    'UPDATE app_settings SET currency_code = ?, default_input_mode = ?, gemma_model_variant = ?, gemma_model_downloaded = ? WHERE id = 1',
    [normalizedCurrency, normalizedInputMode, normalizedGemmaVariant, normalizedGemmaDownloaded]
  );
  const settings = mapAppSettingsRow({
    currency_code: normalizedCurrency,
    default_input_mode: normalizedInputMode,
    gemma_model_variant: normalizedGemmaVariant,
    gemma_model_downloaded: normalizedGemmaDownloaded,
  });
  notifyAppSettings(settings);
  return settings;
}

export async function saveClinicProfile({
  doctorName = '',
  qualifications = '',
  address = '',
  contact = '',
  registration = '',
  hours = '',
}) {
  const database = await getDb();
  await database.runAsync(
    `UPDATE clinic_profile SET
      doctor_name = ?,
      qualifications = ?,
      address = ?,
      contact = ?,
      registration = ?,
      hours = ?
    WHERE id = 1`,
    [doctorName, qualifications, address, contact, registration, hours]
  );
}

export async function getGestures() {
  console.log('[db] getGestures: getting db');
  const database = await getDb();
  console.log('[db] getGestures: querying');
  const rows = await database.getAllAsync('SELECT * FROM gestures ORDER BY id ASC');
  console.log('[db] getGestures: got', rows.length, 'rows');
  return rows;
}

export async function addGesture(word, data) {
  console.log('[db] addGesture word=', word, 'dataBytes=', data?.length);
  const database = await getDb();
  const result = await database.runAsync(
    'INSERT INTO gestures (word, data) VALUES (?, ?)',
    [word, data]
  );
  console.log('[db] addGesture inserted id=', result.lastInsertRowId, 'changes=', result.changes);
  return result.lastInsertRowId;
}

export async function deleteGesture(id) {
  const database = await getDb();
  await database.runAsync('DELETE FROM gestures WHERE id = ?', [id]);
}
