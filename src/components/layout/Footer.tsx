import React from "react";
import Link from "next/link";
import { Dumbbell } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-slate-900 bg-slate-950 text-slate-400">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950">
                <Dumbbell className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="font-extrabold text-lg tracking-tight text-white">
                APEX <span className="text-emerald-400">PULSE</span>
              </span>
            </div>
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              Premier strength, conditioning, and recovery club offering flexible
              multi-month memberships, split-payment plans, and personalized
              athletic coaching.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200 mb-4">
              Explore
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="/"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Membership Plans
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Facilities & Recovery
                </Link>
              </li>
              <li>
                <Link
                  href="/sign-up"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Create Account
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200 mb-4">
              Member Portal
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="/dashboard"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Member Dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/billing"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Billing & Receipts
                </Link>
              </li>
              <li>
                <Link
                  href="/sign-in"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Member Sign In
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
