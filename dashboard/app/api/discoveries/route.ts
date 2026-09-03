import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const db = await connectDB();
    const { searchParams } = request.nextUrl;
    
    const query = searchParams.get('query');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    let searchFilter: any = {};
    if (query) {
      searchFilter.query = query;
    }

    const discoveries = await db
      .collection('app_discoveries')
      .find(searchFilter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json(
      {
        discoveries: discoveries.map((discovery: any) => ({
          query: discovery.query,
          timestamp: discovery.timestamp,
          appsFound: discovery.apps?.length || 0,
        })),
        total: discoveries.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching discoveries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch discoveries' },
      { status: 500 }
    );
  }
}
