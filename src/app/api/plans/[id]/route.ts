import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { deletePlan, updatePlan } from "@/services/plan.service";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const plan = await updatePlan(params.id, body);
    return NextResponse.json({ plan });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update plan";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    const result = await deletePlan(params.id);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete plan";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
