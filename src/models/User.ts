import mongoose, { Schema, Document, Model } from "mongoose";
import { PlanSnapshot, SubscriptionStatus, UserRole } from "@/types/domain";

export interface IUpcomingSubscriptionSubdocument {
  planId: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
  planSnapshot: PlanSnapshot;
}

export interface IUserSubscriptionSubdocument {
  planId: mongoose.Types.ObjectId | null;
  status: SubscriptionStatus;
  startDate: Date | null;
  endDate: Date | null;
  balanceDue: number;
  planSnapshot?: PlanSnapshot | null;
  upcomingSubscription?: IUpcomingSubscriptionSubdocument | null;
}

export interface IUserDocument extends Document {
  clerkId: string;
  email: string;
  name: string;
  passwordHash?: string | null;
  role: UserRole;
  subscription: IUserSubscriptionSubdocument;
  createdAt: Date;
  updatedAt: Date;
}

const PlanSnapshotSubSchema = new Schema<PlanSnapshot>(
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

const UpcomingSubscriptionSchema = new Schema<IUpcomingSubscriptionSubdocument>(
  {
    planId: {
      type: Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    planSnapshot: {
      type: PlanSnapshotSubSchema,
      required: true,
    },
  },
  { _id: false }
);

const UserSubscriptionSchema = new Schema<IUserSubscriptionSubdocument>(
  {
    planId: {
      type: Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      default: null,
    },
    status: {
      type: String,
      enum: ["NONE", "ACTIVE", "EXPIRED", "CANCELLED"],
      default: "NONE",
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    balanceDue: {
      type: Number,
      default: 0,
      min: 0,
    },
    planSnapshot: {
      type: PlanSnapshotSubSchema,
      default: null,
    },
    upcomingSubscription: {
      type: UpcomingSubscriptionSchema,
      default: null,
    },
  },
  { _id: false }
);

const UserSchema = new Schema<IUserDocument>(
  {
    clerkId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ["ADMIN", "USER"],
      default: "USER",
    },
    subscription: {
      type: UserSubscriptionSchema,
      default: () => ({
        planId: null,
        status: "NONE",
        startDate: null,
        endDate: null,
        balanceDue: 0,
        planSnapshot: null,
      }),
    },
  },
  {
    timestamps: true,
  }
);

export const User: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>("User", UserSchema);
