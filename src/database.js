import * as SQLite from 'expo-sqlite';
import { splitPatientName } from './patientName';

let db;

const MOCK_PATIENTS = [
  { firstName: 'Alice', middleName: 'Marie', lastName: 'Johnson', phone: '555-101-2020', address: '12 Maple Ave, Springfield, IL' },
  { firstName: 'Bob', middleName: '', lastName: 'Martinez', phone: '555-303-4040', address: '88 Oak Street, Shelbyville, IL' },
  { firstName: 'Carol', middleName: 'Anh', lastName: 'Nguyen', phone: '555-505-6060', address: '4 Elm Court, Capital City, IL' },
];

const ALICE_MEDICINES = [
  { name: 'Amoxicillin',  dosage: '500mg', frequency: 'Three times daily', duration: '7 days',  route: 'Oral', instructions: 'Take after meals'  },
  { name: 'Ibuprofen',    dosage: '400mg', frequency: 'Twice daily',        duration: '5 days',  route: 'Oral', instructions: 'Take with food'     },
  { name: 'Loratadine',   dosage: '10mg',  frequency: 'Once daily',         duration: '30 days', route: 'Oral', instructions: ''                   },
];

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
    phone,
    address,
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
      phone TEXT NOT NULL,
      address TEXT NOT NULL
    );
  `);

  for (const row of legacyRows) {
    const parsed = splitPatientName(row.name ?? '');
    const firstName = row.first_name?.trim?.() || parsed.firstName;
    const middleName = row.middle_name?.trim?.() || parsed.middleName;
    const lastName = row.last_name?.trim?.() || parsed.lastName;

    await database.runAsync(
      'INSERT INTO patients (id, first_name, middle_name, last_name, phone, address) VALUES (?, ?, ?, ?, ?, ?)',
      [row.id, firstName, middleName, lastName, row.phone ?? '', row.address ?? '']
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

async function ensureMedicineHistoryBackfill(database) {
  await database.execAsync(`
    INSERT INTO medicine_history (
      patient_id,
      medicine_id,
      name,
      dosage,
      frequency,
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

export async function getDb() {
  if (!db) {
    console.log('[db] getDb: initializing, __DEV__=', __DEV__);
    db = await SQLite.openDatabaseAsync('patients.db');
    console.log('[db] opened');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        middle_name TEXT NOT NULL DEFAULT '',
        last_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS medicines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        dosage TEXT,
        frequency TEXT,
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
        duration TEXT,
        route TEXT,
        instructions TEXT,
        action TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS gestures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT NOT NULL,
        data TEXT NOT NULL
      );
    `);

    await ensurePatientsSchema(db);
    await ensureMedicineHistoryBackfill(db);

    if (__DEV__) {
      const row = await db.getFirstAsync('SELECT COUNT(*) AS count FROM patients');
      const patientCount = row?.count ?? 0;

      if (patientCount === 0) {
        let aliceId;
        for (const p of MOCK_PATIENTS) {
          const result = await db.runAsync(
            'INSERT INTO patients (first_name, middle_name, last_name, phone, address) VALUES (?, ?, ?, ?, ?)',
            [p.firstName, p.middleName, p.lastName, p.phone, p.address]
          );
          if (p.firstName === 'Alice' && p.lastName === 'Johnson') aliceId = result.lastInsertRowId;
        }
        for (const m of ALICE_MEDICINES) {
          const medInsert = await db.runAsync(
            'INSERT INTO medicines (patient_id, name, dosage, frequency, duration, route, instructions) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [aliceId, m.name, m.dosage, m.frequency, m.duration, m.route, m.instructions]
          );
          await db.runAsync(
            'INSERT INTO medicine_history (patient_id, medicine_id, name, dosage, frequency, duration, route, instructions, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [aliceId, medInsert.lastInsertRowId, m.name, m.dosage, m.frequency, m.duration, m.route, m.instructions, 'added']
          );
        }
      }
    }
  }
  return db;
}

export async function addPatient(firstName, middleName, lastName, phone, address) {
  const database = await getDb();
  const result = await database.runAsync(
    'INSERT INTO patients (first_name, middle_name, last_name, phone, address) VALUES (?, ?, ?, ?, ?)',
    [firstName, middleName ?? '', lastName, phone, address]
  );
  return result.lastInsertRowId;
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

export async function addMedicine(patientId, { name, dosage, frequency, duration, route, instructions }) {
  const database = await getDb();
  const normalized = {
    name,
    dosage: dosage ?? '',
    frequency: frequency ?? '',
    duration: duration ?? '',
    route: route ?? '',
    instructions: instructions ?? '',
  };
  const result = await database.runAsync(
    'INSERT INTO medicines (patient_id, name, dosage, frequency, duration, route, instructions) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      patientId,
      normalized.name,
      normalized.dosage,
      normalized.frequency,
      normalized.duration,
      normalized.route,
      normalized.instructions,
    ]
  );
  await database.runAsync(
    'INSERT INTO medicine_history (patient_id, medicine_id, name, dosage, frequency, duration, route, instructions, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      patientId,
      result.lastInsertRowId,
      normalized.name,
      normalized.dosage,
      normalized.frequency,
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
    'INSERT INTO medicine_history (patient_id, medicine_id, name, dosage, frequency, duration, route, instructions, action) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      current.patient_id,
      current.id,
      current.name,
      current.dosage ?? '',
      current.frequency ?? '',
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
