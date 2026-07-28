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

type CampaignStatus = {
  status: 'idle' | 'running' | 'completed';
  percentage: number;
  totalBatches: number;
  completedBatches: number;
  failedBatches: number;
  activeBatches: number;
  waitingBatches: number;
  error?: string | null;
};

export default function Home() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const limit = 15;

  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState<boolean>(false);

  const [campaignStatus, setCampaignStatus] = useState<CampaignStatus | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchCampaignStatus = async () => {
    try {
      const res = await fetch('/api/campaign/status');
      if (res.ok) {
        const json: CampaignStatus = await res.json();
        setCampaignStatus(json);
      }
    } catch (err) {
      console.error('Error fetching campaign status:', err);
    }
  };

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCampaignStatus();
    const interval = setInterval(() => {
      fetchCampaignStatus();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const toggleSelectCustomer = (id: number) => {
    const next = new Set(selectedCustomerIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedCustomerIds(next);
  };

  const toggleSelectAll = () => {
    const nextSelectAll = !selectAll;
    setSelectAll(nextSelectAll);
    if (nextSelectAll) {
      setSelectedCustomerIds(new Set());
    }
  };

  const handleTriggerCampaign = async () => {
    if (!selectAll && selectedCustomerIds.size === 0) return;

    setTriggering(true);
    try {
      const res = await fetch('/api/campaign/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sendToAll: selectAll,
          customerIds: Array.from(selectedCustomerIds),
        }),
      });
      const data = await res.json();
      if (res.ok || res.status === 202) {
        setToastMessage(data.message || 'Email campaign queued in BullMQ! You can safely close or refresh this page.');
        fetchCampaignStatus();
      } else {
        setToastMessage(data.message || data.error || 'Failed to trigger campaign.');
      }
    } catch {
      setToastMessage('Error triggering background campaign.');
    } finally {
      setTriggering(false);
      setTimeout(() => setToastMessage(null), 6000);
    }
  };

  const isButtonDisabled =
    triggering ||
    campaignStatus?.status === 'running' ||
    (!selectAll && selectedCustomerIds.size === 0);

  const getButtonText = () => {
    if (triggering) return 'Starting...';
    if (campaignStatus?.status === 'running') return 'Campaign Running...';
    if (selectAll) return 'Send Email to ALL Customers';
    if (selectedCustomerIds.size > 0)
      return `Send Email to ${selectedCustomerIds.size.toLocaleString()} Selected`;
    return 'Select Customers to Email';
  };

  return (
    <main className="min-h-screen p-8 bg-slate-50 text-slate-900">
      <div className="max-w-5xl mx-auto space-y-6">
        {toastMessage && (
          <div className="bg-blue-600 text-white p-4 rounded-lg shadow-md flex items-center justify-between transition-all">
            <span className="text-sm font-medium">{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-white hover:text-slate-200 font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Campaign Mailer</h1>
            <p className="text-slate-600 text-sm mt-1">
              Total Customers: <span className="font-semibold text-slate-800">{totalRecords.toLocaleString()}</span>
              {selectedCustomerIds.size > 0 && !selectAll && (
                <span className="ml-2 text-indigo-600 font-medium">
                  ({selectedCustomerIds.size.toLocaleString()} selected)
                </span>
              )}
              {selectAll && (
                <span className="ml-2 text-indigo-600 font-medium">
                  (All {totalRecords.toLocaleString()} selected)
                </span>
              )}
            </p>
          </div>

          <button
            onClick={handleTriggerCampaign}
            disabled={isButtonDisabled}
            className="px-5 py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {getButtonText()}
          </button>
        </div>

        {/* Campaign Queue & Progress Dashboard */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">BullMQ Queue Progress</h2>
              <p className="text-slate-500 text-xs mt-0.5">
                Jobs run via background worker instances concurrently (200 emails per batch).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Status:</span>
              <span
                className={`px-3 py-1 text-xs font-bold rounded-full capitalize ${
                  campaignStatus?.status === 'running'
                    ? 'bg-amber-100 text-amber-800 animate-pulse'
                    : campaignStatus?.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {campaignStatus?.status || 'idle'}
              </span>
            </div>
          </div>

          {campaignStatus && campaignStatus.totalBatches > 0 && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>
                    Processed: {campaignStatus.completedBatches.toLocaleString()} / {campaignStatus.totalBatches.toLocaleString()} Batches
                  </span>
                  <span>{campaignStatus.percentage}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, campaignStatus.percentage)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-xs">
                <div className="bg-slate-50 p-3 rounded-md border border-slate-100">
                  <span className="text-slate-500 block">Waiting in Queue</span>
                  <span className="font-semibold text-amber-600 text-sm">
                    {campaignStatus.waitingBatches}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-md border border-slate-100">
                  <span className="text-slate-500 block">Active Workers</span>
                  <span className="font-semibold text-indigo-600 text-sm">
                    {campaignStatus.activeBatches}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-md border border-slate-100">
                  <span className="text-slate-500 block">Completed Batches</span>
                  <span className="font-semibold text-emerald-600 text-sm">
                    {campaignStatus.completedBatches}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-md border border-slate-100">
                  <span className="text-slate-500 block">Failed Batches</span>
                  <span className="font-semibold text-rose-600 text-sm">
                    {campaignStatus.failedBatches}
                  </span>
                </div>
              </div>

              {campaignStatus.error && (
                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-xs">
                  {campaignStatus.error}
                </div>
              )}

              <div className="pt-2 flex flex-wrap gap-4 text-xs text-indigo-600 font-medium">
                <a
                  href="/api/campaign/status"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline flex items-center gap-1"
                >
                  🔗 View Queue Status API (JSON)
                </a>
                {' '}|{' '}
                <a
                  href="http://localhost:1080"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline flex items-center gap-1 text-slate-600"
                >
                  📫 Open MailDev Inbox
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Customer Records Table */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-semibold text-slate-800 text-sm flex justify-between items-center">
            <span>Customer Directory</span>
            {selectAll && (
              <span className="text-xs font-normal text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-200">
                All database records selected
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                  <th className="p-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      title="Select All Customers in Database"
                    />
                  </th>
                  <th className="p-4 w-24">ID</th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      Loading data...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-red-500 font-medium">
                      {error}
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => {
                    const isChecked = selectAll || selectedCustomerIds.has(customer.id);
                    return (
                      <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 w-12 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={selectAll}
                            onChange={() => toggleSelectCustomer(customer.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
                          />
                        </td>
                        <td className="p-4 text-slate-500 font-mono">{customer.id}</td>
                        <td className="p-4 font-medium text-slate-800">{customer.name}</td>
                        <td className="p-4 text-blue-600">{customer.email}</td>
                      </tr>
                    );
                  })
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
