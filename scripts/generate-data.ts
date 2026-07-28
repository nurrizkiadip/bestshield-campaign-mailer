import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const TOTAL_RECORDS = 10000;
const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'customers.sqlite');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Remove existing database if it exists
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL'); // Performance optimization

// Create table
db.exec(`
  CREATE TABLE customers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL
  )
`);

console.log('Generating dummy data in SQLite (using node:sqlite)...');

const insert = db.prepare('INSERT INTO customers (id, name, email) VALUES (?, ?, ?)');

db.exec('BEGIN TRANSACTION');
for (let i = 1; i <= TOTAL_RECORDS; i++) {
  insert.run(i, `Customer ${i}`, `customer${i}@example.com`);
  if (i % 100000 === 0) {
    console.log(`Inserted ${i} records...`);
  }
}
db.exec('COMMIT');

db.close();

console.log(`Successfully generated ${TOTAL_RECORDS} customer records at ${dbPath}`);
