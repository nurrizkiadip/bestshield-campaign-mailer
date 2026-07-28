import { NextResponse, NextRequest } from 'next/server';
import { triggerCampaign } from '@/services/campaignService';

export async function POST(req: NextRequest) {
  try {
    let body: { sendToAll?: boolean; customerIds?: number[] } = {};
    try {
      body = await req.json();
    } catch {
      // Body empty or not JSON
    }

    const { sendToAll = false, customerIds = [] } = body;

    const result = await triggerCampaign(customerIds, sendToAll);

    return NextResponse.json(
      {
        message: `Campaign triggered. Added ${result.totalBatches} jobs to process ${result.totalTargeted} customers.`,
        campaignId: result.campaignId,
        statusUrl: `/api/campaign/status?campaignId=${result.campaignId}`,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('Error triggering campaign:', error);
    const message = error instanceof Error ? error.message : 'Failed to trigger campaign.';
    const status = message.includes('Database file not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
