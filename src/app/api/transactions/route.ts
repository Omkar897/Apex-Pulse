import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth";
import {
  listGlobalTransactions,
  listUserTransactions,
  overrideTransactionToCompleted,
  settlePartialTransactionByUser,
} from "@/services/subscription.service";
import { PaymentStatus } from "@/types/domain";

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const session = await getCurrentSession();
    const scope = req.nextUrl.searchParams.get("scope");
    const statusParam = req.nextUrl.searchParams.get("status") as
      | PaymentStatus
      | null;

    if (scope === "global") {
      const globalData = await listGlobalTransactions(
        statusParam ? { status: statusParam } : undefined
      );
      return NextResponse.json(globalData);
    }

    if (!session.clerkId) {
      return NextResponse.json({ transactions: [] });
    }

    const transactions = await listUserTransactions(session.clerkId);
    return NextResponse.json({ transactions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load transactions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await connectToDatabase();
    const session = await getCurrentSession();
    const body = await req.json();
    const action = body.action || body.mode;

    if (action === "ADMIN_OVERRIDE") {
      const result = await overrideTransactionToCompleted({
        transactionId: body.transactionId,
        adminIdentifier: session.user?.email || "admin@apexpulse.in",
        note: body.note,
      });
      return NextResponse.json(result);
    }

    if (action === "USER_SETTLE") {
      if (!session.clerkId) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }
      const result = await settlePartialTransactionByUser({
        transactionId: body.transactionId,
        clerkId: session.clerkId,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Transaction update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
