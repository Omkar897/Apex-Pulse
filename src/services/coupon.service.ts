import mongoose from "mongoose";
import { Coupon, ICouponDocument } from "@/models/Coupon";
import { ICouponDTO } from "@/types/domain";
import { CouponInput, CouponInputSchema } from "@/lib/validators";
import {
  CouponEvaluationResult,
  evaluateCoupon,
} from "@/lib/subscription-engine";
import { roundCurrency } from "@/lib/utils";

export function toCouponDTO(doc: ICouponDocument): ICouponDTO {
  return {
    _id: doc._id.toString(),
    code: doc.code,
    description: doc.description,
    discountType: doc.discountType,
    discountValue: roundCurrency(doc.discountValue),
    minPurchaseAmount: roundCurrency(doc.minPurchaseAmount),
    maxDiscountAmount:
      doc.maxDiscountAmount !== null && doc.maxDiscountAmount !== undefined
        ? roundCurrency(doc.maxDiscountAmount)
        : null,
    expiryDate: doc.expiryDate.toISOString(),
    usageLimit: doc.usageLimit,
    usedCount: doc.usedCount,
    isActive: Boolean(doc.isActive),
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
  };
}

export async function listCoupons(options?: {
  onlyActive?: boolean;
}): Promise<ICouponDTO[]> {
  const filter = options?.onlyActive ? { isActive: true } : {};
  const coupons = await Coupon.find(filter).sort({ createdAt: -1 });
  return coupons.map(toCouponDTO);
}

export async function getCouponByCode(
  code: string
): Promise<ICouponDTO | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const doc = await Coupon.findOne({ code: normalized });
  return doc ? toCouponDTO(doc) : null;
}

export async function validateCouponForSubtotal(
  code: string,
  subtotalAfterPlanDiscount: number,
  now: Date = new Date()
): Promise<CouponEvaluationResult & { coupon: ICouponDTO | null }> {
  const coupon = await getCouponByCode(code);
  const evaluation = evaluateCoupon(coupon, subtotalAfterPlanDiscount, now);
  return {
    ...evaluation,
    coupon: evaluation.valid ? coupon : null,
  };
}

function parseCouponExpiryDate(dateVal: string | Date): Date {
  if (dateVal instanceof Date) return dateVal;
  const trimmed = dateVal.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T23:59:59.999Z`);
  }
  return new Date(trimmed);
}

export async function createCoupon(
  rawInput: CouponInput
): Promise<ICouponDTO> {
  const validated = CouponInputSchema.parse(rawInput);
  const normalizedCode = validated.code.trim().toUpperCase();

  const existing = await Coupon.findOne({ code: normalizedCode });
  if (existing) {
    throw new Error(`Coupon code "${normalizedCode}" already exists`);
  }

  const created = await Coupon.create({
    code: normalizedCode,
    description: validated.description,
    discountType: validated.discountType,
    discountValue: roundCurrency(validated.discountValue),
    minPurchaseAmount: roundCurrency(validated.minPurchaseAmount ?? 0),
    maxDiscountAmount:
      validated.maxDiscountAmount !== null &&
      validated.maxDiscountAmount !== undefined
        ? roundCurrency(validated.maxDiscountAmount)
        : null,
    expiryDate: parseCouponExpiryDate(validated.expiryDate),
    usageLimit: validated.usageLimit ?? 100,
    usedCount: 0,
    isActive: validated.isActive ?? true,
  });

  return toCouponDTO(created);
}

export async function updateCoupon(
  couponId: string,
  rawUpdates: Partial<CouponInput>
): Promise<ICouponDTO> {
  if (!mongoose.Types.ObjectId.isValid(couponId)) {
    throw new Error("Invalid Coupon ID");
  }

  const existing = await Coupon.findById(couponId);
  if (!existing) {
    throw new Error("Coupon not found");
  }

  const mergedInput: CouponInput = {
    code: rawUpdates.code ?? existing.code,
    description: rawUpdates.description ?? existing.description,
    discountType: rawUpdates.discountType ?? existing.discountType,
    discountValue: rawUpdates.discountValue ?? existing.discountValue,
    minPurchaseAmount:
      rawUpdates.minPurchaseAmount ?? existing.minPurchaseAmount,
    maxDiscountAmount:
      rawUpdates.maxDiscountAmount !== undefined
        ? rawUpdates.maxDiscountAmount
        : existing.maxDiscountAmount,
    expiryDate: rawUpdates.expiryDate ?? existing.expiryDate.toISOString(),
    usageLimit: rawUpdates.usageLimit ?? existing.usageLimit,
    isActive: rawUpdates.isActive ?? existing.isActive,
  };

  const validated = CouponInputSchema.parse(mergedInput);
  const normalizedCode = validated.code.trim().toUpperCase();

  if (normalizedCode !== existing.code) {
    const duplicate = await Coupon.findOne({ code: normalizedCode });
    if (duplicate) {
      throw new Error(`Coupon code "${normalizedCode}" already exists`);
    }
  }

  existing.code = normalizedCode;
  existing.description = validated.description;
  existing.discountType = validated.discountType;
  existing.discountValue = roundCurrency(validated.discountValue);
  existing.minPurchaseAmount = roundCurrency(validated.minPurchaseAmount);
  existing.maxDiscountAmount =
    validated.maxDiscountAmount !== null &&
    validated.maxDiscountAmount !== undefined
      ? roundCurrency(validated.maxDiscountAmount)
      : null;
  existing.expiryDate = parseCouponExpiryDate(validated.expiryDate);
  existing.usageLimit = validated.usageLimit;
  existing.isActive = validated.isActive;

  await existing.save();
  return toCouponDTO(existing);
}

export async function deleteCoupon(
  couponId: string
): Promise<{ deleted: boolean }> {
  if (!mongoose.Types.ObjectId.isValid(couponId)) {
    throw new Error("Invalid Coupon ID");
  }
  const deleted = await Coupon.findByIdAndDelete(couponId);
  if (!deleted) {
    throw new Error("Coupon not found");
  }
  return { deleted: true };
}
