import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Flame,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth";
import { listPlans } from "@/services/plan.service";
import { listCoupons } from "@/services/coupon.service";
import { PricingGrid } from "@/components/marketing/PricingGrid";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  await connectToDatabase();
  const [plans, coupons, session] = await Promise.all([
    listPlans({ includeInactive: false }),
    listCoupons({ onlyActive: true }),
    getCurrentSession(),
  ]);

  return (
    <div className="bg-slate-950 text-slate-100">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-slate-950 to-slate-950 pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 lg:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-medium mb-8">
            <Flame className="w-3.5 h-3.5 text-emerald-400" />
            <span>Flexible Multi-Month Memberships • Easy Split Payments</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.08] max-w-4xl mx-auto">
            Train Harder.{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Pay Smarter.
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Unlock up to <span className="text-white font-semibold">35% savings</span> on
            long-term athletic memberships with flexible installment billing,
            guaranteed rate protection, and instant digital receipts.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#pricing"
              className="px-7 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all inline-flex items-center gap-2 shadow-xl shadow-emerald-500/20"
            >
              Explore Membership Plans
              <ArrowRight className="w-4 h-4" />
            </a>

            {session.isAuthenticated ? (
              <Link
                href={
                  session.user?.role === "ADMIN"
                    ? "/admin/dashboard"
                    : "/dashboard"
                }
                className="px-7 py-4 rounded-xl border border-slate-800 bg-slate-900/70 hover:bg-slate-800 text-slate-200 font-semibold text-sm transition-all inline-flex items-center gap-2"
              >
                Go to My Portal
              </Link>
            ) : (
              <Link
                href="/sign-up"
                className="px-7 py-4 rounded-xl border border-slate-800 bg-slate-900/70 hover:bg-slate-800 text-slate-200 font-semibold text-sm transition-all inline-flex items-center gap-2"
              >
                Create Member Account
              </Link>
            )}
          </div>

          {/* Sleek 3-Metric Highlights */}
          <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto text-left">
            <div className="p-6 rounded-2xl border border-slate-800/70 bg-slate-900/30 backdrop-blur-sm">
              <div className="text-xs font-medium text-slate-400">
                Multi-Month Savings
              </div>
              <div className="text-2xl font-extrabold text-white mt-1">
                Up to 35% Off
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Automatic tiered discounts on 3, 6, and 12-month commitments
              </p>
            </div>
            <div className="p-6 rounded-2xl border border-slate-800/70 bg-slate-900/30 backdrop-blur-sm">
              <div className="text-xs font-medium text-slate-400">
                Split-Payment Flexibility
              </div>
              <div className="text-2xl font-extrabold text-emerald-400 mt-1">
                From 30% Upfront
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Start training today and settle your remaining balance anytime
              </p>
            </div>
            <div className="p-6 rounded-2xl border border-slate-800/70 bg-slate-900/30 backdrop-blur-sm">
              <div className="text-xs font-medium text-slate-400">
                Member Rate Lock
              </div>
              <div className="text-2xl font-extrabold text-white mt-1">
                100% Protected
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Your locked-in rate stays fixed for your entire membership term
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Active Promo Codes Strip */}
      {coupons.length > 0 && (
        <section className="border-b border-slate-900 bg-slate-950/60 py-6">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <Sparkles className="w-4 h-4" />
              <span>Available Club Offers (Apply at Checkout):</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {coupons.map((c) => (
                <div
                  key={c._id}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs flex items-center gap-2"
                >
                  <span className="font-mono font-bold text-emerald-400">
                    {c.code}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-300">{c.description}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Dynamic Pricing & Interactive Savings Section */}
      <PricingGrid
        plans={plans}
        isAuthenticated={session.isAuthenticated}
        activePlanId={session.user?.subscription.planId || null}
        userSubscription={session.user?.subscription || null}
        availableCoupons={coupons}
      />

      {/* Sleek Club Benefits Section */}
      <section className="py-24 border-t border-slate-900 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-2xl mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Membership Experience
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-3 tracking-tight">
              Designed for transparent, stress-free fitness billing.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl border border-slate-800/80 bg-slate-900/30 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">
                Flexible Installment Plans
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Choose to pay in full or split eligible multi-month memberships into
                manageable upfront and balance payments right from your dashboard.
              </p>
            </div>

            <div className="p-8 rounded-3xl border border-slate-800/80 bg-slate-900/30 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">
                Guaranteed Price Lock
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                When you join a plan, your monthly rate and discount are locked in
                on your invoice—even if club membership prices increase later.
              </p>
            </div>

            <div className="p-8 rounded-3xl border border-slate-800/80 bg-slate-900/30 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Award className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">
                Proactive Renewal Alerts
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Never lose your training momentum. Your member portal notifies you
                ahead of upcoming renewals and keeps every itemized receipt in one
                place.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
