import mongoose from "mongoose";
import { SubscriptionPlan } from "@/models/SubscriptionPlan";
import { Coupon } from "@/models/Coupon";
import { User } from "@/models/User";
import { Transaction, ITransactionDocument } from "@/models/Transaction";
import {
  ITransactionDTO,
  IUserDTO,
  PaymentMode,
  PaymentStatus,
} from "@/types/domain";
import {
  CheckoutInputSchema,
  OverrideTransactionInputSchema,
} from "@/lib/validators";
import {
  calculatePaymentSplit,
  calculatePlanPricing,
  calculateSubscriptionCycleDates,
  evaluateCoupon,
} from "@/lib/subscription-engine";
import { createPlanSnapshot } from "@/lib/snapshot-service";
import { generateInvoiceNumber, roundCurrency } from "@/lib/utils";
import { toUserDTO } from "@/services/user.service";
import { toCouponDTO } from "@/services/coupon.service";

export function toTransactionDTO(doc: ITransactionDocument): ITransactionDTO {
  return {
    _id: doc._id.toString(),
    userId: doc.userId.toString(),
    userEmail: doc.userEmail,
    userName: doc.userName,
    planId: doc.planId.toString(),
    invoiceNumber: doc.invoiceNumber,
    totalAmount: roundCurrency(doc.totalAmount),
    amountPaid: roundCurrency(doc.amountPaid),
    remainingBalance: roundCurrency(doc.remainingBalance),
    paymentStatus: doc.paymentStatus,
    paymentMode: doc.paymentMode,
    paymentDate: doc.paymentDate.toISOString(),
    planSnapshot: {
      planId: doc.planSnapshot.planId,
      name: doc.planSnapshot.name,
      durationMonths: doc.planSnapshot.durationMonths,
      baseMonthlyPrice: roundCurrency(doc.planSnapshot.baseMonthlyPrice),
      discountPercentage: roundCurrency(doc.planSnapshot.discountPercentage),
      version: doc.planSnapshot.version,
      capturedAt: doc.planSnapshot.capturedAt,
    },
    pricingBreakdown: {
      grossAmount: roundCurrency(doc.pricingBreakdown.grossAmount),
      planDiscountPercentage: roundCurrency(
        doc.pricingBreakdown.planDiscountPercentage
      ),
      planDiscountAmount: roundCurrency(doc.pricingBreakdown.planDiscountAmount),
      subtotalAfterPlanDiscount: roundCurrency(
        doc.pricingBreakdown.subtotalAfterPlanDiscount
      ),
      couponCode: doc.pricingBreakdown.couponCode,
      couponDiscountType: doc.pricingBreakdown.couponDiscountType,
      couponDiscountValue: roundCurrency(
        doc.pricingBreakdown.couponDiscountValue
      ),
      couponDiscountAmount: roundCurrency(
        doc.pricingBreakdown.couponDiscountAmount
      ),
      totalAmount: roundCurrency(doc.pricingBreakdown.totalAmount),
      effectiveMonthlyPrice: roundCurrency(
        doc.pricingBreakdown.effectiveMonthlyPrice
      ),
    },
    overrideAudit:
      doc.overrideAudit && doc.overrideAudit.overriddenBy
        ? {
            overriddenBy: doc.overrideAudit.overriddenBy,
            overriddenAt: doc.overrideAudit.overriddenAt,
            previousAmountPaid: roundCurrency(
              doc.overrideAudit.previousAmountPaid
            ),
            previousRemainingBalance: roundCurrency(
              doc.overrideAudit.previousRemainingBalance
            ),
            note: doc.overrideAudit.note,
          }
        : null,
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
  };
}

/**
 * Recomputes a user's aggregate `balanceDue` across all of their PARTIAL transactions
 * so `User.subscription.balanceDue` is always 100% consistent with the ledger.
 */
export async function syncUserBalanceDue(
  userId: mongoose.Types.ObjectId | string
): Promise<number> {
  const partialTxns = await Transaction.find({
    userId,
    paymentStatus: "PARTIAL",
  });
  const totalBalanceDue = roundCurrency(
    partialTxns.reduce((sum, tx) => sum + tx.remainingBalance, 0)
  );

  await User.findByIdAndUpdate(userId, {
    $set: { "subscription.balanceDue": totalBalanceDue },
  });

  return totalBalanceDue;
}

export interface ProcessCheckoutParams {
  clerkId: string;
  planId: string;
  paymentMode: PaymentMode;
  upfrontPercentage?: number;
  couponCode?: string | null;
  enforceActivePlanQueueRules?: boolean;
  now?: Date;
}

export async function processCheckout(
  params: ProcessCheckoutParams
): Promise<{ transaction: ITransactionDTO; user: IUserDTO }> {
  const validated = CheckoutInputSchema.parse({
    planId: params.planId,
    paymentMode: params.paymentMode,
    upfrontPercentage: params.upfrontPercentage,
    couponCode: params.couponCode,
  });

  const now = params.now ?? new Date();

  const user = await User.findOne({ clerkId: params.clerkId.trim() });
  if (!user) {
    throw new Error("Authenticated user record not found");
  }

  const hasActiveSubscription =
    user.subscription.status === "ACTIVE" &&
    Boolean(user.subscription.endDate) &&
    user.subscription.endDate!.getTime() > now.getTime();

  if (hasActiveSubscription && params.enforceActivePlanQueueRules) {
    if (user.subscription.balanceDue > 0) {
      throw new Error(
        "Please pay your current membership's remaining balance in Billing before scheduling your next plan."
      );
    }
    if (validated.paymentMode !== "FULL") {
      throw new Error(
        "Full payment is required when scheduling an upgrade or plan change while your current membership is active."
      );
    }
  }

  if (!mongoose.Types.ObjectId.isValid(validated.planId)) {
    throw new Error("Invalid subscription plan ID");
  }

  const plan = await SubscriptionPlan.findById(validated.planId);
  if (!plan || !plan.isActive) {
    throw new Error("Selected subscription plan is not available");
  }

  // Evaluate coupon if provided
  let appliedCouponDoc = null;
  const trimmedCode = validated.couponCode?.trim().toUpperCase();
  if (trimmedCode) {
    appliedCouponDoc = await Coupon.findOne({ code: trimmedCode });
    const prelimPricing = calculatePlanPricing(plan, null, now);
    const couponEval = evaluateCoupon(
      appliedCouponDoc ? toCouponDTO(appliedCouponDoc) : null,
      prelimPricing.subtotalAfterPlanDiscount,
      now
    );

    if (!couponEval.valid) {
      throw new Error(couponEval.reason || "Invalid coupon code");
    }
  }

  const pricingBreakdown = calculatePlanPricing(
    plan,
    appliedCouponDoc ? toCouponDTO(appliedCouponDoc) : null,
    now
  );

  const paymentSplit = calculatePaymentSplit({
    totalAmount: pricingBreakdown.totalAmount,
    paymentMode: validated.paymentMode,
    allowPartialPayment: plan.allowPartialPayment,
    minPartialPercentage: plan.minPartialPercentage,
    upfrontPercentage: validated.upfrontPercentage,
  });

  const planSnapshot = createPlanSnapshot(plan, now);
  const invoiceNumber = generateInvoiceNumber(now);

  const createdTx = await Transaction.create({
    userId: user._id,
    userEmail: user.email,
    userName: user.name,
    planId: plan._id,
    invoiceNumber,
    totalAmount: paymentSplit.totalAmount,
    amountPaid: paymentSplit.amountPaid,
    remainingBalance: paymentSplit.remainingBalance,
    paymentStatus: paymentSplit.paymentStatus,
    paymentMode: paymentSplit.paymentMode,
    paymentDate: now,
    planSnapshot,
    pricingBreakdown,
    overrideAudit: null,
  });

  if (appliedCouponDoc) {
    appliedCouponDoc.usedCount += 1;
    await appliedCouponDoc.save();
  }

  const aggregateBalance = await syncUserBalanceDue(user._id);

  if (hasActiveSubscription && validated.paymentMode === "FULL") {
    const currentEndDate = new Date(user.subscription.endDate!);
    const upcomingCycleDates = calculateSubscriptionCycleDates(
      currentEndDate,
      plan.durationMonths
    );
    user.subscription.balanceDue = aggregateBalance;
    user.subscription.upcomingSubscription = {
      planId: plan._id,
      startDate: upcomingCycleDates.startDate,
      endDate: upcomingCycleDates.endDate,
      planSnapshot,
    };
  } else {
    const cycleDates = calculateSubscriptionCycleDates(now, plan.durationMonths);
    user.subscription = {
      planId: plan._id,
      status: "ACTIVE",
      startDate: cycleDates.startDate,
      endDate: cycleDates.endDate,
      balanceDue: aggregateBalance,
      planSnapshot,
      upcomingSubscription: user.subscription.upcomingSubscription || null,
    };
  }
  await user.save();

  return {
    transaction: toTransactionDTO(createdTx),
    user: toUserDTO(user),
  };
}

export interface OverrideTransactionParams {
  transactionId: string;
  adminIdentifier: string;
  note?: string;
  now?: Date;
}

/**
 * Admin Oversight Action: Overrides a 'PARTIAL' (or 'PENDING') transaction status to 'COMPLETED',
 * records an immutable audit trail, and synchronizes the user's `subscription.balanceDue`.
 */
export async function overrideTransactionToCompleted(
  params: OverrideTransactionParams
): Promise<{ transaction: ITransactionDTO; user: IUserDTO | null }> {
  const validated = OverrideTransactionInputSchema.parse({
    transactionId: params.transactionId,
    note: params.note,
  });

  if (!mongoose.Types.ObjectId.isValid(validated.transactionId)) {
    throw new Error("Invalid Transaction ID");
  }

  const tx = await Transaction.findById(validated.transactionId);
  if (!tx) {
    throw new Error("Transaction not found");
  }

  if (tx.paymentStatus === "COMPLETED") {
    throw new Error("Transaction is already marked as COMPLETED");
  }

  const now = params.now ?? new Date();
  const previousAmountPaid = roundCurrency(tx.amountPaid);
  const previousRemainingBalance = roundCurrency(tx.remainingBalance);

  tx.amountPaid = roundCurrency(tx.totalAmount);
  tx.remainingBalance = 0;
  tx.paymentStatus = "COMPLETED";
  tx.overrideAudit = {
    overriddenBy: params.adminIdentifier.trim() || "Admin",
    overriddenAt: now.toISOString(),
    previousAmountPaid,
    previousRemainingBalance,
    note: validated.note,
  };

  await tx.save();

  await syncUserBalanceDue(tx.userId);
  const updatedUser = await User.findById(tx.userId);

  return {
    transaction: toTransactionDTO(tx),
    user: updatedUser ? toUserDTO(updatedUser) : null,
  };
}

/**
 * Allows a user to settle the remaining balance on their own PARTIAL invoice.
 */
export async function settlePartialTransactionByUser(params: {
  transactionId: string;
  clerkId: string;
  now?: Date;
}): Promise<{ transaction: ITransactionDTO; user: IUserDTO }> {
  if (!mongoose.Types.ObjectId.isValid(params.transactionId)) {
    throw new Error("Invalid Transaction ID");
  }

  const user = await User.findOne({ clerkId: params.clerkId.trim() });
  if (!user) {
    throw new Error("User not found");
  }

  const tx = await Transaction.findById(params.transactionId);
  if (!tx) {
    throw new Error("Transaction not found");
  }

  if (tx.userId.toString() !== user._id.toString()) {
    throw new Error("Unauthorized to settle this transaction");
  }

  if (tx.paymentStatus === "COMPLETED") {
    throw new Error("Transaction is already settled");
  }

  tx.amountPaid = roundCurrency(tx.totalAmount);
  tx.remainingBalance = 0;
  tx.paymentStatus = "COMPLETED";
  await tx.save();

  await syncUserBalanceDue(user._id);
  const refreshedUser = await User.findById(user._id);

  return {
    transaction: toTransactionDTO(tx),
    user: toUserDTO(refreshedUser!),
  };
}

export async function listUserTransactions(
  clerkId: string
): Promise<ITransactionDTO[]> {
  const user = await User.findOne({ clerkId: clerkId.trim() });
  if (!user) return [];

  const txns = await Transaction.find({ userId: user._id }).sort({
    paymentDate: -1,
    createdAt: -1,
  });
  return txns.map(toTransactionDTO);
}

export async function listGlobalTransactions(filter?: {
  status?: PaymentStatus;
}): Promise<{
  transactions: ITransactionDTO[];
  metrics: {
    totalRevenueCollected: number;
    totalPendingReceivables: number;
    completedCount: number;
    partialCount: number;
    totalTransactions: number;
  };
}> {
  const query = filter?.status ? { paymentStatus: filter.status } : {};
  const txns = await Transaction.find(query).sort({
    paymentDate: -1,
    createdAt: -1,
  });

  const allTxns = filter?.status ? await Transaction.find({}) : txns;

  let totalRevenueCollected = 0;
  let totalPendingReceivables = 0;
  let completedCount = 0;
  let partialCount = 0;

  for (const t of allTxns) {
    totalRevenueCollected += t.amountPaid;
    totalPendingReceivables += t.remainingBalance;
    if (t.paymentStatus === "COMPLETED") completedCount += 1;
    if (t.paymentStatus === "PARTIAL") partialCount += 1;
  }

  return {
    transactions: txns.map(toTransactionDTO),
    metrics: {
      totalRevenueCollected: roundCurrency(totalRevenueCollected),
      totalPendingReceivables: roundCurrency(totalPendingReceivables),
      completedCount,
      partialCount,
      totalTransactions: allTxns.length,
    },
  };
}
