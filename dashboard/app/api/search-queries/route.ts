import { NextRequest, NextResponse } from 'next/server';
import { searchQueries } from '@/lib/search-queries';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(
      {
        queries: searchQueries,
        total: searchQueries.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching search queries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch search queries' },
      { status: 500 }
    );
  }
}
