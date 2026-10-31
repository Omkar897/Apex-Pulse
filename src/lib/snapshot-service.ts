import { ISubscriptionPlanDTO, PlanSnapshot } from "@/types/domain";
import { roundCurrency } from "@/lib/utils";

export interface PlanSnapshotSource {
  _id?: string | { toString(): string };
  planId?: string;
  name: string;
  durationMonths: number;
  baseMonthlyPrice: number;
  discountPercentage: number;
  version?: number;
}

/**
 * Deliverable #4: Snapshot Strategy Implementation
 * Creates an immutable, frozen point-in-time snapshot of a SubscriptionPlan
 * to embed inside Transaction and User.subscription documents.
 */
export function createPlanSnapshot(
  plan: PlanSnapshotSource,
  capturedAt: Date = new Date()
): PlanSnapshot {
  const resolvedId =
    plan.planId ||
    (typeof plan._id === "string"
      ? plan._id
      : plan._id?.toString() || "unknown-plan");

  const snapshot: PlanSnapshot = {
    planId: resolvedId,
    name: plan.name.trim(),
    durationMonths: plan.durationMonths,
    baseMonthlyPrice: roundCurrency(plan.baseMonthlyPrice),
    discountPercentage: roundCurrency(plan.discountPercentage),
    version: plan.version ?? 1,
    capturedAt: capturedAt.toISOString(),
  };

  return Object.freeze(snapshot);
}

/**
 * Determines whether an update to a SubscriptionPlan modifies any financial/billing terms.
 * When true, the service layer increments the plan's `version` counter.
 */
export function hasPlanPricingChanged(
  existingPlan: {
    durationMonths: number;
    baseMonthlyPrice: number;
    discountPercentage: number;
  },
  updatedFields: {
    durationMonths?: number;
    baseMonthlyPrice?: number;
    discountPercentage?: number;
  }
): boolean {
  if (
    updatedFields.durationMonths !== undefined &&
    updatedFields.durationMonths !== existingPlan.durationMonths
  ) {
    return true;
  }
  if (
    updatedFields.baseMonthlyPrice !== undefined &&
    roundCurrency(updatedFields.baseMonthlyPrice) !==
      roundCurrency(existingPlan.baseMonthlyPrice)
  ) {
    return true;
  }
  if (
    updatedFields.discountPercentage !== undefined &&
    roundCurrency(updatedFields.discountPercentage) !==
      roundCurrency(existingPlan.discountPercentage)
  ) {
    return true;
  }
  return false;
}

export interface SnapshotComparisonReport {
  isDrifted: boolean;
  snapshotVersion: number;
  liveVersion: number | null;
  snapshotBaseMonthlyPrice: number;
  liveBaseMonthlyPrice: number | null;
  snapshotDiscountPercentage: number;
  liveDiscountPercentage: number | null;
  summary: string;
}

/**
 * Compares a historical transaction's frozen `planSnapshot` against the current live plan catalog.
 * Used by the Invoice & Snapshot Inspector UI and audit tests.
 */
export function compareSnapshotWithLivePlan(
  snapshot: PlanSnapshot,
  livePlan: Pick<
    ISubscriptionPlanDTO,
    "baseMonthlyPrice" | "discountPercentage" | "durationMonths" | "version"
  > | null
): SnapshotComparisonReport {
  if (!livePlan) {
    return {
      isDrifted: true,
      snapshotVersion: snapshot.version,
      liveVersion: null,
      snapshotBaseMonthlyPrice: snapshot.baseMonthlyPrice,
      liveBaseMonthlyPrice: null,
      snapshotDiscountPercentage: snapshot.discountPercentage,
      liveDiscountPercentage: null,
      summary:
        "Catalog plan was archived or deleted; historical invoice remains 100% intact via embedded snapshot.",
    };
  }

  const priceChanged =
    roundCurrency(snapshot.baseMonthlyPrice) !==
    roundCurrency(livePlan.baseMonthlyPrice);
  const discountChanged =
    roundCurrency(snapshot.discountPercentage) !==
    roundCurrency(livePlan.discountPercentage);
  const durationChanged = snapshot.durationMonths !== livePlan.durationMonths;
  const isDrifted = priceChanged || discountChanged || durationChanged;

  return {
    isDrifted,
    snapshotVersion: snapshot.version,
    liveVersion: livePlan.version,
    snapshotBaseMonthlyPrice: snapshot.baseMonthlyPrice,
    liveBaseMonthlyPrice: livePlan.baseMonthlyPrice,
    snapshotDiscountPercentage: snapshot.discountPercentage,
    liveDiscountPercentage: livePlan.discountPercentage,
    summary: isDrifted
      ? `Historical rate preserved at v${snapshot.version} (₹${snapshot.baseMonthlyPrice}/mo, ${snapshot.discountPercentage}% off) despite live plan changing to v${livePlan.version} (₹${livePlan.baseMonthlyPrice}/mo, ${livePlan.discountPercentage}% off).`
      : `Matches current live catalog pricing (v${snapshot.version}).`,
  };
}
