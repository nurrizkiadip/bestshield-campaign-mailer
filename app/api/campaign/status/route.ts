import { NextResponse } from 'next/server';
import { getCampaignStatus } from '@/services/campaignService';

export async function GET() {
  try {
    const result = await getCampaignStatus();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching queue status:', error);
    return NextResponse.json({ error: 'Failed to fetch queue status' }, { status: 500 });
  }
}
