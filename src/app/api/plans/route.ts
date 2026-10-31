import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { createPlan, listPlans } from "@/services/plan.service";

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const includeInactive =
      req.nextUrl.searchParams.get("includeInactive") === "true";
    const plans = await listPlans({ includeInactive });
    return NextResponse.json({ plans });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch plans";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const plan = await createPlan(body);
    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create plan";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
