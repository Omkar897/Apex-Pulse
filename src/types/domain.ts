export type UserRole = "ADMIN" | "USER";

export type SubscriptionStatus = "NONE" | "ACTIVE" | "EXPIRED" | "CANCELLED";

export type PaymentStatus = "COMPLETED" | "PARTIAL" | "PENDING";

export type PaymentMode = "FULL" | "PARTIAL";

export type DiscountType = "FLAT" | "PERCENTAGE";

export interface PlanSnapshot {
  planId: string;
  name: string;
  durationMonths: number;
  baseMonthlyPrice: number;
  discountPercentage: number;
  version: number;
  capturedAt: string;
}

export interface PricingBreakdown {
  grossAmount: number;
  planDiscountPercentage: number;
  planDiscountAmount: number;
  subtotalAfterPlanDiscount: number;
  couponCode: string | null;
  couponDiscountType: DiscountType | null;
  couponDiscountValue: number;
  couponDiscountAmount: number;
  totalAmount: number;
  effectiveMonthlyPrice: number;
}

export interface PaymentSplit {
  paymentMode: PaymentMode;
  upfrontPercentage: number;
  totalAmount: number;
  amountPaid: number;
  remainingBalance: number;
  paymentStatus: PaymentStatus;
}

export interface OverrideAudit {
  overriddenBy: string;
  overriddenAt: string;
  previousAmountPaid: number;
  previousRemainingBalance: number;
  note: string;
}

export interface ISubscriptionPlanDTO {
  _id: string;
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
  createdAt?: string;
  updatedAt?: string;
}

export interface ICouponDTO {
  _id: string;
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  minPurchaseAmount: number;
  maxDiscountAmount?: number | null;
  expiryDate: string;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface IUpcomingSubscriptionDTO {
  planId: string;
  startDate: string;
  endDate: string;
  planSnapshot: PlanSnapshot;
}

export interface IUserSubscriptionDTO {
  planId: string | null;
  status: SubscriptionStatus;
  startDate: string | null;
  endDate: string | null;
  balanceDue: number;
  planSnapshot?: PlanSnapshot | null;
  upcomingSubscription?: IUpcomingSubscriptionDTO | null;
}

export interface IUserDTO {
  _id: string;
  clerkId: string;
  email: string;
  name: string;
  role: UserRole;
  subscription: IUserSubscriptionDTO;
  createdAt?: string;
  updatedAt?: string;
}

export interface ITransactionDTO {
  _id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  planId: string;
  invoiceNumber: string;
  totalAmount: number;
  amountPaid: number;
  remainingBalance: number;
  paymentStatus: PaymentStatus;
  paymentMode: PaymentMode;
  paymentDate: string;
  planSnapshot: PlanSnapshot;
  pricingBreakdown: PricingBreakdown;
  overrideAudit?: OverrideAudit | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubscriptionAlert {
  id: string;
  type: "ACTIVATION" | "EXPIRY_WARNING" | "EXPIRED" | "PARTIAL_BALANCE";
  severity: "success" | "warning" | "danger" | "info";
  title: string;
  message: string;
  daysRemaining?: number;
  actionLabel?: string;
  actionHref?: string;
}
