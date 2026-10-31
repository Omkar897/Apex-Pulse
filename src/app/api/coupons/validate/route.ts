import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { validateCouponForSubtotal } from "@/services/coupon.service";

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const code = String(body.code || "");
    const subtotal = Number(body.subtotalAmount ?? body.subtotal ?? 0);
    const evaluation = await validateCouponForSubtotal(code, subtotal);
    return NextResponse.json({
      ...evaluation,
      coupon: evaluation.coupon ?? null,
      evaluation,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to validate coupon";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
