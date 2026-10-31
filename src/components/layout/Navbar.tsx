"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CreditCard,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  X,
} from "lucide-react";
import { IUserDTO } from "@/types/domain";

interface NavbarProps {
  user: IUserDTO | null;
  isAuthenticated: boolean;
}

export function Navbar({ user, isAuthenticated }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await fetch("/api/evaluator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DEMO_SIGN_OUT" }),
    });
    router.push("/");
    router.refresh();
  }

  const navLinks = [
    { href: "/", label: "Memberships" },
    { href: "/about", label: "Club & Facilities" },
    ...(isAuthenticated
      ? [
          {
            href: "/dashboard",
            label: "Dashboard",
            icon: LayoutDashboard,
          },
          {
            href: "/billing",
            label: "Billing",
            icon: CreditCard,
          },
        ]
      : []),
    ...(isAuthenticated && user?.role === "ADMIN"
      ? [
          {
            href: "/admin/dashboard",
            label: "Admin",
            icon: ShieldCheck,
          },
        ]
      : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <Dumbbell className="w-5 h-5 stroke-[2.5]" />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-white">
            APEX <span className="text-emerald-400">PULSE</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                  active
                    ? "bg-slate-900 text-emerald-400 border border-slate-800"
                    : "text-slate-400 hover:text-white hover:bg-slate-900/50"
                }`}
              >
                {Icon && <Icon className="w-4 h-4" />}
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Auth Actions */}
        <div className="hidden md:flex items-center gap-4">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm font-semibold text-white leading-tight">
                  {user.name}
                </div>
                <div className="text-xs text-slate-400">
                  {user.role === "ADMIN" ? "Club Admin" : "Member"}
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                title="Sign Out"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-800 bg-slate-900/80 text-slate-300 hover:text-rose-400 hover:border-rose-500/40 transition-colors text-xs font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/sign-in"
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
              >
                Join Club
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900"
          aria-label="Toggle Menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950 px-6 py-5 space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block px-4 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-emerald-400"
            >
              {link.label}
            </Link>
          ))}
          {isAuthenticated ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium text-rose-400 hover:bg-slate-900"
            >
              Sign Out
            </button>
          ) : (
            <div className="pt-3 flex gap-3">
              <Link
                href="/sign-in"
                onClick={() => setMobileOpen(false)}
                className="flex-1 text-center py-2.5 rounded-xl border border-slate-800 text-sm font-medium text-slate-200"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                onClick={() => setMobileOpen(false)}
                className="flex-1 text-center py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-sm font-bold"
              >
                Join Club
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
