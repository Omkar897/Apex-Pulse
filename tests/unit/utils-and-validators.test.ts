import { describe, expect, it } from "vitest";
import {
  cn,
  formatDate,
  formatINR,
  generateInvoiceNumber,
  roundCurrency,
} from "@/lib/utils";
import {
  CheckoutInputSchema,
  CouponInputSchema,
  OverrideTransactionInputSchema,
  SettleBalanceInputSchema,
  SubscriptionPlanInputSchema,
} from "@/lib/validators";

describe("Utilities (utils.ts)", () => {
  it("merges tailwind classes cleanly with cn()", () => {
    expect(cn("px-2 py-1", "px-4", false && "hidden")).toBe("py-1 px-4");
  });

  it("rounds monetary values deterministically to 2 decimal places", () => {
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3);
    expect(roundCurrency(2499.456)).toBe(2499.46);
    expect(roundCurrency(2499.454)).toBe(2499.45);
    expect(roundCurrency(Number.NaN)).toBe(0);
    expect(roundCurrency(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("formats INR currency with ₹ symbol and Indian number grouping", () => {
    const formattedWhole = formatINR(2499);
    expect(formattedWhole).toContain("₹");
    expect(formattedWhole).toContain("2,499");

    const formattedDecimal = formatINR(6372.45);
    expect(formattedDecimal).toContain("6,372.45");

    const formattedFallback = formatINR(Number.NaN);
    expect(formattedFallback).toContain("0");
  });

  it("formats valid and invalid dates safely", () => {
    expect(formatDate(null)).toBe("N/A");
    expect(formatDate(undefined)).toBe("N/A");
    expect(formatDate("not-a-valid-date")).toBe("N/A");

    const validIso = "2026-10-31T00:00:00.000Z";
    expect(formatDate(validIso)).toContain("2026");
    expect(formatDate(new Date(validIso))).toContain("2026");
  });

  it("generates deterministic and random formatted invoice numbers", () => {
    const fixedDate = new Date("2026-10-31T10:00:00.000Z");
    const invDeterministic = generateInvoiceNumber(fixedDate, 421);
    expect(invDeterministic).toBe("INV-20261031-1421");

    const invRandom = generateInvoiceNumber(fixedDate);
    expect(invRandom).toMatch(/^INV-20261031-\d{4}$/);
  });
});

describe("Zod Boundary Validators (validators.ts)", () => {
  it("validates SubscriptionPlanInputSchema and rejects out-of-range inputs", () => {
    const valid = SubscriptionPlanInputSchema.parse({
      name: "Quarterly Pro",
      durationMonths: 3,
      baseMonthlyPrice: 2499,
      discountPercentage: 15,
      allowPartialPayment: true,
    });
    expect(valid.name).toBe("Quarterly Pro");
    expect(valid.minPartialPercentage).toBe(50);

    expect(() =>
      SubscriptionPlanInputSchema.parse({
        name: "A",
        durationMonths: 0,
        baseMonthlyPrice: -100,
        discountPercentage: 120,
      })
    ).toThrow();
  });

  it("validates CouponInputSchema for FLAT and PERCENTAGE and rejects >100% percentage", () => {
    const validPct = CouponInputSchema.parse({
      code: "  apex20 ",
      discountType: "PERCENTAGE",
      discountValue: 20,
      expiryDate: "2027-12-31",
    });
    expect(validPct.code).toBe("APEX20");

    const validFlat = CouponInputSchema.parse({
      code: "FLAT500",
      discountType: "FLAT",
      discountValue: 500,
      expiryDate: new Date("2027-12-31"),
    });
    expect(validFlat.discountType).toBe("FLAT");

    expect(() =>
      CouponInputSchema.parse({
        code: "INVALID_PCT",
        discountType: "PERCENTAGE",
        discountValue: 150,
        expiryDate: "2027-12-31",
      })
    ).toThrow(/cannot exceed 100%/);
  });

  it("validates CheckoutInputSchema, OverrideTransactionInputSchema, and SettleBalanceInputSchema", () => {
    const checkout = CheckoutInputSchema.parse({
      planId: "6723abcd1234567890abcdef",
      paymentMode: "PARTIAL",
      upfrontPercentage: 50,
      couponCode: "APEX20",
    });
    expect(checkout.paymentMode).toBe("PARTIAL");

    const override = OverrideTransactionInputSchema.parse({
      transactionId: "6723abcd1234567890abcdef",
    });
    expect(override.note).toContain("COMPLETED");

    const settle = SettleBalanceInputSchema.parse({
      transactionId: "6723abcd1234567890abcdef",
      amount: 1200,
    });
    expect(settle.amount).toBe(1200);
  });
});
