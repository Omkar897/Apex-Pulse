import mongoose from "mongoose";
import { SubscriptionPlan, ISubscriptionPlanDocument } from "@/models/SubscriptionPlan";
import { ISubscriptionPlanDTO } from "@/types/domain";
import {
  SubscriptionPlanInput,
  SubscriptionPlanInputSchema,
} from "@/lib/validators";
import { hasPlanPricingChanged } from "@/lib/snapshot-service";
import { roundCurrency } from "@/lib/utils";

export function toPlanDTO(doc: ISubscriptionPlanDocument): ISubscriptionPlanDTO {
  return {
    _id: doc._id.toString(),
    name: doc.name,
    description: doc.description,
    durationMonths: doc.durationMonths,
    baseMonthlyPrice: roundCurrency(doc.baseMonthlyPrice),
    discountPercentage: roundCurrency(doc.discountPercentage),
    allowPartialPayment: Boolean(doc.allowPartialPayment),
    minPartialPercentage: doc.minPartialPercentage,
    features: [...doc.features],
    isPopular: Boolean(doc.isPopular),
    isActive: Boolean(doc.isActive),
    version: doc.version,
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
  };
}

export async function listPlans(options?: {
  includeInactive?: boolean;
}): Promise<ISubscriptionPlanDTO[]> {
  const filter = options?.includeInactive ? {} : { isActive: true };
  const plans = await SubscriptionPlan.find(filter).sort({
    durationMonths: 1,
    baseMonthlyPrice: 1,
  });
  return plans.map(toPlanDTO);
}

export async function getPlanById(
  planId: string
): Promise<ISubscriptionPlanDTO | null> {
  if (!mongoose.Types.ObjectId.isValid(planId)) {
    return null;
  }
  const plan = await SubscriptionPlan.findById(planId);
  return plan ? toPlanDTO(plan) : null;
}

export async function createPlan(
  rawInput: SubscriptionPlanInput
): Promise<ISubscriptionPlanDTO> {
  const validated = SubscriptionPlanInputSchema.parse(rawInput);

  const created = await SubscriptionPlan.create({
    ...validated,
    baseMonthlyPrice: roundCurrency(validated.baseMonthlyPrice),
    discountPercentage: roundCurrency(validated.discountPercentage),
    version: 1,
  });

  return toPlanDTO(created);
}

export async function updatePlan(
  planId: string,
  rawUpdates: Partial<SubscriptionPlanInput>
): Promise<ISubscriptionPlanDTO> {
  if (!mongoose.Types.ObjectId.isValid(planId)) {
    throw new Error("Invalid Plan ID");
  }

  const existing = await SubscriptionPlan.findById(planId);
  if (!existing) {
    throw new Error("Subscription plan not found");
  }

  const mergedInput: SubscriptionPlanInput = {
    name: rawUpdates.name ?? existing.name,
    description: rawUpdates.description ?? existing.description,
    durationMonths: rawUpdates.durationMonths ?? existing.durationMonths,
    baseMonthlyPrice: rawUpdates.baseMonthlyPrice ?? existing.baseMonthlyPrice,
    discountPercentage:
      rawUpdates.discountPercentage ?? existing.discountPercentage,
    allowPartialPayment:
      rawUpdates.allowPartialPayment ?? existing.allowPartialPayment,
    minPartialPercentage:
      rawUpdates.minPartialPercentage ?? existing.minPartialPercentage,
    features: rawUpdates.features ?? existing.features,
    isPopular: rawUpdates.isPopular ?? existing.isPopular,
    isActive: rawUpdates.isActive ?? existing.isActive,
  };

  const validated = SubscriptionPlanInputSchema.parse(mergedInput);

  const pricingChanged = hasPlanPricingChanged(existing, validated);
  const nextVersion = pricingChanged ? existing.version + 1 : existing.version;

  existing.name = validated.name;
  existing.description = validated.description;
  existing.durationMonths = validated.durationMonths;
  existing.baseMonthlyPrice = roundCurrency(validated.baseMonthlyPrice);
  existing.discountPercentage = roundCurrency(validated.discountPercentage);
  existing.allowPartialPayment = validated.allowPartialPayment;
  existing.minPartialPercentage = validated.minPartialPercentage;
  existing.features = validated.features;
  existing.isPopular = validated.isPopular;
  existing.isActive = validated.isActive;
  existing.version = nextVersion;

  await existing.save();
  return toPlanDTO(existing);
}

export async function deletePlan(planId: string): Promise<{ deleted: boolean }> {
  if (!mongoose.Types.ObjectId.isValid(planId)) {
    throw new Error("Invalid Plan ID");
  }
  const deleted = await SubscriptionPlan.findByIdAndDelete(planId);
  if (!deleted) {
    throw new Error("Subscription plan not found");
  }
  return { deleted: true };
}
