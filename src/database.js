import * as SQLite from 'expo-sqlite';

let db;

const MOCK_PATIENTS = [
  { name: 'Alice Johnson', phone: '555-101-2020', address: '12 Maple Ave, Springfield, IL' },
  { name: 'Bob Martinez', phone: '555-303-4040', address: '88 Oak Street, Shelbyville, IL' },
  { name: 'Carol Nguyen', phone: '555-505-6060', address: '4 Elm Court, Capital City, IL' },
];

const ALICE_MEDICINES = [
  { name: 'Amoxicillin',  dosage: '500mg', frequency: 'Three times daily', duration: '7 days',  route: 'Oral', instructions: 'Take after meals'  },
  { name: 'Ibuprofen',    dosage: '400mg', frequency: 'Twice daily',        duration: '5 days',  route: 'Oral', instructions: 'Take with food'     },
  { name: 'Loratadine',   dosage: '10mg',  frequency: 'Once daily',         duration: '30 days', route: 'Oral', instructions: ''                   },
];

export async function getDb() {
  if (!db) {
    console.log('[db] getDb: initializing, __DEV__=', __DEV__);
    db = await SQLite.openDatabaseAsync('patients.db');
    console.log('[db] opened');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
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
      CREATE TABLE IF NOT EXISTS gestures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT NOT NULL,
        data TEXT NOT NULL
      );
    `);

    if (__DEV__) {
      const row = await db.getFirstAsync('SELECT COUNT(*) AS count FROM patients');
      const patientCount = row?.count ?? 0;

      if (patientCount === 0) {
        let aliceId;
        for (const p of MOCK_PATIENTS) {
          const result = await db.runAsync(
            'INSERT INTO patients (name, phone, address) VALUES (?, ?, ?)',
            [p.name, p.phone, p.address]
          );
          if (p.name === 'Alice Johnson') aliceId = result.lastInsertRowId;
        }
        for (const m of ALICE_MEDICINES) {
          await db.runAsync(
            'INSERT INTO medicines (patient_id, name, dosage, frequency, duration, route, instructions) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [aliceId, m.name, m.dosage, m.frequency, m.duration, m.route, m.instructions]
          );
        }
      }
    }
  }
  return db;
}

export async function addPatient(name, phone, address) {
  const database = await getDb();
  const result = await database.runAsync(
    'INSERT INTO patients (name, phone, address) VALUES (?, ?, ?)',
    [name, phone, address]
  );
  return result.lastInsertRowId;
}

export async function searchPatients(query) {
  const database = await getDb();
  return await database.getAllAsync(
    'SELECT * FROM patients WHERE name LIKE ? ORDER BY name ASC',
    [`%${query}%`]
  );
}

export async function getAllPatients() {
  const database = await getDb();
  return await database.getAllAsync('SELECT * FROM patients ORDER BY name ASC');
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
  const result = await database.runAsync(
    'INSERT INTO medicines (patient_id, name, dosage, frequency, duration, route, instructions) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [patientId, name, dosage ?? '', frequency ?? '', duration ?? '', route ?? '', instructions ?? '']
  );
  return result.lastInsertRowId;
}

export async function deleteMedicine(id) {
  const database = await getDb();
  await database.runAsync('DELETE FROM medicines WHERE id = ?', [id]);
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
