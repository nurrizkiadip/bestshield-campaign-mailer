import { POST } from '@/app/api/campaign/trigger/route';
import { campaignQueue } from '@/lib/campaign';
import { NextRequest } from 'next/server';
import { expect, test, vi, beforeEach, describe } from 'vitest';

vi.mock('@/lib/campaign', () => {
  return {
    campaignQueue: {
      drain: vi.fn().mockResolvedValue(undefined),
      clean: vi.fn().mockResolvedValue([]),
      addBulk: vi.fn().mockResolvedValue([]),
    },
  };
});

vi.mock('@/db/sqlite', () => {
  return {
    getCustomerCount: vi.fn().mockReturnValue(500),
    getBatchStartIds: vi.fn().mockReturnValue([1, 201, 401]),
  };
});

describe('API Route - Campaign Trigger Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Selective Triggering enqueues specific IDs', async () => {
    const req = new NextRequest('http://localhost/api/campaign/trigger', {
      method: 'POST',
      body: JSON.stringify({
        sendToAll: false,
        customerIds: [101, 102, 103],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(202);

    const data = await res.json();
    expect(data.message).toContain('Added 1 jobs to process 3 customers');

    expect(campaignQueue.addBulk).toHaveBeenCalledTimes(1);
    expect(campaignQueue.addBulk).toHaveBeenCalledWith([
      {
        name: 'send-batch',
        data: {
          customerIds: [101, 102, 103],
          batchIndex: 1,
          totalBatches: 1,
        },
      },
    ]);
  });

  test('Global Triggering enqueues all database records in chunks of 200', async () => {
    // 500 records -> 3 batches (200, 200, 100)
    const req = new NextRequest('http://localhost/api/campaign/trigger', {
      method: 'POST',
      body: JSON.stringify({
        sendToAll: true,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(202);

    const data = await res.json();
    expect(data.message).toContain('Added 3 jobs to process 500 customers');

    expect(campaignQueue.addBulk).toHaveBeenCalledTimes(1);
    const addedJobs = (campaignQueue.addBulk as any).mock.calls[0][0];
    expect(addedJobs.length).toBe(3);
    expect(addedJobs[0].data).toEqual({
      lastId: 0,
      limit: 200,
      batchIndex: 1,
      totalBatches: 3,
    });
  });

  test('Fails with error when sendToAll is false and customerIds is empty', async () => {
    const req = new NextRequest('http://localhost/api/campaign/trigger', {
      method: 'POST',
      body: JSON.stringify({
        sendToAll: false,
        customerIds: [],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toContain('No customers selected for the campaign');
    expect(campaignQueue.addBulk).not.toHaveBeenCalled();
  });

  test('Processes all customers if sendToAll is true even if customerIds is populated', async () => {
    const req = new NextRequest('http://localhost/api/campaign/trigger', {
      method: 'POST',
      body: JSON.stringify({
        sendToAll: true,
        customerIds: [1, 2, 3],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(202);

    const data = await res.json();
    expect(data.message).toContain('Added 3 jobs to process 500 customers');
  });
});
