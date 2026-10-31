import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { getCurrentSession } from "@/lib/auth";
import { listPlans } from "@/services/plan.service";
import { listCoupons } from "@/services/coupon.service";
import { listGlobalTransactions } from "@/services/subscription.service";
import { AdminConsoleClient } from "@/components/admin/AdminConsoleClient";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getCurrentSession();
  if (!session.isAuthenticated || !session.user) {
    redirect("/sign-in");
  }

  if (session.user.role !== "ADMIN") {
    return (
      <div className="bg-slate-950 min-h-[75vh] flex items-center justify-center px-6">
        <div className="max-w-md w-full rounded-3xl border border-rose-500/40 bg-slate-900/80 p-10 text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-extrabold text-white">
            Admin Access Required
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your current account (
            <strong className="text-white">{session.user.email}</strong>) is
            registered as a standard member. Sign in with a Club Admin account to
            manage plans, promotions, and billing records.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link
              href="/sign-in"
              className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 font-bold text-xs"
            >
              Return to Member Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const [plans, coupons, globalLedger] = await Promise.all([
    listPlans({ includeInactive: true }),
    listCoupons({ onlyActive: false }),
    listGlobalTransactions(),
  ]);

  return (
    <div className="bg-slate-950 min-h-screen text-slate-100">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-14 space-y-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-amber-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Club Administration</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-1.5 tracking-tight">
              Plans, Promotions & Revenue Oversight
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Signed in as <span className="text-slate-200 font-medium">{session.user.name}</span> ({session.user.email})
            </p>
          </div>
        </div>

        <AdminConsoleClient
          initialPlans={plans}
          initialCoupons={coupons}
          initialTransactions={globalLedger.transactions}
          metrics={globalLedger.metrics}
        />
      </div>
    </div>
  );
}
