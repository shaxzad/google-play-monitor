import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const db = await connectDB();
    const { searchParams } = request.nextUrl;

    const packageName = searchParams.get("packageName");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    if (!packageName) {
      return NextResponse.json(
        { error: "packageName is required" },
        { status: 400 },
      );
    }

    const reviews = await db
      .collection("reviews")
      .find({ appId: packageName })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json(
      {
        reviews: reviews.map((review: any) => ({
          packageName: review.appId,
          title: review.userName,
          body: review.text,
          rating: review.rating,
          publishedAt: review.publishedAt,
        })),
        total: reviews.length,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 },
    );
  }
}
