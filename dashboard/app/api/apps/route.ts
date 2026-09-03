import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const db = await connectDB();
    const { searchParams } = request.nextUrl;
    
    const packageName = searchParams.get('packageName');
    const query = searchParams.get('query');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // If no parameters, return list of all packageNames for the dropdown
    if (!packageName && !query) {
      const apps = await db
        .collection('apps')
        .find({})
        .limit(limit)
        .toArray();

      return NextResponse.json(
        {
          apps: apps.map((app: any) => app.packageName).filter(Boolean),
          total: apps.length,
        },
        { status: 200 }
      );
    }

    // Otherwise, return full app objects
    let queryFilter: any = {};
    if (packageName) {
      queryFilter.packageName = packageName;
    }

    const appsData = await db
      .collection('apps')
      .find(queryFilter)
      .limit(limit)
      .toArray();

    return NextResponse.json(
      {
        apps: appsData.map((app: any) => ({
          packageName: app.packageName,
          title: app.title,
          score: app.score || 0,
          ratings: app.ratings || 0,
          reviews: app.reviews || 0,
          genre: app.genre || 'Unknown',
        })),
        total: appsData.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching apps:', error);
    return NextResponse.json(
      { error: 'Failed to fetch apps' },
      { status: 500 }
    );
  }
}
