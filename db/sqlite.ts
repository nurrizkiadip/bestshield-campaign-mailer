import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'public', 'customers.sqlite');

function getDbConnection() {
  if (!fs.existsSync(dbPath)) {
    throw new Error('Database file not found. Please run data generation.');
  }
  return new DatabaseSync(dbPath);
}

export type Customer = {
  id: number;
  name: string;
  email: string;
};

export function getCustomerCount(): number {
  const db = getDbConnection();
  try {
    const row = db.prepare('SELECT COUNT(*) as total FROM customers').get() as { total: number };
    return row.total || 0;
  } finally {
    db.close();
  }
}

export function queryCustomers(limit: number, offset: number): Customer[] {
  const db = getDbConnection();
  try {
    return db.prepare('SELECT id, name, email FROM customers LIMIT ? OFFSET ?').all(limit, offset) as Customer[];
  } finally {
    db.close();
  }
}

export function queryCustomersByIds(ids: number[]): Customer[] {
  if (ids.length === 0) return [];
  const db = getDbConnection();
  try {
    const placeholders = ids.map(() => '?').join(',');
    return db.prepare(`SELECT id, name, email FROM customers WHERE id IN (${placeholders})`).all(...ids) as Customer[];
  } finally {
    db.close();
  }
}
