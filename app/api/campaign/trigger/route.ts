import { NextResponse } from 'next/server';
import { campaignQueue } from '@/lib/campaign';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const BATCH_SIZE = 200;

export async function POST() {
  try {
    const dbPath = path.join(process.cwd(), 'public', 'customers.sqlite');

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json(
        { error: 'Database file not found. Please run data generation.' },
        { status: 404 }
      );
    }

    const db = new DatabaseSync(dbPath);
    const countRow = db.prepare('SELECT COUNT(*) as total FROM customers').get() as { total: number };
    const total = countRow.total || 0;
    db.close();

    if (total === 0) {
      return NextResponse.json({ message: 'No customers found to process.' }, { status: 400 });
    }

    const totalBatches = Math.ceil(total / BATCH_SIZE);

    // Clean up previous jobs so the tracker resets accurately
    try {
      await campaignQueue.drain(true); // Drain waiting/delayed
      await campaignQueue.clean(0, 0, 'completed'); // Remove completed
      await campaignQueue.clean(0, 0, 'failed'); // Remove failed
    } catch (e) {
      console.log('Queue cleanup error (can be ignored on fresh start):', e);
    }

    // Enqueue a job for each batch
    // We add an array of jobs using addBulk for performance
    const jobs = [];
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

    await campaignQueue.addBulk(jobs);

    return NextResponse.json(
      {
        message: `Campaign triggered. Added ${totalBatches} jobs to the queue to process ${total} customers.`,
        statusUrl: '/api/campaign/status',
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('Error triggering campaign:', error);
    return NextResponse.json({ error: 'Failed to trigger campaign.' }, { status: 500 });
  }
}
