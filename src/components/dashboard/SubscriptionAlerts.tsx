"use client";

import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  XCircle,
} from "lucide-react";
import { SubscriptionAlert } from "@/types/domain";

interface SubscriptionAlertsProps {
  alerts: SubscriptionAlert[];
}

export function SubscriptionAlerts({ alerts }: SubscriptionAlertsProps) {
  if (!alerts || alerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3" role="region" aria-label="Subscription Notifications">
      {alerts.map((alert) => {
        const isWarning = alert.severity === "warning";
        const isDanger = alert.severity === "danger";
        const isSuccess = alert.severity === "success";

        const containerClasses = isWarning
          ? "border-amber-500/50 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-slate-900/90 text-amber-100 shadow-lg shadow-amber-500/10"
          : isDanger
          ? "border-rose-500/50 bg-gradient-to-r from-rose-500/15 via-rose-500/10 to-slate-900/90 text-rose-100"
          : isSuccess
          ? "border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-slate-900/90 text-emerald-100"
          : "border-sky-500/40 bg-gradient-to-r from-sky-500/15 via-sky-500/5 to-slate-900/90 text-sky-100";

        const Icon = isWarning
          ? AlertTriangle
          : isDanger
          ? XCircle
          : isSuccess
          ? CheckCircle2
          : CreditCard;

        const iconColor = isWarning
          ? "text-amber-400"
          : isDanger
          ? "text-rose-400"
          : isSuccess
          ? "text-emerald-400"
          : "text-sky-400";

        return (
          <div
            key={alert.id}
            data-testid={alert.id}
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-4 sm:px-6 transition-all ${containerClasses}`}
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950/70 border border-white/10 ${iconColor}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-bold tracking-tight text-white">
                    {alert.title}
                  </h4>
                  {alert.type === "EXPIRY_WARNING" && (
                    <span className="inline-flex items-center rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-950">
                      3-Day Expiry Warning
                    </span>
                  )}
                  {alert.type === "ACTIVATION" && (
                    <span className="inline-flex items-center rounded-full bg-emerald-400/20 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                      Active Plan
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {alert.message}
                </p>
              </div>
            </div>

            {alert.actionLabel && alert.actionHref && (
              <Link
                href={alert.actionHref}
                className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  isWarning
                    ? "bg-amber-400 text-slate-950 hover:bg-amber-300"
                    : isDanger
                    ? "bg-rose-500 text-white hover:bg-rose-400"
                    : "bg-sky-400 text-slate-950 hover:bg-sky-300"
                }`}
              >
                {alert.actionLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
