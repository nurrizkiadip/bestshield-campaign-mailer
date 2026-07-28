import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'data', 'customers.sqlite');

function getDbConnection() {
  if (!fs.existsSync(dbPath)) {
    throw new Error('Database file not found. Please run data generation.');
  }
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id TEXT NOT NULL,
      customer_id INTEGER NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(campaign_id, customer_id)
    )
  `);
  return db;
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

export function getBatchStartIds(batchSize: number): number[] {
  const db = getDbConnection();
  try {
    const rows = db.prepare(`
      WITH Ranked AS (
        SELECT id, (ROW_NUMBER() OVER (ORDER BY id ASC) - 1) as row_idx
        FROM customers
      )
      SELECT id FROM Ranked WHERE row_idx % ? = 0 ORDER BY id ASC
    `).all(batchSize) as { id: number }[];
    return rows.map((r) => r.id);
  } finally {
    db.close();
  }
}
