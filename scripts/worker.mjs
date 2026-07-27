import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import nodemailer from 'nodemailer';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'public', 'customers.sqlite');

if (!fs.existsSync(dbPath)) {
  throw new Error(`Database file not found at: ${dbPath}`);
}
const db = new DatabaseSync(dbPath);

const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || '127.0.0.1',
  port: parseInt(process.env.SMTP_PORT || '1025', 10),
  secure: false,
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  tls: { rejectUnauthorized: false },
});

console.log('Starting BullMQ Campaign Worker...');

const worker = new Worker(
  'campaignQueue',
  async (job) => {
    const { offset, limit, batchIndex, totalBatches } = job.data;
    console.log(`[Batch ${batchIndex}/${totalBatches}] Processing Job ${job.id}...`);

    const customers = db.prepare('SELECT * FROM customers LIMIT ? OFFSET ?').all(limit, offset);

    let success = 0;
    let failed = 0;

    // Execute nodemailer requests concurrently in the batch for maximum speed
    await Promise.all(
      customers.map(async (c) => {
        try {
          await transporter.sendMail({
            from: '"BestShield Campaign" <campaign@bestshield.com>',
            to: c.email,
            subject: `Special Announcement for ${c.name}`,
            text: `Hello ${c.name},\n\nWe have an exciting update for you! Thank you for being a valued customer.\n\nBest regards,\nThe BestShield Team`,
          });
          success++;
        } catch (e) {
          failed++;
        }
      })
    );

    console.log(`[Batch ${batchIndex}/${totalBatches}] Completed. Sent: ${success}, Failed: ${failed}`);
    return { success, failed, batchIndex };
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process 5 batches (1000 emails) concurrently per worker process!
  }
);

worker.on('completed', (job) => {
  // console.log(`Job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} has failed with ${err.message}`);
});

process.on('SIGINT', async () => {
  console.log('Shutting down worker gracefully...');
  await worker.close();
  try { db.close(); } catch (e) {}
  transporter.close();
  process.exit(0);
});
