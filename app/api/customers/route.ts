import { NextResponse } from 'next/server';
import { getPaginatedCustomers } from '@/services/customerService';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let page = parseInt(searchParams.get('page') || '1', 10);
  let limit = parseInt(searchParams.get('limit') || '20', 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 20;

  try {
    const result = await getPaginatedCustomers(page, limit);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching customers from SQLite:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch customer data';
    const status = message.includes('Database file not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
