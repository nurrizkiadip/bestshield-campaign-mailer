import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  try {
    const filePath = path.join(process.cwd(), 'public', 'customers.json');

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Data file not found. Please run data generation.' }, { status: 404 });
    }

    const fileContents = fs.readFileSync(filePath, 'utf8');
    const allCustomers = JSON.parse(fileContents);

    const total = allCustomers.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const paginatedCustomers = allCustomers.slice(startIndex, endIndex);

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
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: 'Failed to fetch customer data' }, { status: 500 });
  }
}
