import { GET } from '@/app/api/campaign/status/route';
import { campaignQueue } from '@/lib/campaign';
import { expect, test, vi, beforeEach, describe } from 'vitest';

vi.mock('@/lib/campaign', () => {
  return {
    campaignQueue: {
      getJobCounts: vi.fn(),
    },
  };
});

describe('API Route - Campaign Status Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Status calculation is mapped correctly from job counts', async () => {
    (campaignQueue.getJobCounts as any).mockResolvedValue({
      waiting: 5,
      active: 2,
      completed: 10,
      failed: 1,
      delayed: 0,
    });

    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toEqual({
      status: 'running',
      percentage: 55.56,
      totalBatches: 18,
      completedBatches: 10,
      failedBatches: 1,
      activeBatches: 2,
      waitingBatches: 5,
    });
  });

  test('Status returns idle when there are no jobs in queue', async () => {
    (campaignQueue.getJobCounts as any).mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    });

    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('idle');
    expect(data.percentage).toBe(0);
  });

  test('Status returns completed when all jobs are finished', async () => {
    (campaignQueue.getJobCounts as any).mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 18,
      failed: 2,
      delayed: 0,
    });

    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('completed');
    expect(data.percentage).toBe(90); // 18 / 20 * 100
  });
});
