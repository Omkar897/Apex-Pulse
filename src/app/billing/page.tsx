import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentSession } from "@/lib/auth";
import { listPlans } from "@/services/plan.service";
import { listUserTransactions } from "@/services/subscription.service";
import { BillingHistoryClient } from "@/components/dashboard/BillingHistoryClient";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const session = await getCurrentSession();
  if (!session.isAuthenticated || !session.user) {
    redirect("/sign-in");
  }

  const [transactions, plans] = await Promise.all([
    listUserTransactions(session.user.clerkId),
    listPlans({ includeInactive: true }),
  ]);

  return (
    <div className="bg-slate-950 min-h-screen text-slate-100">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-14 space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-8">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 mb-3 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Member Dashboard
            </Link>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Billing & Payment History
            </h1>
            <p className="text-sm text-slate-400 mt-1.5">
              View itemized digital invoices, locked-in plan rates, and settle any
              remaining installment balances.
            </p>
          </div>
        </div>

        <BillingHistoryClient
          initialTransactions={transactions}
          livePlans={plans}
        />
      </div>
    </div>
  );
}
