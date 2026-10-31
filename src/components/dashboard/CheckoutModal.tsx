"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Lock,
  Percent,
  ShieldCheck,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import {
  ICouponDTO,
  ISubscriptionPlanDTO,
  IUserSubscriptionDTO,
  PaymentMode,
} from "@/types/domain";
import {
  calculatePaymentSplit,
  calculatePlanPricing,
} from "@/lib/subscription-engine";
import { formatDate, formatINR } from "@/lib/utils";

interface CheckoutModalProps {
  plan: ISubscriptionPlanDTO;
  currentSubscription?: IUserSubscriptionDTO | null;
  availableCoupons?: ICouponDTO[];
  onClose: () => void;
  onSuccess: () => void;
}

export function CheckoutModal({
  plan,
  currentSubscription,
  availableCoupons = [],
  onClose,
  onSuccess,
}: CheckoutModalProps) {
  const hasActiveMembership = Boolean(
    currentSubscription &&
      currentSubscription.status === "ACTIVE" &&
      currentSubscription.endDate &&
      new Date(currentSubscription.endDate).getTime() > Date.now()
  );

  const hasUnpaidBalanceOnCurrent = Boolean(
    hasActiveMembership && (currentSubscription?.balanceDue ?? 0) > 0
  );

  const currentDuration =
    currentSubscription?.planSnapshot?.durationMonths ?? 0;
  const transitionLabel = !hasActiveMembership
    ? null
    : plan.durationMonths < currentDuration
    ? "Lower Membership Tier (Downgrade)"
    : plan.durationMonths > currentDuration
    ? "Higher Membership Tier (Upgrade)"
    : "Membership Extension";

  const [paymentMode, setPaymentMode] = useState<PaymentMode>("FULL");
  const [upfrontPercentage, setUpfrontPercentage] = useState<number>(
    plan.allowPartialPayment ? plan.minPartialPercentage : 100
  );
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<ICouponDTO | null>(null);
  const [couponMessage, setCouponMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectivePaymentMode: PaymentMode = hasActiveMembership
    ? "FULL"
    : paymentMode;

  const pricing = calculatePlanPricing(plan, appliedCoupon);
  const split = calculatePaymentSplit({
    totalAmount: pricing.totalAmount,
    paymentMode: effectivePaymentMode,
    allowPartialPayment: hasActiveMembership ? false : plan.allowPartialPayment,
    minPartialPercentage: plan.minPartialPercentage,
    upfrontPercentage:
      effectivePaymentMode === "PARTIAL" ? upfrontPercentage : 100,
  });

  async function validateAndApplyCode(rawCode: string): Promise<ICouponDTO | null> {
    const cleanCode = rawCode.trim().toUpperCase();
    if (!cleanCode) return null;
    setCouponInput(cleanCode);
    setValidatingCoupon(true);
    setCouponMessage(null);

    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: cleanCode,
          subtotalAmount: pricing.subtotalAfterPlanDiscount,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setAppliedCoupon(null);
        setCouponMessage({
          text: data.reason || data.error || "Invalid coupon code",
          isError: true,
        });
        return null;
      }

      const resolvedCoupon: ICouponDTO = data.coupon ?? {
        _id: String(data.code || cleanCode),
        code: String(data.code || cleanCode),
        description: "",
        discountType: data.discountType === "FLAT" ? "FLAT" : "PERCENTAGE",
        discountValue: Number(data.discountValue ?? 0),
        minPurchaseAmount: 0,
        maxDiscountAmount: null,
        expiryDate: new Date(Date.now() + 90 * 86400000).toISOString(),
        usageLimit: 1000,
        usedCount: 0,
        isActive: true,
      };

      setAppliedCoupon(resolvedCoupon);
      setCouponMessage({
        text: `Promo ${resolvedCoupon.code} applied! Instant discount of ${formatINR(
          Number(data.discountAmount ?? 0)
        )} unlocked.`,
        isError: false,
      });
      return resolvedCoupon;
    } catch {
      setCouponMessage({
        text: "Could not validate coupon code",
        isError: true,
      });
      return null;
    } finally {
      setValidatingCoupon(false);
    }
  }

  async function handleApplyCoupon() {
    await validateAndApplyCode(couponInput);
  }

  async function handleCheckoutSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (hasUnpaidBalanceOnCurrent) {
      setError(
        "Please pay the remaining balance on your current membership before scheduling a new plan."
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let activeCouponCode = appliedCoupon ? appliedCoupon.code : null;
      const typedCode = couponInput.trim().toUpperCase();
      if (typedCode && (!appliedCoupon || appliedCoupon.code !== typedCode)) {
        const validated = await validateAndApplyCode(typedCode);
        if (!validated) {
          setSubmitting(false);
          return;
        }
        activeCouponCode = validated.code;
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan._id,
          paymentMode: effectivePaymentMode,
          upfrontPercentage:
            effectivePaymentMode === "PARTIAL" ? upfrontPercentage : 100,
          couponCode: activeCouponCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Checkout failed");
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setSubmitting(false);
    }
  }

  const quickOffers =
    availableCoupons.length > 0
      ? availableCoupons.filter((c) => c.isActive)
      : [
          {
            code: "APEX20",
            label: "Apply APEX20 for instant 20% discount",
          },
        ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-800 bg-slate-950/60">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">
              Membership Checkout
            </span>
            <h3 className="text-lg font-bold text-white mt-0.5">
              {plan.name} ({plan.durationMonths}{" "}
              {plan.durationMonths === 1 ? "Month" : "Months"})
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCheckoutSubmit} className="p-7 space-y-6">
          {error && (
            <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 p-3.5 text-xs text-rose-300 font-medium">
              {error}
            </div>
          )}

          {/* Active Membership Upgrade / Downgrade Scheduling Notice */}
          {hasActiveMembership && (
            <div
              className={`rounded-2xl p-4 border text-xs space-y-1.5 ${
                hasUnpaidBalanceOnCurrent
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                  : "bg-cyan-500/10 border-cyan-500/30 text-cyan-100"
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-white">
                {hasUnpaidBalanceOnCurrent ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Settle Current Plan Balance First</span>
                  </>
                ) : (
                  <>
                    <CalendarClock className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>
                      Scheduled {transitionLabel} • Starts After Current Plan
                    </span>
                  </>
                )}
              </div>

              {hasUnpaidBalanceOnCurrent ? (
                <p className="leading-relaxed text-amber-200/90">
                  You have an unpaid installment balance of{" "}
                  <strong>
                    {formatINR(currentSubscription?.balanceDue ?? 0)}
                  </strong>{" "}
                  on your active{" "}
                  <strong>{currentSubscription?.planSnapshot?.name}</strong>{" "}
                  membership. Please{" "}
                  <Link
                    href="/billing"
                    onClick={onClose}
                    className="underline font-bold text-white hover:text-amber-300"
                  >
                    pay your remaining balance in Billing
                  </Link>{" "}
                  before scheduling your next membership.
                </p>
              ) : (
                <p className="leading-relaxed text-cyan-100/90">
                  Your current{" "}
                  <strong>{currentSubscription?.planSnapshot?.name}</strong>{" "}
                  membership is active until{" "}
                  <strong>{formatDate(currentSubscription?.endDate)}</strong>.
                  With <strong>100% Full Payment</strong> today, this{" "}
                  <strong>{plan.name}</strong> plan will be queued and will{" "}
                  <strong>
                    automatically activate on{" "}
                    {formatDate(currentSubscription?.endDate)}
                  </strong>{" "}
                  once your current membership ends.
                </p>
              )}
            </div>
          )}

          {/* Coupon Code Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Promo / Coupon Code
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => {
                    const nextVal = e.target.value.toUpperCase();
                    setCouponInput(nextVal);
                    if (appliedCoupon && appliedCoupon.code !== nextVal.trim()) {
                      setAppliedCoupon(null);
                      setCouponMessage(null);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleApplyCoupon();
                    }
                  }}
                  placeholder="Use APEX20 for an instant 20% discount"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 pl-10 pr-3 py-2.5 text-xs text-white uppercase placeholder:normal-case placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              {appliedCoupon ? (
                <button
                  type="button"
                  onClick={() => {
                    setAppliedCoupon(null);
                    setCouponInput("");
                    setCouponMessage(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold border border-rose-500/25 transition-colors"
                >
                  Clear
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={validatingCoupon || !couponInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-400 border border-slate-700 disabled:opacity-50"
                >
                  {validatingCoupon ? "Checking..." : "Apply"}
                </button>
              )}
            </div>

            {/* 1-Click Available Coupon Chips */}
            <div className="mt-2.5 flex flex-wrap gap-2">
              {quickOffers.map((offer) => {
                const code = offer.code;
                const desc =
                  "discountType" in offer
                    ? offer.discountType === "PERCENTAGE"
                      ? `Apply ${offer.code} for instant ${offer.discountValue}% discount`
                      : `Apply ${offer.code} for flat ${formatINR(
                          offer.discountValue
                        )} discount`
                    : offer.label;
                const isSelected = appliedCoupon?.code === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => validateAndApplyCode(code)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                      isSelected
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                        : "bg-slate-950/80 border-slate-800 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300"
                    }`}
                  >
                    <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>{desc}</span>
                  </button>
                );
              })}
            </div>

            {couponMessage && (
              <p
                className={`mt-2 text-xs font-medium ${
                  couponMessage.isError ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                {couponMessage.text}
              </p>
            )}
          </div>

          {/* Payment Mode Selector (Full vs Partial) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Payment Schedule
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMode("FULL")}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  effectivePaymentMode === "FULL"
                    ? "border-emerald-500 bg-emerald-500/10 text-white"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">100% Full Payment</span>
                  <CheckCircle2
                    className={`w-4 h-4 ${
                      effectivePaymentMode === "FULL"
                        ? "text-emerald-400"
                        : "text-slate-600"
                    }`}
                  />
                </div>
                <div className="text-lg font-extrabold text-white mt-1">
                  {formatINR(pricing.totalAmount)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {hasActiveMembership
                    ? "Required to schedule next membership"
                    : "Zero remaining balance due"}
                </div>
              </button>

              <button
                type="button"
                disabled={!plan.allowPartialPayment || hasActiveMembership}
                onClick={() => {
                  if (plan.allowPartialPayment && !hasActiveMembership) {
                    setPaymentMode("PARTIAL");
                  }
                }}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  !plan.allowPartialPayment || hasActiveMembership
                    ? "border-slate-800/50 bg-slate-950/30 text-slate-600 cursor-not-allowed"
                    : effectivePaymentMode === "PARTIAL"
                    ? "border-amber-400 bg-amber-400/10 text-white"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">
                    Split / Partial Payment
                  </span>
                  <Percent
                    className={`w-4 h-4 ${
                      effectivePaymentMode === "PARTIAL"
                        ? "text-amber-400"
                        : "text-slate-600"
                    }`}
                  />
                </div>
                {hasActiveMembership ? (
                  <div className="text-[11px] text-slate-500 mt-2">
                    Full payment required when queuing next plan
                  </div>
                ) : plan.allowPartialPayment ? (
                  <>
                    <div className="text-lg font-extrabold text-white mt-1">
                      From {plan.minPartialPercentage}% Upfront
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Pay balance later from your portal
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-500 mt-2">
                    Available on 3, 6 & 12-month plans
                  </div>
                )}
              </button>
            </div>

            {/* Slider for Partial Upfront Percentage */}
            {effectivePaymentMode === "PARTIAL" &&
              plan.allowPartialPayment &&
              !hasActiveMembership && (
                <div className="mt-4 p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">
                      Upfront Installment Percentage:
                    </span>
                    <span className="font-bold text-amber-400">
                      {upfrontPercentage}% Now ({formatINR(split.amountPaid)})
                    </span>
                  </div>
                  <input
                    type="range"
                    min={plan.minPartialPercentage}
                    max={90}
                    step={5}
                    value={upfrontPercentage}
                    onChange={(e) =>
                      setUpfrontPercentage(Number(e.target.value))
                    }
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Min {plan.minPartialPercentage}%</span>
                    <span>
                      Remaining Balance:{" "}
                      <strong className="text-amber-300">
                        {formatINR(split.remainingBalance)}
                      </strong>
                    </span>
                  </div>
                </div>
              )}
          </div>

          {/* Itemized Breakdown */}
          <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-5 space-y-2.5 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>
                Base Price ({formatINR(plan.baseMonthlyPrice)} ×{" "}
                {plan.durationMonths} mo)
              </span>
              <span>{formatINR(pricing.grossAmount)}</span>
            </div>

            {pricing.planDiscountAmount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Multi-Month Savings ({plan.discountPercentage}%)</span>
                <span>- {formatINR(pricing.planDiscountAmount)}</span>
              </div>
            )}

            {pricing.couponDiscountAmount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Promo Code ({pricing.couponCode})</span>
                <span>- {formatINR(pricing.couponDiscountAmount)}</span>
              </div>
            )}

            <div className="pt-2.5 border-t border-slate-800 flex justify-between font-bold text-sm text-white">
              <span>Net Payable Total</span>
              <span>{formatINR(pricing.totalAmount)}</span>
            </div>

            <div className="pt-2.5 border-t border-slate-800/70 flex justify-between text-xs">
              <span className="text-slate-300 font-semibold">
                Due Today (
                {effectivePaymentMode === "FULL"
                  ? "100%"
                  : `${upfrontPercentage}%`}
                )
              </span>
              <span className="text-base font-extrabold text-emerald-400">
                {formatINR(split.amountPaid)}
              </span>
            </div>

            {split.remainingBalance > 0 && (
              <div className="flex justify-between text-xs text-amber-300">
                <span>Remaining Balance (Recorded on Account)</span>
                <span className="font-bold">
                  {formatINR(split.remainingBalance)}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {hasActiveMembership
                ? `Your new ${plan.name} rate is locked today and activates automatically on ${formatDate(
                    currentSubscription?.endDate
                  )}.`
                : "Your monthly rate and discount are locked in for the entire duration of your membership cycle."}
            </span>
          </div>

          <button
            type="submit"
            disabled={submitting || hasUnpaidBalanceOnCurrent}
            className="w-full py-3.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            <CreditCard className="w-4 h-4" />
            {submitting
              ? "Processing Payment..."
              : hasActiveMembership
              ? `Pay Full & Schedule (${formatINR(split.amountPaid)})`
              : `Confirm & Pay ${formatINR(split.amountPaid)}`}
            <Lock className="w-3.5 h-3.5 ml-1 opacity-75" />
          </button>
        </form>
      </div>
    </div>
  );
}
