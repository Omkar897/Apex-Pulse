import mongoose, { Schema, Document, Model } from "mongoose";
import {
  OverrideAudit,
  PaymentMode,
  PaymentStatus,
  PlanSnapshot,
  PricingBreakdown,
} from "@/types/domain";

export interface ITransactionDocument extends Document {
  userId: mongoose.Types.ObjectId;
  userEmail: string;
  userName: string;
  planId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  totalAmount: number;
  amountPaid: number;
  remainingBalance: number;
  paymentStatus: PaymentStatus;
  paymentMode: PaymentMode;
  paymentDate: Date;
  planSnapshot: PlanSnapshot;
  pricingBreakdown: PricingBreakdown;
  overrideAudit?: OverrideAudit | null;
  createdAt: Date;
  updatedAt: Date;
}

const PlanSnapshotSchema = new Schema<PlanSnapshot>(
  {
    planId: { type: String, required: true },
    name: { type: String, required: true },
    durationMonths: { type: Number, required: true },
    baseMonthlyPrice: { type: Number, required: true },
    discountPercentage: { type: Number, required: true },
    version: { type: Number, required: true },
    capturedAt: { type: String, required: true },
  },
  { _id: false }
);

const PricingBreakdownSchema = new Schema<PricingBreakdown>(
  {
    grossAmount: { type: Number, required: true },
    planDiscountPercentage: { type: Number, required: true },
    planDiscountAmount: { type: Number, required: true },
    subtotalAfterPlanDiscount: { type: Number, required: true },
    couponCode: { type: String, default: null },
    couponDiscountType: {
      type: String,
      enum: ["FLAT", "PERCENTAGE", null],
      default: null,
    },
    couponDiscountValue: { type: Number, default: 0 },
    couponDiscountAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    effectiveMonthlyPrice: { type: Number, required: true },
  },
  { _id: false }
);

const OverrideAuditSchema = new Schema<OverrideAudit>(
  {
    overriddenBy: { type: String, required: true },
    overriddenAt: { type: String, required: true },
    previousAmountPaid: { type: Number, required: true },
    previousRemainingBalance: { type: Number, required: true },
    note: { type: String, default: "Admin status override to COMPLETED" },
  },
  { _id: false }
);

const TransactionSchema = new Schema<ITransactionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      default: "",
    },
    userName: {
      type: String,
      default: "",
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    amountPaid: {
      type: Number,
      required: true,
      min: 0,
    },
    remainingBalance: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["COMPLETED", "PARTIAL", "PENDING"],
      required: true,
    },
    paymentMode: {
      type: String,
      enum: ["FULL", "PARTIAL"],
      default: "FULL",
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    planSnapshot: {
      type: PlanSnapshotSchema,
      required: true,
    },
    pricingBreakdown: {
      type: PricingBreakdownSchema,
      required: true,
    },
    overrideAudit: {
      type: OverrideAuditSchema,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Transaction: Model<ITransactionDocument> =
  mongoose.models.Transaction ||
  mongoose.model<ITransactionDocument>("Transaction", TransactionSchema);
