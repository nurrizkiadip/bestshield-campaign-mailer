import { NextResponse } from 'next/server';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  try {
    const dbPath = path.join(process.cwd(), 'public', 'customers.sqlite');

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ error: 'Database file not found. Please run data generation.' }, { status: 404 });
    }

    const db = new DatabaseSync(dbPath);

    // Retrieve total record count
    const countRow = db.prepare('SELECT COUNT(*) as total FROM customers').get() as { total: number };
    const total = countRow.total;
    
    // Retrieve paginated data instantly using LIMIT and OFFSET
    const offset = (page - 1) * limit;
    const paginatedCustomers = db.prepare('SELECT * FROM customers LIMIT ? OFFSET ?').all(limit, offset);

    db.close();

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: paginatedCustomers,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching customers from SQLite:', error);
    return NextResponse.json({ error: 'Failed to fetch customer data' }, { status: 500 });
  }
}
