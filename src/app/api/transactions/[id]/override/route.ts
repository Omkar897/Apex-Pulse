import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth";
import {
  overrideTransactionToCompleted,
  settlePartialTransactionByUser,
} from "@/services/subscription.service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    const session = await getCurrentSession();
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || body.action || "USER_SETTLE";
    const transactionId = params.id;

    if (mode === "ADMIN_OVERRIDE") {
      const result = await overrideTransactionToCompleted({
        transactionId,
        adminIdentifier: session.user?.email || "admin@apexpulse.in",
        note: body.note,
      });
      return NextResponse.json(result);
    }

    if (!session.clerkId) {
      return NextResponse.json(
        { error: "Please sign in to settle your balance" },
        { status: 401 }
      );
    }

    const result = await settlePartialTransactionByUser({
      transactionId,
      clerkId: session.clerkId,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to settle balance";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
