import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth";
import { processCheckout } from "@/services/subscription.service";

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const session = await getCurrentSession();
    if (!session.isAuthenticated || !session.clerkId) {
      return NextResponse.json(
        { error: "Please sign in to complete checkout" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const result = await processCheckout({
      clerkId: session.clerkId,
      planId: body.planId,
      paymentMode: body.paymentMode,
      upfrontPercentage: body.upfrontPercentage,
      couponCode: body.couponCode,
      enforceActivePlanQueueRules: true,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Checkout processing failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
