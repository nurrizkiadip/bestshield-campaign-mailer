import { processJob } from '@/scripts/worker.mjs';
import { expect, test, vi, describe } from 'vitest';

describe('Worker Script Unit Tests', () => {
  test('processJob queries DB and successfully dispatches emails', async () => {
    const mockJob = {
      id: 'job-123',
      data: {
        customerIds: [],
        offset: 0,
        limit: 2,
        batchIndex: 1,
        totalBatches: 10,
      },
    };

    const mockCustomers = [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
    ];

    const mockPrepare = vi.fn().mockReturnValue({
      all: vi.fn().mockReturnValue(mockCustomers),
    });

    const mockDbConnection = {
      prepare: mockPrepare,
    };

    const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'some-id' });
    const mockEmailTransporter = {
      sendMail: mockSendMail,
    };

    const result = await processJob(mockJob, mockDbConnection, mockEmailTransporter);

    expect(result).toEqual({ success: 2, failed: 0, batchIndex: 1 });
    expect(mockPrepare).toHaveBeenCalledWith('SELECT id, name, email FROM customers LIMIT ? OFFSET ?');
    expect(mockSendMail).toHaveBeenCalledTimes(2);
  });

  test('processJob tracks failed email dispatches correctly', async () => {
    const mockJob = {
      id: 'job-456',
      data: {
        customerIds: [10],
        batchIndex: 1,
        totalBatches: 1,
      },
    };

    const mockCustomers = [
      { id: 10, name: 'Charlie', email: 'charlie@example.com' },
    ];

    const mockDbConnection = {
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockReturnValue(mockCustomers),
      }),
    };

    const mockSendMail = vi.fn().mockRejectedValue(new Error('SMTP connection error'));
    const mockEmailTransporter = {
      sendMail: mockSendMail,
    };

    const result = await processJob(mockJob, mockDbConnection, mockEmailTransporter);

    expect(result).toEqual({ success: 0, failed: 1, batchIndex: 1 });
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  test('processJob throws error on missing required data (customerIds and offset/limit)', async () => {
    const mockJob = {
      id: 'job-789',
      data: {
        batchIndex: 1,
        totalBatches: 1,
      },
    };

    const mockDbConnection = {};
    const mockEmailTransporter = {};

    await expect(
      processJob(mockJob, mockDbConnection, mockEmailTransporter)
    ).rejects.toThrow('Invalid job data: Job must provide customerIds or both limit and offset');
  });
});
