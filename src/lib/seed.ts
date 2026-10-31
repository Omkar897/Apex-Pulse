import { SubscriptionPlan } from "@/models/SubscriptionPlan";
import { Coupon } from "@/models/Coupon";
import { User } from "@/models/User";
import { Transaction } from "@/models/Transaction";
import { createPlanSnapshot } from "@/lib/snapshot-service";
import {
  calculatePaymentSplit,
  calculatePlanPricing,
  calculateSubscriptionCycleDates,
} from "@/lib/subscription-engine";

export const DEFAULT_DEMO_USER_CLERK_ID = "user_demo_member_001";
export const DEFAULT_DEMO_ADMIN_CLERK_ID = "user_demo_admin_001";

/**
 * Idempotently seeds realistic INR SubscriptionPlans, Coupons, Demo Users,
 * and Sample Transactions when the database is empty.
 */
export async function ensureInitialSeedData(): Promise<void> {
  const now = new Date();
  const future90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const existingPlansCount = await SubscriptionPlan.countDocuments();
  if (existingPlansCount > 0) {
    // Ensure legacy FIT500 is removed and only APEX20 is active by default
    await Coupon.deleteMany({ code: "FIT500" });
    await Coupon.updateMany(
      { code: { $ne: "APEX20" } },
      { $set: { isActive: false } }
    );
    await Coupon.findOneAndUpdate(
      { code: "APEX20" },
      {
        $set: {
          description:
            "Use APEX20 for an instant 20% discount on any membership plan (up to ₹2,500 off)",
          discountType: "PERCENTAGE",
          discountValue: 20,
          minPurchaseAmount: 1000,
          maxDiscountAmount: 2500,
          expiryDate: future90Days,
          usageLimit: 500,
          isActive: true,
        },
      },
      { upsert: true }
    );
    return;
  }

  // 1. Seed Subscription Plans (INR)
  const createdPlans = await SubscriptionPlan.insertMany([
    {
      name: "Monthly Sprint",
      description:
        "Flexible month-to-month access to our strength floor, cardio arena, and locker facilities.",
      durationMonths: 1,
      baseMonthlyPrice: 2499,
      discountPercentage: 0,
      allowPartialPayment: false,
      minPartialPercentage: 50,
      features: [
        "Unlimited Strength & Conditioning Floor Access",
        "1 InBody Bio-Impedance Scan / Month",
        "Locker & Steam Shower Access",
        "Mobile App Workout Tracking",
      ],
      isPopular: false,
      isActive: true,
      version: 1,
    },
    {
      name: "Quarterly Transformation",
      description:
        "Our highest-converting 90-day commitment built for measurable body recomposition and strength gains.",
      durationMonths: 3,
      baseMonthlyPrice: 2499,
      discountPercentage: 15,
      allowPartialPayment: true,
      minPartialPercentage: 50,
      features: [
        "Everything in Monthly Sprint",
        "Save 15% + Split into 2 Easy Installments",
        "Monthly 1-on-1 Coach Performance Review",
        "Unlimited Group HIIT & Mobility Classes",
        "Complimentary Post-Workout Recovery Shake Bar (4x/mo)",
      ],
      isPopular: true,
      isActive: true,
      version: 1,
    },
    {
      name: "Half-Year Pro Athlete",
      description:
        "6-month periodized athletic programming with recovery suite access and flexible installment billing.",
      durationMonths: 6,
      baseMonthlyPrice: 2499,
      discountPercentage: 25,
      allowPartialPayment: true,
      minPartialPercentage: 40,
      features: [
        "Everything in Quarterly Transformation",
        "Save 25% + Pay from 40% Upfront",
        "Infrared Sauna & Cold Plunge Recovery Suite (2x/wk)",
        "Custom Macro & Sports Nutrition Blueprint",
        "2 Guest Passes Every Month",
      ],
      isPopular: false,
      isActive: true,
      version: 1,
    },
    {
      name: "Annual Apex Elite",
      description:
        "All-inclusive 365-day VIP membership with maximum 35% savings, cryo recovery, and flexible partial payment.",
      durationMonths: 12,
      baseMonthlyPrice: 2499,
      discountPercentage: 35,
      allowPartialPayment: true,
      minPartialPercentage: 30,
      features: [
        "Everything in Half-Year Pro Athlete",
        "Maximum 35% Savings + Pay from 30% Upfront",
        "Unlimited Cryotherapy, Normatec & Infrared Recovery",
        "Dedicated Locker & Laundry Service",
        "Priority Booking & 30-Day Travel Freeze Protection",
      ],
      isPopular: false,
      isActive: true,
      version: 1,
    },
  ]);

  // 2. Seed Coupons (Flat & Percentage)
  const past30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  await Coupon.insertMany([
    {
      code: "APEX20",
      description: "Use APEX20 for an instant 20% discount on any membership plan (up to ₹2,500 off)",
      discountType: "PERCENTAGE",
      discountValue: 20,
      minPurchaseAmount: 1000,
      maxDiscountAmount: 2500,
      expiryDate: future90Days,
      usageLimit: 500,
      usedCount: 14,
      isActive: true,
    },
    {
      code: "WELCOME10",
      description: "Use WELCOME10 for an instant 10% welcome discount on any membership plan",
      discountType: "PERCENTAGE",
      discountValue: 10,
      minPurchaseAmount: 1000,
      maxDiscountAmount: 1500,
      expiryDate: future90Days,
      usageLimit: 500,
      usedCount: 28,
      isActive: false,
    },
    {
      code: "ELITE1500",
      description: "Use ELITE1500 for a flat ₹1,500 instant discount on any membership plan",
      discountType: "FLAT",
      discountValue: 1500,
      minPurchaseAmount: 2000,
      maxDiscountAmount: null,
      expiryDate: future90Days,
      usageLimit: 200,
      usedCount: 9,
      isActive: false,
    },
    {
      code: "MONSOON10",
      description: "Expired seasonal promo code",
      discountType: "PERCENTAGE",
      discountValue: 10,
      minPurchaseAmount: 1000,
      maxDiscountAmount: 1000,
      expiryDate: past30Days,
      usageLimit: 50,
      usedCount: 50,
      isActive: false,
    },
  ]);

  // 3. Seed Demo Users & Initial Transactions
  const quarterlyPlan = createdPlans[1];
  const annualPlan = createdPlans[3];

  const quarterlySnapshot = createPlanSnapshot(quarterlyPlan, now);
  const quarterlyPricing = calculatePlanPricing(quarterlyPlan, null, now);
  const quarterlySplit = calculatePaymentSplit({
    totalAmount: quarterlyPricing.totalAmount,
    paymentMode: "PARTIAL",
    allowPartialPayment: true,
    minPartialPercentage: 50,
    upfrontPercentage: 50,
  });
  const cycleDates = calculateSubscriptionCycleDates(now, quarterlyPlan.durationMonths);

  const demoMember = await User.create({
    clerkId: DEFAULT_DEMO_USER_CLERK_ID,
    email: "aarav.mehta@apexpulse.in",
    name: "Aarav Mehta",
    role: "USER",
    subscription: {
      planId: quarterlyPlan._id,
      status: "ACTIVE",
      startDate: cycleDates.startDate,
      endDate: cycleDates.endDate,
      balanceDue: quarterlySplit.remainingBalance,
      planSnapshot: quarterlySnapshot,
    },
  });

  await User.create({
    clerkId: DEFAULT_DEMO_ADMIN_CLERK_ID,
    email: "admin@apexpulse.in",
    name: "Club Admin",
    role: "ADMIN",
    subscription: {
      planId: null,
      status: "NONE",
      startDate: null,
      endDate: null,
      balanceDue: 0,
      planSnapshot: null,
    },
  });

  const secondMember = await User.create({
    clerkId: "user_demo_member_002",
    email: "ananya.deshmukh@apexpulse.in",
    name: "Ananya Deshmukh",
    role: "USER",
    subscription: {
      planId: annualPlan._id,
      status: "ACTIVE",
      startDate: cycleDates.startDate,
      endDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
      balanceDue: 0,
      planSnapshot: createPlanSnapshot(annualPlan, now),
    },
  });

  const annualPricing = calculatePlanPricing(annualPlan, null, now);

  await Transaction.insertMany([
    {
      userId: demoMember._id,
      userEmail: demoMember.email,
      userName: demoMember.name,
      planId: quarterlyPlan._id,
      invoiceNumber: "INV-20261028-4821",
      totalAmount: quarterlySplit.totalAmount,
      amountPaid: quarterlySplit.amountPaid,
      remainingBalance: quarterlySplit.remainingBalance,
      paymentStatus: "PARTIAL",
      paymentMode: "PARTIAL",
      paymentDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      planSnapshot: quarterlySnapshot,
      pricingBreakdown: quarterlyPricing,
      overrideAudit: null,
    },
    {
      userId: secondMember._id,
      userEmail: secondMember.email,
      userName: secondMember.name,
      planId: annualPlan._id,
      invoiceNumber: "INV-20261020-9104",
      totalAmount: annualPricing.totalAmount,
      amountPaid: annualPricing.totalAmount,
      remainingBalance: 0,
      paymentStatus: "COMPLETED",
      paymentMode: "FULL",
      paymentDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      planSnapshot: createPlanSnapshot(annualPlan, now),
      pricingBreakdown: annualPricing,
      overrideAudit: null,
    },
  ]);
}
