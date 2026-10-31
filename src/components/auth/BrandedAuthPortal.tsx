"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Dumbbell,
  Lock,
  Mail,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { UserRole } from "@/types/domain";

interface BrandedAuthPortalProps {
  mode: "sign-in" | "sign-up";
  defaultRole?: UserRole;
}

const STRICT_EMAIL_PATTERN =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function BrandedAuthPortal({
  mode,
  defaultRole = "USER",
}: BrandedAuthPortalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(defaultRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!STRICT_EMAIL_PATTERN.test(normalizedEmail)) {
      setError(
        "Please enter a valid email address (for example: name@example.com)."
      );
      return;
    }

    if (mode === "sign-up" && name.trim().length < 2) {
      setError("Please enter your full name (at least 2 characters).");
      return;
    }

    if (password.trim().length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      const payload =
        mode === "sign-up"
          ? {
              action: "REGISTER",
              name,
              email,
              password,
              role,
            }
          : {
              action: "SIGN_IN",
              email,
              password,
              role,
            };

      const res = await fetch("/api/evaluator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      router.push(data.redirectTo || "/auth/redirect");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-slate-950 flex items-center justify-center px-6 py-16">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 rounded-3xl overflow-hidden border border-slate-800/80 bg-slate-900/40 shadow-2xl backdrop-blur-xl">
        {/* Left Brand Showcase */}
        <div className="lg:col-span-5 p-10 sm:p-12 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-b lg:border-b-0 lg:border-r border-slate-800/80 flex flex-col justify-between">
          <div>
            <Link href="/" className="inline-flex items-center gap-3 mb-10">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
                <Dumbbell className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-white">
                APEX <span className="text-emerald-400">PULSE</span>
              </span>
            </Link>

            <h1 className="text-3xl font-extrabold text-white tracking-tight leading-snug mb-4">
              {mode === "sign-in"
                ? role === "ADMIN"
                  ? "Club Operations & Admin Console."
                  : "Welcome back to your training hub."
                : "Start your athletic transformation."}
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed mb-8">
              {role === "ADMIN"
                ? "Configure membership tiers, manage promotional discount codes, and oversee member billing across the club."
                : "Manage your club memberships, track flexible installment plans, and access instant digital invoices in one sleek portal."}
            </p>
          </div>

          <div className="space-y-4 pt-8 border-t border-slate-800/70">
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Flexible split-payment memberships</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Price-lock guarantee on active plans</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Instant digital receipts & billing history</span>
            </div>
          </div>
        </div>

        {/* Right Auth Form */}
        <div className="lg:col-span-7 p-10 sm:p-12 flex flex-col justify-center bg-slate-950/60">
          <div className="max-w-md w-full mx-auto">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider mb-3 border border-slate-800 bg-slate-900/90 text-slate-300">
                {role === "ADMIN" ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-300">Club Admin Portal</span>
                  </>
                ) : (
                  <>
                    <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Member Portal</span>
                  </>
                )}
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {mode === "sign-in"
                  ? role === "ADMIN"
                    ? "Admin Sign In"
                    : "Member Sign In"
                  : role === "ADMIN"
                  ? "Create Club Admin Account"
                  : "Create Member Account"}
              </h2>
              <p className="text-sm text-slate-400 mt-1.5">
                {mode === "sign-in"
                  ? role === "ADMIN"
                    ? "Enter your Club Admin credentials to access the management console."
                    : "Enter your email and password to access your member dashboard."
                  : "Fill in your details below to get started immediately."}
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 text-xs text-rose-300 font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  {mode === "sign-in" ? "Sign In As" : "Account Type"}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setRole("USER");
                      setError(null);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                      role === "USER"
                        ? "border-emerald-500/70 bg-emerald-500/10 text-white"
                        : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <UserIcon
                      className={`w-4 h-4 ${
                        role === "USER" ? "text-emerald-400" : "text-slate-500"
                      }`}
                    />
                    <div>
                      <div className="text-xs font-semibold">Member</div>
                      <div className="text-[11px] text-slate-400">
                        Personal training & plans
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRole("ADMIN");
                      setError(null);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                      role === "ADMIN"
                        ? "border-amber-500/70 bg-amber-500/10 text-white"
                        : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <ShieldCheck
                      className={`w-4 h-4 ${
                        role === "ADMIN" ? "text-amber-400" : "text-slate-500"
                      }`}
                    />
                    <div>
                      <div className="text-xs font-semibold">Club Admin</div>
                      <div className="text-[11px] text-slate-400">
                        Manage plans & billing
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {mode === "sign-up" && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full rounded-xl bg-slate-900 border border-slate-800 pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
                    title="Please enter a complete email address (e.g., name@example.com)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-xl bg-slate-900 border border-slate-800 pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full rounded-xl bg-slate-900 border border-slate-800 pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3.5 px-5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 ${
                  role === "ADMIN"
                    ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20"
                    : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20"
                }`}
              >
                {loading
                  ? "Please wait..."
                  : mode === "sign-in"
                  ? role === "ADMIN"
                    ? "Sign In as Club Admin"
                    : "Sign In as Member"
                  : role === "ADMIN"
                  ? "Create Admin Account"
                  : "Create Member Account"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-800/80 text-center text-xs text-slate-400">
              {mode === "sign-in" ? (
                <>
                  Don&apos;t have an account yet?{" "}
                  <Link
                    href="/sign-up"
                    className="text-emerald-400 hover:text-emerald-300 font-semibold ml-1"
                  >
                    Create an account
                  </Link>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <Link
                    href="/sign-in"
                    className="text-emerald-400 hover:text-emerald-300 font-semibold ml-1"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
