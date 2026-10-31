"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  CreditCard,
  Flame,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import {
  ICouponDTO,
  ISubscriptionPlanDTO,
  IUserSubscriptionDTO,
} from "@/types/domain";
import { calculatePlanPricing } from "@/lib/subscription-engine";
import { formatDate, formatINR } from "@/lib/utils";
import { CheckoutModal } from "@/components/dashboard/CheckoutModal";

interface PricingGridProps {
  plans: ISubscriptionPlanDTO[];
  isAuthenticated: boolean;
  activePlanId?: string | null;
  userSubscription?: IUserSubscriptionDTO | null;
  availableCoupons?: ICouponDTO[];
}

export function PricingGrid({
  plans,
  isAuthenticated,
  activePlanId,
  userSubscription = null,
  availableCoupons = [],
}: PricingGridProps) {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<ISubscriptionPlanDTO | null>(
    null
  );
  const [highlightLongTerm, setHighlightLongTerm] = useState(true);

  const hasActiveMembership = Boolean(
    userSubscription &&
      userSubscription.status === "ACTIVE" &&
      userSubscription.endDate &&
      new Date(userSubscription.endDate).getTime() > Date.now()
  );
  const currentDuration =
    userSubscription?.planSnapshot?.durationMonths ?? 0;

  function handleSelectPlan(plan: ISubscriptionPlanDTO) {
    if (!isAuthenticated) {
      router.push("/sign-in");
      return;
    }
    setSelectedPlan(plan);
  }

  return (
    <section id="pricing" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold mb-4">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Multi-Month Commitment Savings</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Choose Your Training Commitment
            </h2>
            <p className="text-slate-400 mt-2 max-w-xl text-sm leading-relaxed">
              Longer commitments unlock deeper automatic discounts and flexible
              installment options at checkout.
            </p>
          </div>

          {/* Interactive View Toggle */}
          <div className="inline-flex items-center p-1.5 rounded-2xl bg-slate-900 border border-slate-800 self-start">
            <button
              type="button"
              onClick={() => setHighlightLongTerm(false)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                !highlightLongTerm
                  ? "bg-slate-800 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Total Cycle View
            </button>
            <button
              type="button"
              onClick={() => setHighlightLongTerm(true)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                highlightLongTerm
                  ? "bg-emerald-500 text-slate-950 font-bold shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Effective Monthly Rate
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-7">
          {plans.map((plan) => {
            const pricing = calculatePlanPricing(plan, null);
            const isCurrentPlan = activePlanId === plan._id;
            const isScheduledNext =
              userSubscription?.upcomingSubscription?.planId === plan._id;

            let actionLabel = "Select Membership";
            if (!isAuthenticated) {
              actionLabel = "Sign In to Join";
            } else if (isScheduledNext) {
              actionLabel = "Scheduled Next (Update)";
            } else if (hasActiveMembership) {
              if (isCurrentPlan) {
                actionLabel = "Extend Plan (Starts After Current)";
              } else if (plan.durationMonths < currentDuration) {
                actionLabel = "Switch to Lower Plan (After Current)";
              } else {
                actionLabel = "Upgrade Plan (Starts After Current)";
              }
            } else if (isCurrentPlan) {
              actionLabel = "Renew Membership";
            }

            return (
              <div
                key={plan._id}
                className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all duration-200 border ${
                  plan.isPopular
                    ? "bg-gradient-to-b from-slate-900 via-slate-900/95 to-emerald-950/20 border-emerald-500/60 shadow-2xl shadow-emerald-500/10"
                    : "bg-slate-900/40 border-slate-800/80 hover:border-slate-700"
                }`}
              >
                {plan.isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-emerald-500 text-slate-950 text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1 shadow-lg">
                    <Flame className="w-3 h-3 fill-slate-950" />
                    Most Popular
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {plan.durationMonths}{" "}
                      {plan.durationMonths === 1 ? "Month" : "Months"}
                    </span>
                    {plan.discountPercentage > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                        Save {plan.discountPercentage}%
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed min-h-[40px]">
                    {plan.description}
                  </p>

                  {/* Pricing Display */}
                  <div className="mt-6 pt-6 border-t border-slate-800/80">
                    {highlightLongTerm ? (
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-extrabold text-white tracking-tight">
                            {formatINR(pricing.effectiveMonthlyPrice)}
                          </span>
                          <span className="text-xs text-slate-400">/ month</span>
                        </div>
                        {plan.discountPercentage > 0 ? (
                          <div className="mt-1.5 text-xs text-slate-400 flex items-center gap-2">
                            <span className="line-through text-slate-500">
                              {formatINR(plan.baseMonthlyPrice)}/mo
                            </span>
                            <span className="text-emerald-400 font-medium">
                              Save {formatINR(pricing.planDiscountAmount)}
                            </span>
                          </div>
                        ) : (
                          <div className="mt-1.5 text-xs text-slate-500">
                            Standard monthly billing
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-extrabold text-white tracking-tight">
                            {formatINR(pricing.subtotalAfterPlanDiscount)}
                          </span>
                          <span className="text-xs text-slate-400">
                            / {plan.durationMonths} mo
                          </span>
                        </div>
                        {plan.discountPercentage > 0 ? (
                          <div className="mt-1.5 text-xs text-slate-400">
                            <span className="line-through text-slate-500 mr-1.5">
                              {formatINR(pricing.grossAmount)}
                            </span>
                            <span className="text-emerald-400 font-medium">
                              ({formatINR(pricing.effectiveMonthlyPrice)}/mo)
                            </span>
                          </div>
                        ) : (
                          <div className="mt-1.5 text-xs text-slate-500">
                            Billed once for 30 days
                          </div>
                        )}
                      </div>
                    )}

                    {/* Partial payment badge */}
                    <div className="mt-4">
                      {plan.allowPartialPayment ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700/70 text-[11px] text-slate-300">
                          <CreditCard className="w-3 h-3 text-emerald-400" />
                          <span>
                            Split Payment: from{" "}
                            <strong className="text-white">
                              {plan.minPartialPercentage}%
                            </strong>{" "}
                            upfront
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-500">
                          <span>Single Full Payment</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Features List */}
                  <ul className="mt-6 space-y-3 text-xs text-slate-300">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Button */}
                <div className="mt-8 pt-4 space-y-2">
                  {isScheduledNext &&
                    userSubscription?.upcomingSubscription && (
                      <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded-lg py-1.5 px-2.5">
                        <CalendarClock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>
                          Activates{" "}
                          {formatDate(
                            userSubscription.upcomingSubscription.startDate
                          )}
                        </span>
                      </div>
                    )}
                  <button
                    type="button"
                    onClick={() => handleSelectPlan(plan)}
                    className={`w-full py-3.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      isCurrentPlan
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                        : plan.isPopular
                        ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
                        : "bg-slate-800 text-white hover:bg-slate-700 border border-slate-700"
                    }`}
                  >
                    {actionLabel}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedPlan && (
        <CheckoutModal
          plan={selectedPlan}
          currentSubscription={userSubscription}
          availableCoupons={availableCoupons}
          onClose={() => setSelectedPlan(null)}
          onSuccess={() => {
            setSelectedPlan(null);
            router.push("/dashboard");
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
