import * as SQLite from 'expo-sqlite';

let db;

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
