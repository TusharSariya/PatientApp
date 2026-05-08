import * as SQLite from 'expo-sqlite';
import { splitPatientName } from './patientName';

let db;

const MOCK_PATIENTS = [
  { firstName: 'Alice', middleName: 'Marie', lastName: 'Johnson', dob: '1990-02-14', phone: '555-101-2020', address: '12 Maple Ave, Springfield, IL' },
  { firstName: 'Bob', middleName: '', lastName: 'Martinez', dob: '1985-08-23', phone: '555-303-4040', address: '88 Oak Street, Shelbyville, IL' },
  { firstName: 'Carol', middleName: 'Anh', lastName: 'Nguyen', dob: '1993-11-05', phone: '555-505-6060', address: '4 Elm Court, Capital City, IL' },
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
    dob,
    family_id,
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
      dob TEXT NOT NULL DEFAULT '',
      family_id INTEGER,
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
      'INSERT INTO patients (id, first_name, middle_name, last_name, dob, family_id, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [row.id, firstName, middleName, lastName, row.dob ?? '', row.family_id ?? null, row.phone ?? '', row.address ?? '']
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
    await ensurePatientsDobColumn(db);
    await ensureFamiliesSchema(db);
    await ensurePatientsFamilyColumn(db);
    await ensurePatientFamilyAssignments(db);
    await ensureMedicineHistoryBackfill(db);

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
    [firstName, middleName ?? '', lastName, dob ?? '', resolvedFamilyId, phone, address]
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

export async function updatePatient(patientId, { firstName, middleName, lastName, dob, phone, address }) {
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
        address = ?
      WHERE id = ?
    `,
    [firstName, middleName ?? '', lastName, dob ?? '', phone, address, patientId]
  );
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
