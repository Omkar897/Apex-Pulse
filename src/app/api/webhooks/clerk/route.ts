import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import {
  handleClerkWebhookEvent,
  verifyClerkWebhookSignature,
} from "@/lib/webhook-processor";

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const rawBody = await req.text();

    const event = verifyClerkWebhookSignature(
      rawBody,
      {
        "svix-id": req.headers.get("svix-id"),
        "svix-timestamp": req.headers.get("svix-timestamp"),
        "svix-signature": req.headers.get("svix-signature"),
      },
      process.env.CLERK_WEBHOOK_SECRET
    );

    const result = await handleClerkWebhookEvent(event);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook processing failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
