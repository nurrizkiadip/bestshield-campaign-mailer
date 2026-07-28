import { Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import Database from 'better-sqlite3';
import { getDbConnection, Customer } from '@/db/sqlite';
import { redisConnection } from '@/lib/campaign';

interface JobData {
  campaignId?: string;
  customerIds?: number[];
  lastId?: number;
  offset?: number;
  limit?: number;
  batchIndex: number;
  totalBatches: number;
}

const db = getDbConnection();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || '127.0.0.1',
  port: parseInt(process.env.SMTP_PORT || '1025', 10),
  secure: false,
  pool: true,
  maxConnections: 50,
  maxMessages: 10000,
  tls: { rejectUnauthorized: false },
});

export async function processJob(
  job: Job<JobData>,
  dbConnection: Database.Database,
  emailTransporter: nodemailer.Transporter
) {
  const { campaignId, customerIds, lastId, offset, limit, batchIndex, totalBatches } = job.data;
  console.log(`[Batch ${batchIndex}/${totalBatches}] Processing Job ${job.id}...`);

  let customers: Customer[] = [];
  if (Array.isArray(customerIds) && customerIds.length > 0) {
    const placeholders = customerIds.map(() => '?').join(',');
    customers = dbConnection.prepare(`SELECT id, name, email FROM customers WHERE id IN (${placeholders})`).all(...customerIds) as Customer[];
  } else if (lastId !== undefined && limit !== undefined) {
    customers = dbConnection.prepare('SELECT id, name, email FROM customers WHERE id > ? ORDER BY id ASC LIMIT ?').all(lastId, limit) as Customer[];
  } else if (limit !== undefined && offset !== undefined) {
    customers = dbConnection.prepare('SELECT id, name, email FROM customers LIMIT ? OFFSET ?').all(limit, offset) as Customer[];
  } else {
    throw new Error('Invalid job data: Job must provide customerIds, lastId and limit, or limit and offset');
  }

  let success = 0;
  let failed = 0;
  const successfullySentIds: number[] = [];
  const CONCURRENCY_LIMIT = 50;

  let sentIds = new Set<number>();
  if (campaignId && customers.length > 0) {
    const ids = customers.map((c) => c.id);
    const placeholders = ids.map(() => '?').join(',');
    const rows = dbConnection
      .prepare(`SELECT customer_id FROM email_outbox WHERE campaign_id = ? AND customer_id IN (${placeholders})`)
      .all(campaignId, ...ids) as { customer_id: number }[];
    sentIds = new Set(rows.map((r) => r.customer_id));
  }

  // Execute nodemailer requests concurrently in chunks to avoid memory bloat
  for (let i = 0; i < customers.length; i += CONCURRENCY_LIMIT) {
    const chunk = customers.slice(i, i + CONCURRENCY_LIMIT);
    await Promise.all(
      chunk.map(async (c) => {
        try {
          // This will ensure that the same email is not sent twice for the same campaign
          if (campaignId && sentIds.has(c.id)) {
            success++;
            return;
          }

          await emailTransporter.sendMail({
            from: '"BestShield Campaign" <campaign@bestshield.com>',
            to: c.email,
            subject: `Special Announcement for ${c.name}`,
            text: `Hello ${c.name},\n\nWe have an exciting update for you! Thank you for being a valued customer.\n\nBest regards,\nThe BestShield Team`,
          });

          if (campaignId) {
            successfullySentIds.push(c.id);
          }
          success++;
        } catch {
          failed++;
        }
      })
    );
  }

  if (campaignId && successfullySentIds.length > 0) {
    const insert = dbConnection.prepare('INSERT INTO email_outbox (campaign_id, customer_id) VALUES (?, ?)');
    const insertMany = dbConnection.transaction((records: number[]) => {
      for (const id of records) {
        insert.run(campaignId, id);
      }
    });
    insertMany(successfullySentIds);
  }

  console.log(`[Batch ${batchIndex}/${totalBatches}] Completed. Sent: ${success}, Failed: ${failed}`);
  return { success, failed, batchIndex };
}

console.log('Starting BullMQ Campaign Worker...');

const worker = new Worker(
  'campaignQueue',
  async (job: Job<JobData>) => {
    return processJob(job, db, transporter);
  },
  {
    connection: redisConnection,
    concurrency: 10, // Process 10 batches (10000 emails) concurrently per worker process!
  }
);

worker.on('completed', () => {
  // console.log(`Job has completed!`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} has failed with ${err.message}`);
});

process.on('SIGINT', async () => {
  console.log('Shutting down worker gracefully...');
  await worker.close();
  try { db.close(); } catch {}
  transporter.close();
  process.exit(0);
});
