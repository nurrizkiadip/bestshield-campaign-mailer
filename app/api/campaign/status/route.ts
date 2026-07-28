import { NextResponse, NextRequest } from 'next/server';
import { getCampaignStatus } from '@/services/campaignService';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaignId') || undefined;
    const result = await getCampaignStatus(campaignId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching queue status:', error);
    return NextResponse.json({ error: 'Failed to fetch queue status' }, { status: 500 });
  }
}
