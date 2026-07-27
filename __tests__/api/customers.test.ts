import { GET } from '@/app/api/customers/route';
import * as sqliteGateway from '@/db/sqlite';
import { expect, test, vi, beforeEach, describe } from 'vitest';

vi.mock('@/db/sqlite', () => {
  return {
    getCustomerCount: vi.fn(),
    queryCustomers: vi.fn(),
  };
});

describe('API Route - Customers Pagination Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns paginated customer records and meta pagination object', async () => {
    (sqliteGateway.getCustomerCount as any).mockReturnValue(30);
    (sqliteGateway.queryCustomers as any).mockReturnValue([
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
    ]);

    const res = await GET(new Request('http://localhost/api/customers?page=1&limit=2'));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.data).toHaveLength(2);
    expect(data.meta).toEqual({
      total: 30,
      page: 1,
      limit: 2,
      totalPages: 15,
    });

    expect(sqliteGateway.queryCustomers).toHaveBeenCalledWith(2, 0);
  });

  test('returns empty data if database is empty', async () => {
    (sqliteGateway.getCustomerCount as any).mockReturnValue(0);
    (sqliteGateway.queryCustomers as any).mockReturnValue([]);

    const res = await GET(new Request('http://localhost/api/customers?page=1&limit=15'));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.data).toHaveLength(0);
    expect(data.meta).toEqual({
      total: 0,
      page: 1,
      limit: 15,
      totalPages: 0,
    });
  });

  test('returns exactly 1 total page if total records equal limit', async () => {
    (sqliteGateway.getCustomerCount as any).mockReturnValue(15);
    (sqliteGateway.queryCustomers as any).mockReturnValue(Array(15).fill({}));

    const res = await GET(new Request('http://localhost/api/customers?page=1&limit=15'));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.meta.totalPages).toBe(1);
  });
});
