"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  Layers,
  Plus,
  Receipt,
  ShieldCheck,
  Tag,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  DiscountType,
  ICouponDTO,
  ISubscriptionPlanDTO,
  ITransactionDTO,
  PaymentStatus,
} from "@/types/domain";
import { calculatePlanPricing } from "@/lib/subscription-engine";
import { formatDate, formatINR } from "@/lib/utils";
import { InvoiceModal } from "@/components/dashboard/InvoiceModal";

interface AdminConsoleClientProps {
  initialPlans: ISubscriptionPlanDTO[];
  initialCoupons: ICouponDTO[];
  initialTransactions: ITransactionDTO[];
  metrics: {
    totalRevenueCollected: number;
    totalPendingReceivables: number;
    completedCount: number;
    partialCount: number;
    totalTransactions: number;
  };
}

const STANDARD_CLUB_FEATURES: string[] = [
  "Unlimited Strength & Conditioning Floor Access",
  "1 InBody Bio-Impedance Scan / Month",
  "Locker & Steam Shower Access",
  "Mobile App Workout Tracking",
  "Monthly 1-on-1 Coach Performance Review",
  "Unlimited Group HIIT & Mobility Classes",
  "Complimentary Post-Workout Recovery Shake Bar (4x/mo)",
  "Infrared Sauna & Cold Plunge Recovery Suite (2x/wk)",
  "Custom Macro & Sports Nutrition Blueprint",
  "2 Guest Passes Every Month",
  "Unlimited Cryotherapy, Normatec & Infrared Recovery",
  "Dedicated Locker & Laundry Service",
  "Priority Booking & 30-Day Travel Freeze Protection",
];

const DEFAULT_SELECTED_FEATURES: string[] = [
  "Unlimited Strength & Conditioning Floor Access",
  "1 InBody Bio-Impedance Scan / Month",
  "Locker & Steam Shower Access",
  "Mobile App Workout Tracking",
];

export function AdminConsoleClient({
  initialPlans,
  initialCoupons,
  initialTransactions,
  metrics,
}: AdminConsoleClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "OVERSIGHT" | "PLANS" | "COUPONS"
  >("OVERSIGHT");
  const [txStatusFilter, setTxStatusFilter] = useState<PaymentStatus | "ALL">(
    "ALL"
  );
  const [overridingId, setOverridingId] = useState<string | null>(null);
  const [inspectingTx, setInspectingTx] = useState<ITransactionDTO | null>(
    null
  );
  const [bannerMessage, setBannerMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Plan Form State
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planName, setPlanName] = useState("");
  const [planDesc, setPlanDesc] = useState("");
  const [planDuration, setPlanDuration] = useState(3);
  const [planBasePrice, setPlanBasePrice] = useState(2499);
  const [planDiscountPct, setPlanDiscountPct] = useState(15);
  const [planAllowPartial, setPlanAllowPartial] = useState(true);
  const [planMinPartialPct, setPlanMinPartialPct] = useState(50);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(
    DEFAULT_SELECTED_FEATURES
  );
  const [planIsPopular, setPlanIsPopular] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);

  // Build complete list of selectable features (standard + any plan-specific features)
  const allAvailableFeatures = Array.from(
    new Set([
      ...STANDARD_CLUB_FEATURES,
      ...initialPlans.flatMap((p) => p.features),
      ...selectedFeatures,
    ])
  );

  function togglePlanFeature(feature: string) {
    setSelectedFeatures((prev) =>
      prev.includes(feature)
        ? prev.filter((item) => item !== feature)
        : [...prev, feature]
    );
  }

  // Coupon Form State
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponDesc, setCouponDesc] = useState("");
  const [couponType, setCouponType] = useState<DiscountType>("PERCENTAGE");
  const [couponValue, setCouponValue] = useState(20);
  const [couponMinPurchase, setCouponMinPurchase] = useState(2000);
  const [couponMaxDiscount, setCouponMaxDiscount] = useState<string>("2500");
  const [couponExpiry, setCouponExpiry] = useState("2027-03-31");
  const [couponUsageLimit, setCouponUsageLimit] = useState(100);
  const [savingCoupon, setSavingCoupon] = useState(false);

  const planMap = new Map(initialPlans.map((p) => [p._id, p]));

  const filteredTransactions =
    txStatusFilter === "ALL"
      ? initialTransactions
      : initialTransactions.filter((t) => t.paymentStatus === txStatusFilter);

  // Live Plan Math Preview inside Admin Plan Form
  const livePlanPreview = calculatePlanPricing({
    durationMonths: Math.max(1, Number(planDuration) || 1),
    baseMonthlyPrice: Math.max(0, Number(planBasePrice) || 0),
    discountPercentage: Math.min(100, Math.max(0, Number(planDiscountPct) || 0)),
  });

  // 1. Admin Override: PARTIAL -> COMPLETED
  async function handleOverrideStatus(tx: ITransactionDTO) {
    setOverridingId(tx._id);
    setBannerMessage(null);
    try {
      const res = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADMIN_OVERRIDE",
          transactionId: tx._id,
          note: `Admin manually overrode ${tx.invoiceNumber} from PARTIAL to COMPLETED`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerMessage({
          type: "error",
          text: data.error || "Override failed",
        });
        return;
      }
      setBannerMessage({
        type: "success",
        text: `Overrode ${tx.invoiceNumber} from PARTIAL to COMPLETED! Remaining balance cleared and user subscription updated.`,
      });
      router.refresh();
    } finally {
      setOverridingId(null);
    }
  }

  // 2. Plan CRUD Handlers
  function startEditPlan(plan: ISubscriptionPlanDTO) {
    setEditingPlanId(plan._id);
    setPlanName(plan.name);
    setPlanDesc(plan.description);
    setPlanDuration(plan.durationMonths);
    setPlanBasePrice(plan.baseMonthlyPrice);
    setPlanDiscountPct(plan.discountPercentage);
    setPlanAllowPartial(plan.allowPartialPayment);
    setPlanMinPartialPct(plan.minPartialPercentage || 50);
    setSelectedFeatures([...plan.features]);
    setPlanIsPopular(plan.isPopular);
  }

  function resetPlanForm() {
    setEditingPlanId(null);
    setPlanName("");
    setPlanDesc("");
    setPlanDuration(3);
    setPlanBasePrice(2499);
    setPlanDiscountPct(15);
    setPlanAllowPartial(true);
    setPlanMinPartialPct(50);
    setSelectedFeatures(DEFAULT_SELECTED_FEATURES);
    setPlanIsPopular(false);
  }

  async function handleSavePlan(e: React.FormEvent) {
    e.preventDefault();
    if (selectedFeatures.length === 0) {
      setBannerMessage({
        type: "error",
        text: "Please enable at least one plan feature using the checkboxes.",
      });
      return;
    }
    setSavingPlan(true);
    setBannerMessage(null);
    try {
      const payload = {
        name: planName,
        description: planDesc,
        durationMonths: Number(planDuration),
        baseMonthlyPrice: Number(planBasePrice),
        discountPercentage: Number(planDiscountPct),
        allowPartialPayment: planAllowPartial,
        minPartialPercentage: Number(planMinPartialPct),
        features: selectedFeatures,
        isPopular: planIsPopular,
        isActive: true,
      };

      const url = editingPlanId
        ? `/api/plans/${editingPlanId}`
        : "/api/plans";
      const method = editingPlanId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerMessage({
          type: "error",
          text: data.error || "Failed to save plan",
        });
        return;
      }

      setBannerMessage({
        type: "success",
        text: editingPlanId
          ? `Updated "${data.plan.name}" (Snapshot Version is now v${data.plan.version} — historical invoices remain locked at their original version!).`
          : `Created new plan "${data.plan.name}" (v${data.plan.version}).`,
      });
      resetPlanForm();
      router.refresh();
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleDeletePlan(planId: string, name: string) {
    setBannerMessage(null);
    const res = await fetch(`/api/plans/${planId}`, { method: "DELETE" });
    if (res.ok) {
      setBannerMessage({
        type: "success",
        text: `Deleted plan "${name}". Historical transactions referencing this plan remain preserved via embedded snapshots.`,
      });
      router.refresh();
    }
  }

  // 3. Coupon CRUD Handlers
  function startEditCoupon(c: ICouponDTO) {
    setEditingCouponId(c._id);
    setCouponCode(c.code);
    setCouponDesc(c.description);
    setCouponType(c.discountType);
    setCouponValue(c.discountValue);
    setCouponMinPurchase(c.minPurchaseAmount);
    setCouponMaxDiscount(
      c.maxDiscountAmount !== null && c.maxDiscountAmount !== undefined
        ? String(c.maxDiscountAmount)
        : ""
    );
    setCouponExpiry(c.expiryDate.slice(0, 10));
    setCouponUsageLimit(c.usageLimit);
  }

  function resetCouponForm() {
    setEditingCouponId(null);
    setCouponCode("");
    setCouponDesc("");
    setCouponType("PERCENTAGE");
    setCouponValue(20);
    setCouponMinPurchase(2000);
    setCouponMaxDiscount("2500");
    setCouponExpiry("2027-03-31");
    setCouponUsageLimit(100);
  }

  async function handleSaveCoupon(e: React.FormEvent) {
    e.preventDefault();
    setSavingCoupon(true);
    setBannerMessage(null);
    try {
      const payload = {
        code: couponCode.toUpperCase(),
        description: couponDesc,
        discountType: couponType,
        discountValue: Number(couponValue),
        minPurchaseAmount: Number(couponMinPurchase),
        maxDiscountAmount:
          couponType === "PERCENTAGE" && couponMaxDiscount.trim() !== ""
            ? Number(couponMaxDiscount)
            : null,
        expiryDate: new Date(couponExpiry).toISOString(),
        usageLimit: Number(couponUsageLimit),
        isActive: true,
      };

      const url = editingCouponId
        ? `/api/coupons/${editingCouponId}`
        : "/api/coupons";
      const method = editingCouponId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerMessage({
          type: "error",
          text: data.error || "Failed to save coupon",
        });
        return;
      }

      setBannerMessage({
        type: "success",
        text: editingCouponId
          ? `Updated coupon "${data.coupon.code}"`
          : `Created coupon "${data.coupon.code}" (${data.coupon.discountType})`,
      });
      resetCouponForm();
      router.refresh();
    } finally {
      setSavingCoupon(false);
    }
  }

  async function handleToggleCouponActive(coupon: ICouponDTO) {
    const res = await fetch(`/api/coupons/${coupon._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !coupon.isActive }),
    });
    if (res.ok) {
      setBannerMessage({
        type: "success",
        text: `Coupon "${coupon.code}" is now ${
          !coupon.isActive ? "ACTIVE" : "INACTIVE"
        }`,
      });
      router.refresh();
    }
  }

  async function handleDeleteCoupon(couponId: string, code: string) {
    const res = await fetch(`/api/coupons/${couponId}`, { method: "DELETE" });
    if (res.ok) {
      setBannerMessage({
        type: "success",
        text: `Deleted coupon "${code}"`,
      });
      router.refresh();
    }
  }

  return (
    <div className="space-y-8">
      {/* Executive KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>Collected Revenue</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-white">
            {formatINR(metrics.totalRevenueCollected)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {metrics.completedCount} completed invoices
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>Partial Receivables</span>
            <Wallet className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-amber-400">
            {formatINR(metrics.totalPendingReceivables)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {metrics.partialCount} partial installments awaiting settlement
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>Active Plan Tiers</span>
            <Layers className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-white">
            {initialPlans.length} Plans
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Dynamic duration & discount rules
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>Configured Coupons</span>
            <Tag className="h-4 w-4 text-lime-400" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-white">
            {initialCoupons.length} Codes
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Flat ₹ & Percentage % discounts
          </p>
        </div>
      </div>

      {/* Feedback Banner */}
      {bannerMessage && (
        <div
          className={`rounded-2xl border p-4 text-sm font-medium ${
            bannerMessage.type === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/40 bg-rose-500/10 text-rose-300"
          }`}
        >
          {bannerMessage.text}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-3 border-b border-slate-800 pb-5">
        <button
          type="button"
          onClick={() => setActiveTab("OVERSIGHT")}
          className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition ${
            activeTab === "OVERSIGHT"
              ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
              : "border border-slate-800 bg-slate-900 text-slate-300 hover:text-white"
          }`}
        >
          <Receipt className="h-4 w-4" />
          Transactions & Settlements ({initialTransactions.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PLANS")}
          className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition ${
            activeTab === "PLANS"
              ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
              : "border border-slate-800 bg-slate-900 text-slate-300 hover:text-white"
          }`}
        >
          <Layers className="h-4 w-4" />
          Membership Plans ({initialPlans.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("COUPONS")}
          className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition ${
            activeTab === "COUPONS"
              ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
              : "border border-slate-800 bg-slate-900 text-slate-300 hover:text-white"
          }`}
        >
          <Tag className="h-4 w-4" />
          Promotional Coupons ({initialCoupons.length})
        </button>
      </div>

      {/* TAB 1: GLOBAL TRANSACTION OVERSIGHT */}
      {activeTab === "OVERSIGHT" && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white">
                Member Transactions & Installment Settlement
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Review member invoices and mark partial installment balances as
                completed once verified.
              </p>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 p-1 self-start">
              {(["ALL", "PARTIAL", "COMPLETED"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setTxStatusFilter(status)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    txStatusFilter === status
                      ? "bg-emerald-500 text-slate-950"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-800 bg-slate-950/70 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3.5">Invoice #</th>
                    <th className="px-4 py-3.5">Member</th>
                    <th className="px-4 py-3.5">Membership Plan</th>
                    <th className="px-4 py-3.5">Total</th>
                    <th className="px-4 py-3.5">Paid</th>
                    <th className="px-4 py-3.5">Remaining</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {filteredTransactions.map((tx) => (
                    <tr
                      key={tx._id}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-4 py-4 font-mono font-bold text-white">
                        {tx.invoiceNumber}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-white">
                          {tx.userName || "Member"}
                        </div>
                        <div className="text-xs text-slate-400">
                          {tx.userEmail}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-200">
                          {tx.planSnapshot.name}
                        </div>
                        <div className="text-xs text-slate-400">
                          v{tx.planSnapshot.version} •{" "}
                          {formatINR(tx.planSnapshot.baseMonthlyPrice)}/mo
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono text-slate-200">
                        {formatINR(tx.totalAmount)}
                      </td>
                      <td className="px-4 py-4 font-mono font-semibold text-emerald-400">
                        {formatINR(tx.amountPaid)}
                      </td>
                      <td className="px-4 py-4 font-mono font-semibold text-amber-400">
                        {formatINR(tx.remainingBalance)}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            tx.paymentStatus === "COMPLETED"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {tx.paymentStatus === "COMPLETED" ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          {tx.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right space-x-2 whitespace-nowrap">
                        {tx.paymentStatus === "PARTIAL" && (
                          <button
                            type="button"
                            disabled={overridingId === tx._id}
                            onClick={() => handleOverrideStatus(tx)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-emerald-400 px-3 py-1.5 text-xs font-extrabold text-slate-950 shadow transition hover:brightness-110 disabled:opacity-50"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            {overridingId === tx._id
                              ? "Overriding..."
                              : "Override → COMPLETED"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setInspectingTx(tx)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-emerald-500/40"
                        >
                          <Eye className="h-3.5 w-3.5 text-emerald-400" />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PLAN MANAGER CRUD */}
      {activeTab === "PLANS" && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left: Create / Edit Plan Form */}
          <form
            onSubmit={handleSavePlan}
            className="lg:col-span-5 rounded-3xl border border-slate-800 bg-slate-900/90 p-6 space-y-4 self-start"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="h-5 w-5 text-emerald-400" />
                {editingPlanId
                  ? "Edit Subscription Plan"
                  : "Create Subscription Plan"}
              </h3>
              {editingPlanId && (
                <button
                  type="button"
                  onClick={resetPlanForm}
                  className="text-xs text-slate-400 hover:text-white underline"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  Plan Name
                </label>
                <input
                  type="text"
                  required
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="e.g. Summer Shred 4-Month Pro"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  Marketing Subtitle
                </label>
                <input
                  type="text"
                  value={planDesc}
                  onChange={(e) => setPlanDesc(e.target.value)}
                  placeholder="Short summary displayed on pricing grid"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Duration (Months)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    required
                    value={planDuration}
                    onChange={(e) => setPlanDuration(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Base Price (₹/mo)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={planBasePrice}
                    onChange={(e) => setPlanBasePrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Discount (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    required
                    value={planDiscountPct}
                    onChange={(e) => setPlanDiscountPct(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3.5 space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="font-semibold text-slate-200">
                    Allow Partial / Installment Payment
                  </span>
                  <input
                    type="checkbox"
                    checked={planAllowPartial}
                    onChange={(e) => setPlanAllowPartial(e.target.checked)}
                    className="h-4 w-4 accent-emerald-500"
                  />
                </label>

                {planAllowPartial && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-400">
                      Min Upfront Installment %:
                    </span>
                    <input
                      type="number"
                      min={10}
                      max={90}
                      value={planMinPartialPct}
                      onChange={(e) =>
                        setPlanMinPartialPct(Number(e.target.value))
                      }
                      className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-right text-white"
                    />
                  </div>
                )}

                <label className="flex items-center justify-between cursor-pointer pt-1 border-t border-slate-800/80">
                  <span className="font-semibold text-slate-200">
                    Highlight as &ldquo;Most Popular&rdquo;
                  </span>
                  <input
                    type="checkbox"
                    checked={planIsPopular}
                    onChange={(e) => setPlanIsPopular(e.target.checked)}
                    className="h-4 w-4 accent-emerald-500"
                  />
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-semibold text-slate-300">
                    Included Plan Features ({selectedFeatures.length} enabled)
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedFeatures([...allAvailableFeatures])
                      }
                      className="text-emerald-400 hover:text-emerald-300 font-semibold"
                    >
                      Select All
                    </button>
                    <span className="text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedFeatures([])}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 p-3 space-y-1.5">
                  {allAvailableFeatures.map((feature) => {
                    const isChecked = selectedFeatures.includes(feature);
                    return (
                      <label
                        key={feature}
                        className={`flex items-start gap-2.5 p-2 rounded-xl cursor-pointer transition-colors ${
                          isChecked
                            ? "bg-emerald-500/10 border border-emerald-500/30 text-white"
                            : "hover:bg-slate-900 text-slate-400 border border-transparent"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePlanFeature(feature)}
                          className="mt-0.5 h-4 w-4 rounded accent-emerald-500 shrink-0"
                        />
                        <span className="text-xs leading-snug">{feature}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Live Pricing Engine Preview */}
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  Live Engine Preview
                </span>
                <div className="flex justify-between text-slate-300">
                  <span>Gross Total:</span>
                  <span className="font-mono">
                    {formatINR(livePlanPreview.grossAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-400 font-bold">
                  <span>Net Cycle Total ({planDiscountPct}% off):</span>
                  <span className="font-mono">
                    {formatINR(livePlanPreview.totalAmount)} (
                    {formatINR(livePlanPreview.effectiveMonthlyPrice)}/mo)
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingPlan}
                className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition"
              >
                {savingPlan
                  ? "Saving Plan..."
                  : editingPlanId
                  ? "Save Plan Changes"
                  : "Create Membership Plan"}
              </button>
            </div>
          </form>

          {/* Right: Existing Plans List */}
          <div className="lg:col-span-7 space-y-4">
            {initialPlans.map((plan) => {
              const pricing = calculatePlanPricing(plan, null);
              return (
                <div
                  key={plan._id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-bold text-white">
                        {plan.name}
                      </h4>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-emerald-400">
                        v{plan.version}
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                        {plan.durationMonths} Mo
                      </span>
                      {plan.discountPercentage > 0 && (
                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                          {plan.discountPercentage}% OFF
                        </span>
                      )}
                      {plan.allowPartialPayment && (
                        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                          Partial Enabled (≥{plan.minPartialPercentage}%)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{plan.description}</p>
                    <p className="text-xs text-slate-300 pt-1">
                      Base:{" "}
                      <strong className="text-white">
                        {formatINR(plan.baseMonthlyPrice)}/mo
                      </strong>{" "}
                      → Net Cycle Total:{" "}
                      <strong className="text-emerald-400">
                        {formatINR(pricing.totalAmount)}
                      </strong>{" "}
                      ({formatINR(pricing.effectiveMonthlyPrice)}/mo effective)
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEditPlan(plan)}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-500/50 hover:text-white"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-emerald-400" />
                      Edit Price / Terms
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePlan(plan._id, plan.name)}
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-rose-300 hover:bg-rose-500/20"
                      title="Delete Plan"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: COUPON MANAGER CRUD */}
      {activeTab === "COUPONS" && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left: Create / Edit Coupon Form */}
          <form
            onSubmit={handleSaveCoupon}
            className="lg:col-span-5 rounded-3xl border border-slate-800 bg-slate-900/90 p-6 space-y-4 self-start"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Tag className="h-5 w-5 text-emerald-400" />
                {editingCouponId ? "Edit Discount Code" : "Create Discount Code"}
              </h3>
              {editingCouponId && (
                <button
                  type="button"
                  onClick={resetCouponForm}
                  className="text-xs text-slate-400 hover:text-white underline"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  Coupon Code (Uppercase Alphanumeric)
                </label>
                <input
                  type="text"
                  required
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SUMMER25 or FLAT1000"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 font-mono text-sm uppercase text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={couponDesc}
                  onChange={(e) => setCouponDesc(e.target.value)}
                  placeholder="e.g. Flat ₹1,000 off on Quarterly & Annual Plans"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Discount Type
                  </label>
                  <select
                    value={couponType}
                    onChange={(e) =>
                      setCouponType(e.target.value as DiscountType)
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  >
                    <option value="PERCENTAGE">PERCENTAGE (%)</option>
                    <option value="FLAT">FLAT (₹ INR)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    {couponType === "PERCENTAGE"
                      ? "Percentage (1-100%)"
                      : "Flat Amount (₹)"}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={couponType === "PERCENTAGE" ? 100 : 500000}
                    required
                    value={couponValue}
                    onChange={(e) => setCouponValue(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Min Order Subtotal (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={couponMinPurchase}
                    onChange={(e) =>
                      setCouponMinPurchase(Number(e.target.value))
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>

                {couponType === "PERCENTAGE" && (
                  <div>
                    <label className="font-semibold text-slate-300 block mb-1">
                      Max Discount Cap (₹)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={couponMaxDiscount}
                      onChange={(e) => setCouponMaxDiscount(e.target.value)}
                      placeholder="Optional cap"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    required
                    value={couponExpiry}
                    onChange={(e) => setCouponExpiry(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Usage Limit
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={couponUsageLimit}
                    onChange={(e) =>
                      setCouponUsageLimit(Number(e.target.value))
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingCoupon}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-lime-400 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-950 shadow-lg shadow-emerald-500/20 hover:brightness-110"
              >
                {savingCoupon
                  ? "Saving Coupon..."
                  : editingCouponId
                  ? "Update Coupon Code"
                  : "Create Coupon Code"}
              </button>
            </div>
          </form>

          {/* Right: Existing Coupons List */}
          <div className="lg:col-span-7 space-y-4">
            {initialCoupons.map((coupon) => (
              <div
                key={coupon._id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg border border-emerald-500/30 bg-slate-950 px-3 py-1 font-mono text-sm font-extrabold text-emerald-400">
                      {coupon.code}
                    </span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-white">
                      {coupon.discountType === "PERCENTAGE"
                        ? `${coupon.discountValue}% OFF`
                        : `${formatINR(coupon.discountValue)} FLAT OFF`}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        coupon.isActive
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-rose-500/20 text-rose-300"
                      }`}
                    >
                      {coupon.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{coupon.description}</p>
                  <p className="text-[11px] text-slate-400 pt-1">
                    Min Subtotal: {formatINR(coupon.minPurchaseAmount)} •{" "}
                    {coupon.maxDiscountAmount
                      ? `Cap: ${formatINR(coupon.maxDiscountAmount)} • `
                      : ""}
                    Used: {coupon.usedCount}/{coupon.usageLimit} • Expires:{" "}
                    {formatDate(coupon.expiryDate)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleCouponActive(coupon)}
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
                  >
                    {coupon.isActive ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEditCoupon(coupon)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-emerald-500/50"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-emerald-400" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCoupon(coupon._id, coupon.code)}
                    className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-rose-300 hover:bg-rose-500/20"
                    title="Delete Coupon"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {inspectingTx && (
        <InvoiceModal
          transaction={inspectingTx}
          livePlan={planMap.get(inspectingTx.planId) ?? null}
          onClose={() => setInspectingTx(null)}
        />
      )}
    </div>
  );
}
