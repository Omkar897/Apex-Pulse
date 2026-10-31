import mongoose, { Schema, Document, Model } from "mongoose";
import { DiscountType } from "@/types/domain";

export interface ICouponDocument extends Document {
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  minPurchaseAmount: number;
  maxDiscountAmount: number | null;
  expiryDate: Date;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICouponDocument>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    discountType: {
      type: String,
      enum: ["FLAT", "PERCENTAGE"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0.01,
    },
    minPurchaseAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    usageLimit: {
      type: Number,
      default: 100,
      min: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Coupon: Model<ICouponDocument> =
  mongoose.models.Coupon || mongoose.model<ICouponDocument>("Coupon", CouponSchema);
