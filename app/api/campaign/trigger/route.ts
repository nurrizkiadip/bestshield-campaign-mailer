import { NextResponse, NextRequest } from 'next/server';
import { campaignQueue } from '@/lib/campaign';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const BATCH_SIZE = 200;

export async function POST(req: NextRequest) {
  try {
    let body: { sendToAll?: boolean; customerIds?: number[] } = {};
    try {
      body = await req.json();
    } catch {
      // Body empty or not JSON, fallback to sendToAll: true
    }

    const { sendToAll = false, customerIds = [] } = body;

    const dbPath = path.join(process.cwd(), 'public', 'customers.sqlite');

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json(
        { error: 'Database file not found. Please run data generation.' },
        { status: 404 }
      );
    }

    // Clean up previous jobs so the tracker resets accurately
    try {
      await campaignQueue.drain(true);
      await campaignQueue.clean(0, 0, 'completed');
      await campaignQueue.clean(0, 0, 'failed');
    } catch (e) {
      console.log('Queue cleanup error (can be ignored on fresh start):', e);
    }

    const jobs = [];
    let totalTargeted = 0;
    let totalBatches = 0;

    if (!sendToAll && Array.isArray(customerIds) && customerIds.length > 0) {
      totalTargeted = customerIds.length;
      totalBatches = Math.ceil(totalTargeted / BATCH_SIZE);

      for (let i = 0; i < totalBatches; i++) {
        const chunk = customerIds.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        jobs.push({
          name: 'send-batch',
          data: {
            customerIds: chunk,
            batchIndex: i + 1,
            totalBatches,
          },
        });
      }
    } else {
      const db = new DatabaseSync(dbPath);
      const countRow = db.prepare('SELECT COUNT(*) as total FROM customers').get() as { total: number };
      totalTargeted = countRow.total || 0;
      db.close();

      if (totalTargeted === 0) {
        return NextResponse.json({ message: 'No customers found to process.' }, { status: 400 });
      }

      totalBatches = Math.ceil(totalTargeted / BATCH_SIZE);

      for (let i = 0; i < totalBatches; i++) {
        jobs.push({
          name: 'send-batch',
          data: {
            offset: i * BATCH_SIZE,
            limit: BATCH_SIZE,
            batchIndex: i + 1,
            totalBatches,
          },
        });
      }
    }

    await campaignQueue.addBulk(jobs);

    return NextResponse.json(
      {
        message: `Campaign triggered. Added ${totalBatches} jobs to process ${totalTargeted} customers.`,
        statusUrl: '/api/campaign/status',
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('Error triggering campaign:', error);
    return NextResponse.json({ error: 'Failed to trigger campaign.' }, { status: 500 });
  }
}
