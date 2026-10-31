import {
  DiscountType,
  IUserSubscriptionDTO,
  PaymentMode,
  PaymentSplit,
  PricingBreakdown,
  SubscriptionAlert,
} from "@/types/domain";
import { formatINR, roundCurrency } from "@/lib/utils";

export interface PlanPricingInput {
  durationMonths: number;
  baseMonthlyPrice: number;
  discountPercentage: number;
}

export interface CouponCandidate {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minPurchaseAmount?: number;
  maxDiscountAmount?: number | null;
  expiryDate: string | Date;
  usageLimit?: number;
  usedCount?: number;
  isActive: boolean;
}

export interface CouponEvaluationResult {
  valid: boolean;
  reason?: string;
  code: string | null;
  discountType: DiscountType | null;
  discountValue: number;
  discountAmount: number;
}

/**
 * Validates a coupon against business rules and computes the exact deduction amount.
 */
export function evaluateCoupon(
  coupon: CouponCandidate | null | undefined,
  subtotalAfterPlanDiscount: number,
  now: Date = new Date()
): CouponEvaluationResult {
  if (!coupon) {
    return {
      valid: false,
      reason: "Coupon not found",
      code: null,
      discountType: null,
      discountValue: 0,
      discountAmount: 0,
    };
  }

  const normalizedCode = coupon.code.trim().toUpperCase();

  if (!coupon.isActive) {
    return {
      valid: false,
      reason: `Coupon "${normalizedCode}" is currently inactive`,
      code: normalizedCode,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount: 0,
    };
  }

  const expiry =
    typeof coupon.expiryDate === "string"
      ? new Date(coupon.expiryDate)
      : coupon.expiryDate;

  if (Number.isNaN(expiry.getTime()) || expiry.getTime() < now.getTime()) {
    return {
      valid: false,
      reason: `Coupon "${normalizedCode}" has expired`,
      code: normalizedCode,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount: 0,
    };
  }

  if (
    coupon.usageLimit !== undefined &&
    coupon.usedCount !== undefined &&
    coupon.usedCount >= coupon.usageLimit
  ) {
    return {
      valid: false,
      reason: `Coupon "${normalizedCode}" has reached its usage limit`,
      code: normalizedCode,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount: 0,
    };
  }

  const minPurchase = coupon.minPurchaseAmount ?? 0;
  if (subtotalAfterPlanDiscount < minPurchase) {
    return {
      valid: false,
      reason: `Minimum order value of ${formatINR(minPurchase)} required for "${normalizedCode}"`,
      code: normalizedCode,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount: 0,
    };
  }

  let rawDiscount = 0;
  if (coupon.discountType === "PERCENTAGE") {
    const clampedPct = Math.min(Math.max(coupon.discountValue, 0), 100);
    rawDiscount = roundCurrency(subtotalAfterPlanDiscount * (clampedPct / 100));
    if (
      coupon.maxDiscountAmount !== undefined &&
      coupon.maxDiscountAmount !== null &&
      coupon.maxDiscountAmount > 0
    ) {
      rawDiscount = Math.min(rawDiscount, roundCurrency(coupon.maxDiscountAmount));
    }
  } else {
    rawDiscount = roundCurrency(Math.max(0, coupon.discountValue));
  }

  // Ensure coupon discount never exceeds the subtotal (total cannot become negative)
  const finalCouponDiscount = roundCurrency(
    Math.min(rawDiscount, Math.max(0, subtotalAfterPlanDiscount))
  );

  return {
    valid: true,
    code: normalizedCode,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    discountAmount: finalCouponDiscount,
  };
}

/**
 * Generic Subscription Pricing Engine:
 * Calculates gross total, duration discount, optional coupon discount,
 * net payable amount, and effective monthly cost.
 */
export function calculatePlanPricing(
  plan: PlanPricingInput,
  coupon?: CouponCandidate | null,
  now: Date = new Date()
): PricingBreakdown {
  if (plan.durationMonths < 1) {
    throw new Error("Plan durationMonths must be at least 1");
  }
  if (plan.baseMonthlyPrice < 0) {
    throw new Error("Plan baseMonthlyPrice cannot be negative");
  }
  if (plan.discountPercentage < 0 || plan.discountPercentage > 100) {
    throw new Error("Plan discountPercentage must be between 0 and 100");
  }

  const grossAmount = roundCurrency(plan.baseMonthlyPrice * plan.durationMonths);
  const planDiscountAmount = roundCurrency(
    grossAmount * (plan.discountPercentage / 100)
  );
  const subtotalAfterPlanDiscount = roundCurrency(
    Math.max(0, grossAmount - planDiscountAmount)
  );

  let couponCode: string | null = null;
  let couponDiscountType: DiscountType | null = null;
  let couponDiscountValue = 0;
  let couponDiscountAmount = 0;

  if (coupon) {
    const evalResult = evaluateCoupon(coupon, subtotalAfterPlanDiscount, now);
    if (evalResult.valid) {
      couponCode = evalResult.code;
      couponDiscountType = evalResult.discountType;
      couponDiscountValue = evalResult.discountValue;
      couponDiscountAmount = evalResult.discountAmount;
    }
  }

  const totalAmount = roundCurrency(
    Math.max(0, subtotalAfterPlanDiscount - couponDiscountAmount)
  );
  const effectiveMonthlyPrice = roundCurrency(totalAmount / plan.durationMonths);

  return {
    grossAmount,
    planDiscountPercentage: roundCurrency(plan.discountPercentage),
    planDiscountAmount,
    subtotalAfterPlanDiscount,
    couponCode,
    couponDiscountType,
    couponDiscountValue,
    couponDiscountAmount,
    totalAmount,
    effectiveMonthlyPrice,
  };
}

export interface PaymentSplitOptions {
  totalAmount: number;
  paymentMode: PaymentMode;
  allowPartialPayment: boolean;
  minPartialPercentage?: number;
  upfrontPercentage?: number;
}

/**
 * Computes full vs partial/installment payment breakdown and validates eligibility.
 */
export function calculatePaymentSplit(options: PaymentSplitOptions): PaymentSplit {
  const totalAmount = roundCurrency(Math.max(0, options.totalAmount));
  const minPartial = options.minPartialPercentage ?? 50;

  if (options.paymentMode === "FULL" || totalAmount === 0) {
    return {
      paymentMode: "FULL",
      upfrontPercentage: 100,
      totalAmount,
      amountPaid: totalAmount,
      remainingBalance: 0,
      paymentStatus: "COMPLETED",
    };
  }

  if (!options.allowPartialPayment) {
    throw new Error("Partial or installment payment is not enabled for this plan");
  }

  const requestedPct = options.upfrontPercentage ?? minPartial;

  if (requestedPct < minPartial) {
    throw new Error(
      `Minimum upfront payment for this plan is ${minPartial}%`
    );
  }

  if (requestedPct >= 100) {
    return {
      paymentMode: "FULL",
      upfrontPercentage: 100,
      totalAmount,
      amountPaid: totalAmount,
      remainingBalance: 0,
      paymentStatus: "COMPLETED",
    };
  }

  const amountPaid = roundCurrency(totalAmount * (requestedPct / 100));
  const remainingBalance = roundCurrency(totalAmount - amountPaid);

  return {
    paymentMode: "PARTIAL",
    upfrontPercentage: requestedPct,
    totalAmount,
    amountPaid,
    remainingBalance,
    paymentStatus: remainingBalance > 0 ? "PARTIAL" : "COMPLETED",
  };
}

/**
 * Computes subscription start and end dates for a given billing duration.
 */
export function calculateSubscriptionCycleDates(
  startDate: Date = new Date(),
  durationMonths: number = 1
): { startDate: Date; endDate: Date } {
  const start = new Date(startDate.getTime());
  const end = new Date(startDate.getTime());
  end.setMonth(end.getMonth() + durationMonths);
  return { startDate: start, endDate: end };
}

/**
 * Computes remaining days in a subscription and triggers UI alerts:
 * - Activation Banner (when active)
 * - 3-Day Expiry Warning (when 0 <= daysRemaining <= 3)
 * - Expired Alert (when daysRemaining < 0)
 * - Partial Balance Alert (when balanceDue > 0)
 */
export function evaluateSubscriptionAlerts(
  subscription: IUserSubscriptionDTO | null | undefined,
  now: Date = new Date()
): {
  daysRemaining: number | null;
  isExpiringWithin3Days: boolean;
  isExpired: boolean;
  alerts: SubscriptionAlert[];
} {
  if (!subscription || subscription.status === "NONE" || !subscription.endDate) {
    return {
      daysRemaining: null,
      isExpiringWithin3Days: false,
      isExpired: false,
      alerts: [],
    };
  }

  const endDate = new Date(subscription.endDate);
  const diffMs = endDate.getTime() - now.getTime();
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const daysRemaining = diffMs >= 0 ? Math.ceil(diffMs / MS_PER_DAY) : -1;

  const isExpired = diffMs < 0 || subscription.status === "EXPIRED";
  const isExpiringWithin3Days =
    !isExpired && daysRemaining >= 0 && daysRemaining <= 3;

  const alerts: SubscriptionAlert[] = [];
  const planTitle = subscription.planSnapshot?.name || "Active Membership";

  if (isExpired) {
    alerts.push({
      id: "alert-expired",
      type: "EXPIRED",
      severity: "danger",
      title: "Membership Expired",
      message: `Your ${planTitle} subscription expired. Renew now to restore uninterrupted gym and recovery access.`,
      daysRemaining: 0,
      actionLabel: "Renew Membership",
      actionHref: "#plans-grid",
    });
  } else {
    if (isExpiringWithin3Days) {
      alerts.push({
        id: "alert-expiry-warning",
        type: "EXPIRY_WARNING",
        severity: "warning",
        title: `Urgent: Subscription Expires in ${daysRemaining} ${
          daysRemaining === 1 ? "Day" : "Days"
        }!`,
        message: `Your ${planTitle} plan is scheduled to expire within 3 days. Lock in your renewal early to keep your member discount.`,
        daysRemaining,
        actionLabel: "Extend Plan Now",
        actionHref: "#plans-grid",
      });
    }

    alerts.push({
      id: "alert-activation",
      type: "ACTIVATION",
      severity: "success",
      title: `${planTitle} — Membership Active`,
      message: `Your membership is active with full club access (${daysRemaining} ${
        daysRemaining === 1 ? "day" : "days"
      } remaining in current cycle).`,
      daysRemaining,
    });
  }

  if (subscription.balanceDue > 0) {
    alerts.push({
      id: "alert-partial-balance",
      type: "PARTIAL_BALANCE",
      severity: "info",
      title: `Installment Balance Due: ${formatINR(subscription.balanceDue)}`,
      message: `You have an outstanding partial payment balance of ${formatINR(
        subscription.balanceDue
      )}. Settle anytime from your Billing History.`,
      actionLabel: "View & Settle Balance",
      actionHref: "/billing",
    });
  }

  return {
    daysRemaining: isExpired ? 0 : daysRemaining,
    isExpiringWithin3Days,
    isExpired,
    alerts,
  };
}
