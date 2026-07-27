import { queryCustomers, getCustomerCount } from '@/db/sqlite';

export async function getPaginatedCustomers(page: number, limit: number) {
  const total = getCustomerCount();
  const offset = (page - 1) * limit;
  const paginatedCustomers = queryCustomers(limit, offset);
  const totalPages = Math.ceil(total / limit);

  return {
    data: paginatedCustomers,
    meta: {
      total,
      page,
      limit,
      totalPages,
    },
  };
}
