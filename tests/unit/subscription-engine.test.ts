import { describe, expect, it } from "vitest";
import {
  calculatePaymentSplit,
  calculatePlanPricing,
  calculateSubscriptionCycleDates,
  evaluateCoupon,
  evaluateSubscriptionAlerts,
} from "@/lib/subscription-engine";
import { IUserSubscriptionDTO } from "@/types/domain";

describe("Subscription & Pricing Engine (subscription-engine.ts)", () => {
  const now = new Date("2026-10-31T12:00:00.000Z");

  describe("calculatePlanPricing & evaluateCoupon", () => {
    it("computes multi-month pricing with built-in duration discount accurately", () => {
      const result = calculatePlanPricing(
        {
          durationMonths: 3,
          baseMonthlyPrice: 2499,
          discountPercentage: 15,
        },
        null,
        now
      );

      expect(result.grossAmount).toBe(7497);
      expect(result.planDiscountAmount).toBe(1124.55);
      expect(result.subtotalAfterPlanDiscount).toBe(6372.45);
      expect(result.totalAmount).toBe(6372.45);
      expect(result.effectiveMonthlyPrice).toBe(2124.15);
    });

    it("throws on invalid plan parameters", () => {
      expect(() =>
        calculatePlanPricing({
          durationMonths: 0,
          baseMonthlyPrice: 2000,
          discountPercentage: 0,
        })
      ).toThrow(/durationMonths/);

      expect(() =>
        calculatePlanPricing({
          durationMonths: 1,
          baseMonthlyPrice: -10,
          discountPercentage: 0,
        })
      ).toThrow(/baseMonthlyPrice/);

      expect(() =>
        calculatePlanPricing({
          durationMonths: 1,
          baseMonthlyPrice: 2000,
          discountPercentage: 105,
        })
      ).toThrow(/discountPercentage/);
    });

    it("applies PERCENTAGE coupon with maxDiscountAmount cap", () => {
      const coupon = {
        code: "apex20",
        discountType: "PERCENTAGE" as const,
        discountValue: 20,
        minPurchaseAmount: 3000,
        maxDiscountAmount: 1000,
        expiryDate: "2027-01-01T00:00:00.000Z",
        usageLimit: 100,
        usedCount: 10,
        isActive: true,
      };

      // 20% of 6372.45 is 1274.49, capped at 1000
      const pricing = calculatePlanPricing(
        { durationMonths: 3, baseMonthlyPrice: 2499, discountPercentage: 15 },
        coupon,
        now
      );
      expect(pricing.couponCode).toBe("APEX20");
      expect(pricing.couponDiscountAmount).toBe(1000);
      expect(pricing.totalAmount).toBe(5372.45);
    });

    it("floors totalAmount at 0 when FLAT coupon exceeds plan subtotal", () => {
      const hugeFlatCoupon = {
        code: "FREE PASS",
        discountType: "FLAT" as const,
        discountValue: 5000,
        minPurchaseAmount: 0,
        maxDiscountAmount: null,
        expiryDate: "2027-01-01T00:00:00.000Z",
        isActive: true,
      };

      const pricing = calculatePlanPricing(
        { durationMonths: 1, baseMonthlyPrice: 2499, discountPercentage: 0 },
        hugeFlatCoupon,
        now
      );
      expect(pricing.couponDiscountAmount).toBe(2499);
      expect(pricing.totalAmount).toBe(0);
    });

    it("rejects null, inactive, expired, exhausted, and below-minimum coupons", () => {
      expect(evaluateCoupon(null, 5000, now).valid).toBe(false);

      expect(
        evaluateCoupon(
          {
            code: "INACTIVE",
            discountType: "FLAT",
            discountValue: 500,
            expiryDate: "2027-01-01",
            isActive: false,
          },
          5000,
          now
        ).reason
      ).toContain("inactive");

      expect(
        evaluateCoupon(
          {
            code: "OLD",
            discountType: "FLAT",
            discountValue: 500,
            expiryDate: "2025-01-01",
            isActive: true,
          },
          5000,
          now
        ).reason
      ).toContain("expired");

      expect(
        evaluateCoupon(
          {
            code: "MAXED",
            discountType: "FLAT",
            discountValue: 500,
            expiryDate: "2027-01-01",
            usageLimit: 10,
            usedCount: 10,
            isActive: true,
          },
          5000,
          now
        ).reason
      ).toContain("usage limit");

      expect(
        evaluateCoupon(
          {
            code: "MIN5000",
            discountType: "FLAT",
            discountValue: 500,
            minPurchaseAmount: 5000,
            expiryDate: "2027-01-01",
            isActive: true,
          },
          2499,
          now
        ).reason
      ).toContain("Minimum order value");
    });
  });

  describe("calculatePaymentSplit (Full vs Partial/Installment)", () => {
    it("processes FULL payment with 0 remaining balance", () => {
      const split = calculatePaymentSplit({
        totalAmount: 6372.45,
        paymentMode: "FULL",
        allowPartialPayment: false,
      });
      expect(split.paymentStatus).toBe("COMPLETED");
      expect(split.amountPaid).toBe(6372.45);
      expect(split.remainingBalance).toBe(0);
    });

    it("computes PARTIAL payment accurately and conserves exact total on odd amounts", () => {
      const split = calculatePaymentSplit({
        totalAmount: 4999,
        paymentMode: "PARTIAL",
        allowPartialPayment: true,
        minPartialPercentage: 50,
        upfrontPercentage: 50,
      });
      expect(split.paymentStatus).toBe("PARTIAL");
      expect(split.amountPaid).toBe(2499.5);
      expect(split.remainingBalance).toBe(2499.5);
      expect(split.amountPaid + split.remainingBalance).toBe(4999);
    });

    it("rejects PARTIAL payment when allowPartialPayment is false or upfront < minPartialPercentage", () => {
      expect(() =>
        calculatePaymentSplit({
          totalAmount: 2499,
          paymentMode: "PARTIAL",
          allowPartialPayment: false,
        })
      ).toThrow(/not enabled/);

      expect(() =>
        calculatePaymentSplit({
          totalAmount: 10000,
          paymentMode: "PARTIAL",
          allowPartialPayment: true,
          minPartialPercentage: 50,
          upfrontPercentage: 30,
        })
      ).toThrow(/Minimum upfront payment/);
    });

    it("upgrades PARTIAL request with >=100% upfront to FULL COMPLETED", () => {
      const split = calculatePaymentSplit({
        totalAmount: 5000,
        paymentMode: "PARTIAL",
        allowPartialPayment: true,
        minPartialPercentage: 50,
        upfrontPercentage: 100,
      });
      expect(split.paymentMode).toBe("FULL");
      expect(split.paymentStatus).toBe("COMPLETED");
      expect(split.remainingBalance).toBe(0);
    });
  });

  describe("calculateSubscriptionCycleDates & evaluateSubscriptionAlerts (3-Day Expiry Warning)", () => {
    it("computes cycle start and end dates accurately", () => {
      const { startDate, endDate } = calculateSubscriptionCycleDates(now, 3);
      expect(startDate.toISOString()).toBe(now.toISOString());
      expect(endDate.getTime()).toBeGreaterThan(startDate.getTime());
    });

    it("returns empty alerts when user has no active subscription", () => {
      const res = evaluateSubscriptionAlerts(null, now);
      expect(res.alerts).toHaveLength(0);
      expect(res.isExpiringWithin3Days).toBe(false);
    });

    it("shows Activation alert but NO 3-day warning when 10 days remain", () => {
      const tenDaysLater = new Date(
        now.getTime() + 10 * 24 * 60 * 60 * 1000
      ).toISOString();
      const sub: IUserSubscriptionDTO = {
        planId: "plan_1",
        status: "ACTIVE",
        startDate: now.toISOString(),
        endDate: tenDaysLater,
        balanceDue: 0,
      };

      const res = evaluateSubscriptionAlerts(sub, now);
      expect(res.isExpiringWithin3Days).toBe(false);
      expect(res.isExpired).toBe(false);
      expect(res.alerts.some((a) => a.type === "ACTIVATION")).toBe(true);
      expect(res.alerts.some((a) => a.type === "EXPIRY_WARNING")).toBe(false);
    });

    it("triggers 3-Day Expiry Warning and Partial Balance alerts when 2 days remain and balanceDue > 0", () => {
      const twoDaysLater = new Date(
        now.getTime() + 2 * 24 * 60 * 60 * 1000 - 1000
      ).toISOString();
      const sub: IUserSubscriptionDTO = {
        planId: "plan_1",
        status: "ACTIVE",
        startDate: now.toISOString(),
        endDate: twoDaysLater,
        balanceDue: 3186.22,
      };

      const res = evaluateSubscriptionAlerts(sub, now);
      expect(res.isExpiringWithin3Days).toBe(true);
      expect(res.daysRemaining).toBe(2);
      expect(res.alerts.some((a) => a.type === "EXPIRY_WARNING")).toBe(true);
      expect(res.alerts.some((a) => a.type === "ACTIVATION")).toBe(true);
      expect(res.alerts.some((a) => a.type === "PARTIAL_BALANCE")).toBe(true);
    });

    it("triggers EXPIRED alert when endDate is in the past", () => {
      const yesterday = new Date(
        now.getTime() - 24 * 60 * 60 * 1000
      ).toISOString();
      const sub: IUserSubscriptionDTO = {
        planId: "plan_1",
        status: "ACTIVE",
        startDate: now.toISOString(),
        endDate: yesterday,
        balanceDue: 0,
      };

      const res = evaluateSubscriptionAlerts(sub, now);
      expect(res.isExpired).toBe(true);
      expect(res.daysRemaining).toBe(0);
      expect(res.alerts.some((a) => a.type === "EXPIRED")).toBe(true);
    });
  });
});
