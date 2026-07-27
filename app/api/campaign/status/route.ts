import { NextResponse } from 'next/server';
import { campaignQueue } from '@/lib/campaign';

export async function GET() {
  try {
    const jobCounts = await campaignQueue.getJobCounts();
    console.log('jobCounts:', jobCounts);
    
    const waiting = jobCounts.waiting || 0;
    const active = jobCounts.active || 0;
    const completed = jobCounts.completed || 0;
    const failed = jobCounts.failed || 0;
    const delayed = jobCounts.delayed || 0;

    const totalJobs = waiting + active + completed + failed + delayed;
    const processed = completed;

    const percentage = totalJobs > 0 ? Number(((processed / totalJobs) * 100).toFixed(2)) : 0;
    
    let status = 'idle';
    if (totalJobs > 0) {
      if (processed + failed === totalJobs) {
        status = 'completed';
      } else {
        status = 'running';
      }
    }

    return NextResponse.json({
      status,
      percentage,
      totalBatches: totalJobs,
      completedBatches: completed,
      failedBatches: failed,
      activeBatches: active,
      waitingBatches: waiting,
    });
  } catch (error) {
    console.error('Error fetching queue status:', error);
    return NextResponse.json({ error: 'Failed to fetch queue status' }, { status: 500 });
  }
}
