import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  CalendarClock,
  CreditCard,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { getCurrentSession } from "@/lib/auth";
import { listPlans } from "@/services/plan.service";
import { listCoupons } from "@/services/coupon.service";
import { listUserTransactions } from "@/services/subscription.service";
import { evaluateSubscriptionAlerts } from "@/lib/subscription-engine";
import { compareSnapshotWithLivePlan } from "@/lib/snapshot-service";
import { formatDate, formatINR } from "@/lib/utils";
import { SubscriptionAlerts } from "@/components/dashboard/SubscriptionAlerts";
import { PricingGrid } from "@/components/marketing/PricingGrid";

export const dynamic = "force-dynamic";

export default async function UserDashboardPage() {
  const session = await getCurrentSession();
  if (!session.isAuthenticated || !session.user) {
    redirect("/sign-in");
  }

  const user = session.user;
  const [plans, coupons, transactions] = await Promise.all([
    listPlans({ includeInactive: false }),
    listCoupons({ onlyActive: true }),
    listUserTransactions(user.clerkId),
  ]);

  const alertEvaluation = evaluateSubscriptionAlerts(user.subscription);
  const livePlan =
    plans.find((p) => p._id === user.subscription.planId) || null;
  const driftReport =
    user.subscription.planSnapshot && livePlan
      ? compareSnapshotWithLivePlan(user.subscription.planSnapshot, livePlan)
      : null;

  return (
    <div className="bg-slate-950 min-h-screen text-slate-100">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-14 space-y-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-slate-900 pb-8">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Member Portal
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-1.5 tracking-tight">
              Welcome back, {user.name}
            </h1>
            <p className="text-sm text-slate-400 mt-1">{user.email}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/billing"
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 transition-colors inline-flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4 text-emerald-400" />
              Billing & Invoices ({transactions.length})
            </Link>
            <a
              href="#available-plans"
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
            >
              Browse Plans
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Subscription Alerts */}
        <SubscriptionAlerts alerts={alertEvaluation.alerts} />

        {/* Telemetry Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-3xl border border-slate-800/80 bg-slate-900/40 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Current Membership</span>
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-extrabold text-white">
              {user.subscription.planSnapshot?.name || "No Active Plan"}
            </div>
            <div className="text-xs">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  user.subscription.status === "ACTIVE"
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    : user.subscription.status === "EXPIRED"
                    ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {user.subscription.status}
              </span>
            </div>
          </div>

          <div className="p-6 rounded-3xl border border-slate-800/80 bg-slate-900/40 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Cycle Renewal Date</span>
              <Calendar className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-xl font-extrabold text-white">
              {formatDate(user.subscription.endDate)}
            </div>
            <div className="text-xs text-slate-400">
              {alertEvaluation.daysRemaining !== null
                ? alertEvaluation.daysRemaining >= 0
                  ? `${alertEvaluation.daysRemaining} day(s) remaining in cycle`
                  : `Expired ${Math.abs(alertEvaluation.daysRemaining)} day(s) ago`
                : "Select a plan below to activate"}
            </div>
          </div>

          <div className="p-6 rounded-3xl border border-slate-800/80 bg-slate-900/40 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Locked Member Rate</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-extrabold text-white">
              {user.subscription.planSnapshot
                ? `${formatINR(
                    user.subscription.planSnapshot.baseMonthlyPrice
                  )}/mo`
                : "—"}
            </div>
            <div className="text-xs text-slate-400">
              {user.subscription.planSnapshot
                ? `${user.subscription.planSnapshot.discountPercentage}% multi-month discount locked`
                : "Rate locked upon checkout"}
            </div>
          </div>

          <div className="p-6 rounded-3xl border border-slate-800/80 bg-slate-900/40 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Pending Balance</span>
              <Wallet className="w-4 h-4 text-amber-400" />
            </div>
            <div
              className={`text-xl font-extrabold ${
                user.subscription.balanceDue > 0
                  ? "text-amber-400"
                  : "text-emerald-400"
              }`}
            >
              {formatINR(user.subscription.balanceDue)}
            </div>
            <div className="text-xs text-slate-400">
              {user.subscription.balanceDue > 0 ? (
                <Link
                  href="/billing"
                  className="text-amber-300 underline hover:text-amber-200 font-semibold"
                >
                  Settle balance in Billing →
                </Link>
              ) : (
                "All installments settled"
              )}
            </div>
          </div>
        </div>

        {/* Price Protection Banner (Shown when live catalog price changed after purchase) */}
        {user.subscription.planSnapshot && driftReport && driftReport.isDrifted && (
          <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/30 via-slate-900 to-slate-900 p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Price Lock Guarantee Active</span>
              </div>
              <h3 className="text-lg font-bold text-white">
                Your membership rate is protected from recent club price updates
              </h3>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                {driftReport.summary}
              </p>
            </div>
          </div>
        )}

        {/* Scheduled Next Membership Banner (When Upgrade or Downgrade is Queued) */}
        {user.subscription.upcomingSubscription && (
          <div className="rounded-3xl border border-cyan-500/35 bg-gradient-to-r from-cyan-950/35 via-slate-900 to-slate-900 p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cyan-400">
                <CalendarClock className="w-4 h-4" />
                <span>
                  Scheduled Next Membership • Paid in Full
                </span>
              </div>
              <h3 className="text-lg font-bold text-white">
                {user.subscription.upcomingSubscription.planSnapshot.name} (
                {
                  user.subscription.upcomingSubscription.planSnapshot
                    .durationMonths
                }{" "}
                Months)
              </h3>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Your new membership will automatically activate on{" "}
                <strong className="text-white">
                  {formatDate(user.subscription.upcomingSubscription.startDate)}
                </strong>{" "}
                once your current{" "}
                <strong>{user.subscription.planSnapshot?.name}</strong>{" "}
                membership expires, running through{" "}
                <strong className="text-white">
                  {formatDate(user.subscription.upcomingSubscription.endDate)}
                </strong>
                .
              </p>
            </div>
            <div className="shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-bold">
                Starts{" "}
                {formatDate(user.subscription.upcomingSubscription.startDate)}
              </span>
            </div>
          </div>
        )}

        {/* Recent Billing Snapshot */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/30 p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white">Recent Payments</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Quick summary of your latest membership transactions
              </p>
            </div>
            <Link
              href="/billing"
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
            >
              View All Invoices
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {transactions.length === 0 ? (
            <p className="text-sm text-slate-400 py-6">
              You haven&apos;t purchased a membership plan yet. Choose a plan
              below to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 pr-4">Invoice</th>
                    <th className="py-3.5 px-4">Membership Plan</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Total</th>
                    <th className="py-3.5 px-4">Paid</th>
                    <th className="py-3.5 px-4">Remaining</th>
                    <th className="py-3.5 pl-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {transactions.slice(0, 3).map((tx) => (
                    <tr key={tx._id} className="hover:bg-slate-900/50">
                      <td className="py-4 pr-4 font-mono font-bold text-slate-200">
                        {tx.invoiceNumber}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-white">
                          {tx.planSnapshot.name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {tx.planSnapshot.durationMonths} Months •{" "}
                          {formatINR(tx.planSnapshot.baseMonthlyPrice)}/mo
                        </div>
                      </td>
                      <td className="py-4 px-4 text-slate-300">
                        {formatDate(tx.paymentDate)}
                      </td>
                      <td className="py-4 px-4 font-semibold text-white">
                        {formatINR(tx.totalAmount)}
                      </td>
                      <td className="py-4 px-4 text-emerald-400 font-semibold">
                        {formatINR(tx.amountPaid)}
                      </td>
                      <td className="py-4 px-4 text-amber-300 font-semibold">
                        {formatINR(tx.remainingBalance)}
                      </td>
                      <td className="py-4 pl-4 text-right">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            tx.paymentStatus === "COMPLETED"
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {tx.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Upgrade / Switch Plans */}
      <div id="available-plans" className="border-t border-slate-900">
        <PricingGrid
          plans={plans}
          isAuthenticated={true}
          activePlanId={user.subscription.planId}
          userSubscription={user.subscription}
          availableCoupons={coupons}
        />
      </div>
    </div>
  );
}
