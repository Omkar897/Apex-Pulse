import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { createCoupon, listCoupons } from "@/services/coupon.service";

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const onlyActive = req.nextUrl.searchParams.get("onlyActive") === "true";
    const coupons = await listCoupons({ onlyActive });
    return NextResponse.json({ coupons });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch coupons";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const coupon = await createCoupon(body);
    return NextResponse.json({ coupon }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create coupon";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
