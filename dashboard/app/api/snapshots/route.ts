import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const db = await connectDB();
    const { searchParams } = request.nextUrl;
    
    const packageName = searchParams.get('packageName');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    if (!packageName) {
      return NextResponse.json(
        { error: 'packageName is required' },
        { status: 400 }
      );
    }

    const snapshots = await db
      .collection('app_snapshots')
      .find({ packageName })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json(
      {
        snapshots: snapshots.map((snap: any) => ({
          packageName: snap.packageName,
          snapshot: {
            title: snap.snapshot?.title,
            score: snap.snapshot?.score || 0,
            ratings: snap.snapshot?.ratings || 0,
            reviews: snap.snapshot?.reviews || 0,
          },
          timestamp: snap.timestamp,
        })),
        total: snapshots.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching snapshots:', error);
    return NextResponse.json(
      { error: 'Failed to fetch snapshots' },
      { status: 500 }
    );
  }
}
