import * as SQLite from 'expo-sqlite';

let db;

const MOCK_PATIENTS = [
  { name: 'Alice Johnson', phone: '555-101-2020', address: '12 Maple Ave, Springfield, IL' },
  { name: 'Bob Martinez', phone: '555-303-4040', address: '88 Oak Street, Shelbyville, IL' },
  { name: 'Carol Nguyen', phone: '555-505-6060', address: '4 Elm Court, Capital City, IL' },
];

export async function getDb() {
  if (!db) {
    db = await SQLite.openDatabaseAsync('patients.db');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL
      );
    `);

    if (__DEV__) {
      await db.execAsync('DELETE FROM patients;');
      for (const p of MOCK_PATIENTS) {
        await db.runAsync(
          'INSERT INTO patients (name, phone, address) VALUES (?, ?, ?)',
          [p.name, p.phone, p.address]
        );
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
