"use client";

import React from "react";
import {
  CheckCircle2,
  Clock,
  Dumbbell,
  FileText,
  Printer,
  ShieldCheck,
  X,
} from "lucide-react";
import { ISubscriptionPlanDTO, ITransactionDTO } from "@/types/domain";
import { compareSnapshotWithLivePlan } from "@/lib/snapshot-service";
import { formatDate, formatINR } from "@/lib/utils";

interface InvoiceModalProps {
  transaction: ITransactionDTO;
  livePlan?: ISubscriptionPlanDTO | null;
  onClose: () => void;
}

export function InvoiceModal({
  transaction,
  livePlan,
  onClose,
}: InvoiceModalProps) {
  const drift = compareSnapshotWithLivePlan(
    transaction.planSnapshot,
    livePlan ?? null
  );

  function handlePrintSinglePage() {
    const existingFrame = document.getElementById("apex-print-frame");
    if (existingFrame) {
      existingFrame.remove();
    }

    const iframe = document.createElement("iframe");
    iframe.id = "apex-print-frame";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const statusBadge =
      transaction.paymentStatus === "COMPLETED"
        ? "COMPLETED"
        : "PARTIAL PAYMENT";

    const couponRowHtml = transaction.pricingBreakdown.couponCode
      ? `<div class="row discount">
           <span>Promotional Coupon (${transaction.pricingBreakdown.couponCode} • ${transaction.pricingBreakdown.couponDiscountType})</span>
           <span>- ${formatINR(transaction.pricingBreakdown.couponDiscountAmount)}</span>
         </div>`
      : "";

    const driftHtml = drift.isDrifted
      ? `<div class="box guarantee">
           <strong>Member Rate Lock Guarantee</strong>
           <p>${drift.summary}</p>
         </div>`
      : "";

    const overrideHtml = transaction.overrideAudit
      ? `<div class="box settlement">
           <strong>Balance Settlement Record</strong>
           <p>Marked as COMPLETED by ${transaction.overrideAudit.overriddenBy} on ${formatDate(
          transaction.overrideAudit.overriddenAt
        )}. Previous remaining balance of ${formatINR(
          transaction.overrideAudit.previousRemainingBalance
        )} was settled in full.${
          transaction.overrideAudit.note
            ? ` Note: "${transaction.overrideAudit.note}"`
            : ""
        }</p>
         </div>`
      : "";

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${transaction.invoiceNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 13px;
      line-height: 1.5;
    }
    .sheet {
      width: 100%;
      max-width: 720px;
      margin: 0 auto;
      border: 1px solid #cbd5e1;
      border-radius: 16px;
      padding: 28px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 18px;
      margin-bottom: 20px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #0f172a;
      margin: 0;
    }
    .brand-sub {
      font-size: 12px;
      color: #475569;
      margin: 4px 0 0 0;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      background: ${
        transaction.paymentStatus === "COMPLETED" ? "#d1fae5" : "#fef3c7"
      };
      color: ${
        transaction.paymentStatus === "COMPLETED" ? "#065f46" : "#92400e"
      };
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 20px;
    }
    .meta-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px;
    }
    .meta-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 4px;
    }
    .meta-value {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }
    .meta-sub {
      font-size: 12px;
      color: #475569;
      margin-top: 2px;
    }
    .table-box {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 18px;
    }
    .table-head {
      background: #f1f5f9;
      padding: 10px 16px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #334155;
      border-bottom: 1px solid #e2e8f0;
    }
    .table-body {
      padding: 16px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 13px;
      color: #334155;
    }
    .row.discount {
      color: #047857;
      font-weight: 600;
    }
    .row.divider {
      border-top: 1px solid #e2e8f0;
      margin-top: 6px;
      padding-top: 10px;
    }
    .row.total {
      border-top: 2px solid #cbd5e1;
      margin-top: 8px;
      padding-top: 12px;
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
    }
    .row.paid {
      color: #047857;
      font-weight: 700;
    }
    .row.balance {
      color: #b45309;
      font-weight: 700;
    }
    .box {
      border-radius: 10px;
      padding: 12px 14px;
      font-size: 12px;
      margin-top: 12px;
    }
    .box p {
      margin: 4px 0 0 0;
    }
    .box.guarantee {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
    }
    .box.settlement {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      color: #075985;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <h1 class="brand-title">APEX PULSE ATHLETIC CLUB</h1>
        <p class="brand-sub">Official Membership Invoice • ${transaction.invoiceNumber}</p>
      </div>
      <div style="text-align: right;">
        <span class="badge">${statusBadge}</span>
        <p class="brand-sub" style="margin-top: 6px;">Issued on ${formatDate(
          transaction.paymentDate
        )}</p>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-card">
        <div class="meta-label">Billed To</div>
        <div class="meta-value">${transaction.userName}</div>
        <div class="meta-sub">${transaction.userEmail}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Locked Plan Terms</div>
        <div class="meta-value">${transaction.planSnapshot.name} (${
      transaction.planSnapshot.durationMonths
    } Months)</div>
        <div class="meta-sub">Rate Locked: ${formatINR(
          transaction.planSnapshot.baseMonthlyPrice
        )}/mo (${transaction.planSnapshot.discountPercentage}% Plan Discount)</div>
      </div>
    </div>

    <div class="table-box">
      <div class="table-head">Itemized Calculation Breakdown</div>
      <div class="table-body">
        <div class="row">
          <span>Gross Base Amount (${formatINR(
            transaction.planSnapshot.baseMonthlyPrice
          )} × ${transaction.planSnapshot.durationMonths} months)</span>
          <span>${formatINR(transaction.pricingBreakdown.grossAmount)}</span>
        </div>
        <div class="row discount">
          <span>Multi-Month Commitment Discount (${
            transaction.pricingBreakdown.planDiscountPercentage
          }%)</span>
          <span>- ${formatINR(
            transaction.pricingBreakdown.planDiscountAmount
          )}</span>
        </div>
        <div class="row divider">
          <span>Subtotal After Plan Discount</span>
          <span>${formatINR(
            transaction.pricingBreakdown.subtotalAfterPlanDiscount
          )}</span>
        </div>
        ${couponRowHtml}
        <div class="row total">
          <span>Net Payable Total</span>
          <span>${formatINR(transaction.totalAmount)}</span>
        </div>
        <div class="row paid">
          <span>Amount Paid (${transaction.paymentMode})</span>
          <span>${formatINR(transaction.amountPaid)}</span>
        </div>
        <div class="row balance">
          <span>Remaining Balance Due</span>
          <span>${formatINR(transaction.remainingBalance)}</span>
        </div>
      </div>
    </div>

    ${driftHtml}
    ${overrideHtml}
  </div>
</body>
</html>`;

    const frameDoc = iframe.contentWindow?.document;
    if (frameDoc && iframe.contentWindow) {
      frameDoc.open();
      frameDoc.write(htmlContent);
      frameDoc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 150);
    } else {
      window.print();
    }
  }

  return (
    <div
      id="invoice-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div
        id="printable-invoice-card"
        className="relative w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden my-8"
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-800 bg-slate-950/60 no-print">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Official Membership Invoice • {transaction.invoiceNumber}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintSinglePage}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Invoice Body */}
        <div className="p-7 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950">
                <Dumbbell className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-white">
                  APEX PULSE ATHLETIC CLUB
                </h3>
                <p className="text-xs text-slate-400">
                  Tax Invoice & Payment Receipt
                </p>
              </div>
            </div>

            <div className="sm:text-right">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-slate-950 border-slate-700">
                {transaction.paymentStatus === "COMPLETED" ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">COMPLETED</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-400">PARTIAL PAYMENT</span>
                  </>
                )}
              </div>
              <div className="text-xs text-slate-400 mt-1.5">
                Issued on {formatDate(transaction.paymentDate)}
              </div>
            </div>
          </div>

          {/* Member & Plan Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <div className="text-slate-400 font-medium">Billed To</div>
              <div className="text-sm font-bold text-white">
                {transaction.userName}
              </div>
              <div className="text-slate-400">{transaction.userEmail}</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <div className="text-slate-400 font-medium">
                Locked Plan Terms
              </div>
              <div className="text-sm font-bold text-emerald-400">
                {transaction.planSnapshot.name} (
                {transaction.planSnapshot.durationMonths} Months)
              </div>
              <div className="text-slate-400">
                Rate Locked: {formatINR(transaction.planSnapshot.baseMonthlyPrice)}
                /mo ({transaction.planSnapshot.discountPercentage}% Plan Discount)
              </div>
            </div>
          </div>

          {/* Itemized Financial Breakdown */}
          <div className="rounded-2xl border border-slate-800 overflow-hidden">
            <div className="bg-slate-950 px-5 py-3 text-xs font-semibold text-slate-300 border-b border-slate-800">
              Itemized Calculation Breakdown
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>
                  Gross Base Amount (
                  {formatINR(transaction.planSnapshot.baseMonthlyPrice)} ×{" "}
                  {transaction.planSnapshot.durationMonths} months)
                </span>
                <span className="font-medium">
                  {formatINR(transaction.pricingBreakdown.grossAmount)}
                </span>
              </div>

              <div className="flex justify-between text-emerald-400">
                <span>
                  Multi-Month Commitment Discount (
                  {transaction.pricingBreakdown.planDiscountPercentage}%)
                </span>
                <span>
                  - {formatINR(transaction.pricingBreakdown.planDiscountAmount)}
                </span>
              </div>

              <div className="flex justify-between text-slate-400 pt-2 border-t border-slate-800/60">
                <span>Subtotal After Plan Discount</span>
                <span>
                  {formatINR(
                    transaction.pricingBreakdown.subtotalAfterPlanDiscount
                  )}
                </span>
              </div>

              {transaction.pricingBreakdown.couponCode && (
                <div className="flex justify-between text-emerald-400">
                  <span>
                    Promotional Coupon ({transaction.pricingBreakdown.couponCode}{" "}
                    • {transaction.pricingBreakdown.couponDiscountType})
                  </span>
                  <span>
                    -{" "}
                    {formatINR(
                      transaction.pricingBreakdown.couponDiscountAmount
                    )}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-sm font-bold text-white pt-3 border-t border-slate-800">
                <span>Net Payable Total</span>
                <span>{formatINR(transaction.totalAmount)}</span>
              </div>

              <div className="flex justify-between text-emerald-400 font-semibold">
                <span>Amount Paid ({transaction.paymentMode})</span>
                <span>{formatINR(transaction.amountPaid)}</span>
              </div>

              <div className="flex justify-between text-amber-300 font-semibold">
                <span>Remaining Balance Due</span>
                <span>{formatINR(transaction.remainingBalance)}</span>
              </div>
            </div>
          </div>

          {/* Price Protection Guarantee Box */}
          {drift.isDrifted && (
            <div className="rounded-2xl p-4 border text-xs bg-emerald-500/10 border-emerald-500/30 text-emerald-200">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <div className="space-y-1">
                  <div className="font-bold text-white">
                    Member Rate Lock Guarantee
                  </div>
                  <p className="leading-relaxed opacity-90">{drift.summary}</p>
                </div>
              </div>
            </div>
          )}

          {transaction.overrideAudit && (
            <div className="rounded-2xl bg-sky-500/10 border border-sky-500/30 p-4 text-xs text-sky-200">
              <div className="font-bold text-white mb-0.5">
                Balance Settlement Record
              </div>
              <p>
                Marked as <strong>COMPLETED</strong> by{" "}
                <span className="font-mono">
                  {transaction.overrideAudit.overriddenBy}
                </span>{" "}
                on {formatDate(transaction.overrideAudit.overriddenAt)}.
                Previous remaining balance of{" "}
                {formatINR(transaction.overrideAudit.previousRemainingBalance)}{" "}
                was settled in full.
                {transaction.overrideAudit.note
                  ? ` Note: "${transaction.overrideAudit.note}"`
                  : ""}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
