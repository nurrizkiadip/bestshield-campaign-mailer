"use client";

import { useState, useEffect } from 'react';

type Customer = {
  id: number;
  name: string;
  email: string;
};

type APIResponse = {
  data: Customer[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export default function Home() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const limit = 15;

  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/customers?page=${page}&limit=${limit}`);
        if (!res.ok) {
          throw new Error('Failed to fetch data');
        }
        const json: APIResponse = await res.json();
        setCustomers(json.data);
        setTotalPages(json.meta.totalPages);
        setTotalRecords(json.meta.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [page]);

  return (
    <main className="min-h-screen p-8 bg-slate-50 text-slate-900">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Customer Records</h1>
            <p className="text-slate-600 text-sm mt-1">
              Total Customers: <span className="font-semibold text-slate-800">{totalRecords.toLocaleString()}</span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                  <th className="p-4 w-24">ID</th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-slate-500">
                      Loading data...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-red-500 font-medium">
                      {error}
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-slate-500">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-slate-500 font-mono">{customer.id}</td>
                      <td className="p-4 font-medium text-slate-800">{customer.name}</td>
                      <td className="p-4 text-blue-600">{customer.email}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1 || loading}
                className="px-3 py-2 text-sm font-medium bg-white text-slate-700 border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="First Page"
              >
                « First
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="px-3 py-2 text-sm font-medium bg-white text-slate-700 border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ‹ Previous
              </button>
            </div>

            <span className="text-sm font-medium text-slate-600">
              Page <span className="text-slate-900 font-semibold">{page.toLocaleString()}</span> of{' '}
              <span className="text-slate-900 font-semibold">{totalPages.toLocaleString()}</span>
            </span>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
                className="px-3 py-2 text-sm font-medium bg-white text-slate-700 border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next ›
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages || loading}
                className="px-3 py-2 text-sm font-medium bg-white text-slate-700 border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Last Page"
              >
                Last »
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
