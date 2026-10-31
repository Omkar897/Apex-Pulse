import { z } from "zod";

export const SubscriptionPlanInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Plan name must be at least 2 characters")
    .max(80, "Plan name cannot exceed 80 characters"),
  description: z
    .string()
    .trim()
    .max(300, "Description cannot exceed 300 characters")
    .optional()
    .default(""),
  durationMonths: z
    .number()
    .int("Duration must be a whole number of months")
    .min(1, "Minimum duration is 1 month")
    .max(60, "Maximum duration is 60 months"),
  baseMonthlyPrice: z
    .number()
    .min(1, "Base monthly price must be greater than ₹0")
    .max(1000000, "Base monthly price exceeds limit"),
  discountPercentage: z
    .number()
    .min(0, "Discount percentage cannot be negative")
    .max(100, "Discount percentage cannot exceed 100%")
    .default(0),
  allowPartialPayment: z.boolean().default(false),
  minPartialPercentage: z
    .number()
    .min(10, "Minimum partial payment is 10%")
    .max(90, "Maximum upfront partial payment threshold is 90%")
    .optional()
    .default(50),
  features: z.array(z.string().trim().min(1)).optional().default([]),
  isPopular: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

export type SubscriptionPlanInput = z.infer<typeof SubscriptionPlanInputSchema>;

export const CouponInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, "Coupon code must be at least 3 characters")
      .max(24, "Coupon code cannot exceed 24 characters")
      .regex(/^[A-Z0-9_-]+$/, "Coupon code must be alphanumeric"),
    description: z.string().trim().max(200).optional().default(""),
    discountType: z.enum(["FLAT", "PERCENTAGE"]),
    discountValue: z
      .number()
      .positive("Discount value must be greater than 0"),
    minPurchaseAmount: z
      .number()
      .min(0, "Minimum purchase amount cannot be negative")
      .optional()
      .default(0),
    maxDiscountAmount: z
      .number()
      .positive("Max discount cap must be positive")
      .nullable()
      .optional()
      .default(null),
    expiryDate: z.string().or(z.date()),
    usageLimit: z
      .number()
      .int()
      .min(1, "Usage limit must be at least 1")
      .optional()
      .default(100),
    isActive: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.discountType === "PERCENTAGE" && data.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discountValue"],
        message: "Percentage discount cannot exceed 100%",
      });
    }
  });

export type CouponInput = z.infer<typeof CouponInputSchema>;

export const CheckoutInputSchema = z.object({
  planId: z.string().trim().min(1, "Plan ID is required"),
  paymentMode: z.enum(["FULL", "PARTIAL"]),
  upfrontPercentage: z.number().min(10).max(100).optional(),
  couponCode: z.string().trim().optional().nullable(),
});

export type CheckoutInput = z.infer<typeof CheckoutInputSchema>;

export const OverrideTransactionInputSchema = z.object({
  transactionId: z.string().trim().min(1, "Transaction ID is required"),
  note: z
    .string()
    .trim()
    .max(300)
    .optional()
    .default("Admin verified offline/installment settlement and overrode status to COMPLETED"),
});

export type OverrideTransactionInput = z.infer<typeof OverrideTransactionInputSchema>;

export const SettleBalanceInputSchema = z.object({
  transactionId: z.string().trim().min(1, "Transaction ID is required"),
  amount: z.number().positive("Settlement amount must be greater than 0").optional(),
});
