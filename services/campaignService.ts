import { campaignQueue } from '@/lib/campaign';
import { getCustomerCount, getBatchStartIds } from '@/db/sqlite';
import crypto from 'crypto';

const BATCH_SIZE = 200;

export type CampaignStatus = {
  status: 'idle' | 'running' | 'completed';
  percentage: number;
  totalBatches: number;
  completedBatches: number;
  failedBatches: number;
  activeBatches: number;
  waitingBatches: number;
  error?: string | null;
};

export async function triggerCampaign(customerIds: number[], sendToAll: boolean) {
  const jobs = [];
  let totalTargeted = 0;
  let totalBatches = 0;
  const campaignId = crypto.randomUUID();

  if (!sendToAll) {
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      throw new Error('No customers selected for the campaign.');
    }
    totalTargeted = customerIds.length;
    totalBatches = Math.ceil(totalTargeted / BATCH_SIZE);

    for (let i = 0; i < totalBatches; i++) {
      const chunk = customerIds.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
      jobs.push({
        name: 'send-batch',
        data: {
          campaignId,
          customerIds: chunk,
          batchIndex: i + 1,
          totalBatches,
        },
      });
    }
  } else {
    totalTargeted = getCustomerCount();
    const startIds = getBatchStartIds(BATCH_SIZE);

    if (totalTargeted === 0 || startIds.length === 0) {
      throw new Error('No customers found to process.');
    }

    totalBatches = startIds.length;

    for (let i = 0; i < totalBatches; i++) {
      jobs.push({
        name: 'send-batch',
        data: {
          campaignId,
          lastId: startIds[i] - 1,
          limit: BATCH_SIZE,
          batchIndex: i + 1,
          totalBatches,
        },
      });
    }
  }

  await campaignQueue.addBulk(jobs);

  return {
    campaignId,
    totalBatches,
    totalTargeted,
  };
}

export async function getCampaignStatus(campaignId?: string): Promise<CampaignStatus> {
  let waiting = 0;
  let active = 0;
  let completed = 0;
  let failed = 0;
  let delayed = 0;

  if (campaignId) {
    const [waitingJobs, activeJobs, completedJobs, failedJobs, delayedJobs] = await Promise.all([
      campaignQueue.getJobs(['waiting']),
      campaignQueue.getJobs(['active']),
      campaignQueue.getJobs(['completed']),
      campaignQueue.getJobs(['failed']),
      campaignQueue.getJobs(['delayed']),
    ]);

    const countJobs = (jobs: any[]) => jobs.filter((j) => j.data?.campaignId === campaignId).length;

    waiting = countJobs(waitingJobs);
    active = countJobs(activeJobs);
    completed = countJobs(completedJobs);
    failed = countJobs(failedJobs);
    delayed = countJobs(delayedJobs);
  } else {
    const jobCounts = await campaignQueue.getJobCounts();
    waiting = jobCounts.waiting || 0;
    active = jobCounts.active || 0;
    completed = jobCounts.completed || 0;
    failed = jobCounts.failed || 0;
    delayed = jobCounts.delayed || 0;
  }

  const totalJobs = waiting + active + completed + failed + delayed;
  const processed = completed;

  const percentage = totalJobs > 0 ? Number(((processed / totalJobs) * 100).toFixed(2)) : 0;

  let status: 'idle' | 'running' | 'completed' = 'idle';
  if (totalJobs > 0) {
    if (processed + failed === totalJobs) {
      status = 'completed';
    } else {
      status = 'running';
    }
  }

  return {
    status,
    percentage,
    totalBatches: totalJobs,
    completedBatches: completed,
    failedBatches: failed,
    activeBatches: active,
    waitingBatches: waiting,
  };
}
