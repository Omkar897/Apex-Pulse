"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { ISubscriptionPlanDTO, ITransactionDTO } from "@/types/domain";
import { compareSnapshotWithLivePlan } from "@/lib/snapshot-service";
import { formatDate, formatINR } from "@/lib/utils";
import { InvoiceModal } from "@/components/dashboard/InvoiceModal";

interface BillingHistoryClientProps {
  initialTransactions: ITransactionDTO[];
  livePlans: ISubscriptionPlanDTO[];
}

export function BillingHistoryClient({
  initialTransactions,
  livePlans,
}: BillingHistoryClientProps) {
  const router = useRouter();
  const [transactions, setTransactions] =
    useState<ITransactionDTO[]>(initialTransactions);
  const [selectedInvoice, setSelectedInvoice] =
    useState<ITransactionDTO | null>(null);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const livePlanMap = new Map<string, ISubscriptionPlanDTO>();
  livePlans.forEach((p) => livePlanMap.set(p._id, p));

  async function handleSettleRemaining(txId: string) {
    setSettlingId(txId);
    setError(null);
    try {
      let res = await fetch(`/api/transactions/${txId}/override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "USER_SETTLE",
        }),
      });

      if (res.status === 404) {
        res = await fetch("/api/transactions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "USER_SETTLE",
            transactionId: txId,
          }),
        });
      }

      const rawText = await res.text();
      let data: { transaction?: ITransactionDTO; error?: string } = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(
          res.ok
            ? "Unexpected response from server"
            : `Failed to settle balance (HTTP ${res.status})`
        );
      }

      if (!res.ok || !data.transaction) {
        throw new Error(data.error || "Failed to settle balance");
      }

      const updatedTx = data.transaction;
      setTransactions((prev) =>
        prev.map((item) => (item._id === txId ? updatedTx : item))
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to settle balance");
    } finally {
      setSettlingId(null);
    }
  }

  const totalSpent = transactions.reduce((sum, t) => sum + t.amountPaid, 0);
  const totalBalance = transactions.reduce(
    (sum, t) => sum + t.remainingBalance,
    0
  );

  return (
    <div className="space-y-8">
      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl border border-slate-800/80 bg-slate-900/40">
          <div className="text-xs text-slate-400">Total Paid to Date</div>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1.5">
            {formatINR(totalSpent)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Across {transactions.length} invoice(s)
          </div>
        </div>

        <div className="p-6 rounded-3xl border border-slate-800/80 bg-slate-900/40">
          <div className="text-xs text-slate-400">Outstanding Installments</div>
          <div
            className={`text-2xl font-extrabold mt-1.5 ${
              totalBalance > 0 ? "text-amber-400" : "text-white"
            }`}
          >
            {formatINR(totalBalance)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {totalBalance > 0
              ? "Payable anytime with 1-click settlement"
              : "No pending balance due"}
          </div>
        </div>

        <div className="p-6 rounded-3xl border border-slate-800/80 bg-slate-900/40">
          <div className="text-xs text-slate-400">Rate Lock Protection</div>
          <div className="text-2xl font-extrabold text-white mt-1.5 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Guaranteed
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Historical invoices preserve your exact checkout pricing
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-4 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Transactions Table */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/30 overflow-hidden">
        <div className="p-6 sm:px-8 border-b border-slate-800/80 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Invoice Ledger</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select any transaction to view or print your itemized receipt
            </p>
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="p-14 text-center text-sm text-slate-400">
            No billing transactions recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 uppercase tracking-wider text-[11px]">
                  <th className="py-4 pl-8 pr-3">Invoice</th>
                  <th className="py-4 px-3">Date</th>
                  <th className="py-4 px-3">Membership Plan</th>
                  <th className="py-4 px-3">Locked Rate</th>
                  <th className="py-4 px-3">Net Total</th>
                  <th className="py-4 px-3">Amount Paid</th>
                  <th className="py-4 px-3">Remaining</th>
                  <th className="py-4 px-3">Status</th>
                  <th className="py-4 pl-3 pr-8 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {transactions.map((tx) => {
                  const livePlan =
                    livePlanMap.get(tx.planId) ||
                    livePlanMap.get(tx.planSnapshot.planId) ||
                    null;
                  const drift = compareSnapshotWithLivePlan(
                    tx.planSnapshot,
                    livePlan
                  );

                  return (
                    <tr
                      key={tx._id}
                      className="hover:bg-slate-900/50 transition-colors"
                    >
                      <td className="py-4 pl-8 pr-3 font-mono font-bold text-white">
                        {tx.invoiceNumber}
                      </td>
                      <td className="py-4 px-3 text-slate-300">
                        {formatDate(tx.paymentDate)}
                      </td>
                      <td className="py-4 px-3">
                        <div className="font-semibold text-white">
                          {tx.planSnapshot.name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {tx.planSnapshot.durationMonths} Months
                          {tx.pricingBreakdown.couponCode && (
                            <span className="ml-1.5 text-emerald-400 font-semibold">
                              • Promo: {tx.pricingBreakdown.couponCode}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <div className="font-semibold text-slate-200">
                          {formatINR(tx.planSnapshot.baseMonthlyPrice)}/mo (
                          {tx.planSnapshot.discountPercentage}% off)
                        </div>
                        {drift.isDrifted && (
                          <div className="text-[10px] text-emerald-400 font-medium mt-0.5">
                            Price Protected (Current:{" "}
                            {formatINR(drift.liveBaseMonthlyPrice || 0)}/mo)
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-3 font-bold text-white">
                        {formatINR(tx.totalAmount)}
                      </td>
                      <td className="py-4 px-3 font-bold text-emerald-400">
                        {formatINR(tx.amountPaid)}
                      </td>
                      <td className="py-4 px-3 font-bold text-amber-300">
                        {formatINR(tx.remainingBalance)}
                      </td>
                      <td className="py-4 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            tx.paymentStatus === "COMPLETED"
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {tx.paymentStatus === "COMPLETED" ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          {tx.paymentStatus}
                        </span>
                      </td>
                      <td className="py-4 pl-3 pr-8 text-right">
                        <div className="inline-flex items-center gap-2">
                          {tx.paymentStatus === "PARTIAL" && (
                            <button
                              type="button"
                              disabled={settlingId === tx._id}
                              onClick={() => handleSettleRemaining(tx._id)}
                              className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                            >
                              <CreditCard className="w-3 h-3" />
                              {settlingId === tx._id
                                ? "Paying..."
                                : "Pay Balance"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedInvoice(tx)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-[11px] transition-colors inline-flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3 text-emerald-400" />
                            Receipt
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedInvoice && (
        <InvoiceModal
          transaction={selectedInvoice}
          livePlan={
            livePlanMap.get(selectedInvoice.planId) ||
            livePlanMap.get(selectedInvoice.planSnapshot.planId) ||
            null
          }
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}
