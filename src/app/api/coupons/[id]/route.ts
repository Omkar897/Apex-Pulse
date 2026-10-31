import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { deleteCoupon, updateCoupon } from "@/services/coupon.service";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const coupon = await updateCoupon(params.id, body);
    return NextResponse.json({ coupon });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update coupon";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    const result = await deleteCoupon(params.id);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete coupon";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
