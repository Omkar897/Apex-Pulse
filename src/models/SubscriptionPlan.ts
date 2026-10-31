import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISubscriptionPlanDocument extends Document {
  name: string;
  description: string;
  durationMonths: number;
  baseMonthlyPrice: number;
  discountPercentage: number;
  allowPartialPayment: boolean;
  minPartialPercentage: number;
  features: string[];
  isPopular: boolean;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPlanSchema = new Schema<ISubscriptionPlanDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    durationMonths: {
      type: Number,
      required: true,
      min: 1,
      max: 60,
    },
    baseMonthlyPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    discountPercentage: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    allowPartialPayment: {
      type: Boolean,
      required: true,
      default: false,
    },
    minPartialPercentage: {
      type: Number,
      default: 50,
      min: 10,
      max: 90,
    },
    features: {
      type: [String],
      default: [],
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true,
  }
);

export const SubscriptionPlan: Model<ISubscriptionPlanDocument> =
  mongoose.models.SubscriptionPlan ||
  mongoose.model<ISubscriptionPlanDocument>("SubscriptionPlan", SubscriptionPlanSchema);
