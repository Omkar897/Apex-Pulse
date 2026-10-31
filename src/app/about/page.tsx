import React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Award,
  Clock,
  Dumbbell,
  HeartPulse,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";

export default function AboutPage() {
  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      {/* Hero */}
      <section className="border-b border-slate-900 py-24 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
            About APEX PULSE
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mt-3 tracking-tight max-w-3xl leading-tight">
            Built for athletes who demand precision in training and recovery.
          </h1>
          <p className="mt-6 text-slate-400 max-w-2xl text-base leading-relaxed">
            APEX PULSE combines Olympic-grade strength equipment, sports science
            recovery suites, and flexible multi-month memberships designed around
            your athletic goals.
          </p>
        </div>
      </section>

      {/* Facility Zones */}
      <section className="py-24 border-b border-slate-900">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl border border-slate-800/80 bg-slate-900/30 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                <Dumbbell className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white">
                Olympic Strength Arena
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                18 competition power racks, calibrated kilogram plates, deadlift
                platforms, and specialty bars engineered for progressive overload.
              </p>
            </div>

            <div className="p-8 rounded-3xl border border-slate-800/80 bg-slate-900/30 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400">
                <HeartPulse className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white">
                Metabolic & Conditioning Turf
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                40-meter indoor sprint track, Concept2 ergometers, assault bikes,
                and heart-rate telemetry zones for high-intensity conditioning.
              </p>
            </div>

            <div className="p-8 rounded-3xl border border-slate-800/80 bg-slate-900/30 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
                <Activity className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white">
                Cryo & Thermal Recovery Lab
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Full-spectrum infrared saunas, 4°C cold plunge pools, Normatec
                compression boots, and monthly InBody bio-impedance scans.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Club Standards & Location */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Member-First Commitments
            </span>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Why members choose our multi-month plans
            </h2>
            <div className="space-y-4">
              <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/30 flex items-start gap-4">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Locked-In Member Pricing
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Every membership purchase locks in your plan rate and discount
                    for your entire cycle, protecting you from future price
                    revisions.
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/30 flex items-start gap-4">
                <Award className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Split-Payment Installments
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Commit to a 3, 6, or 12-month transformation while paying a
                    partial upfront installment and settling the remainder directly
                    from your billing portal.
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/30 flex items-start gap-4">
                <Users className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Dedicated Performance Coaching
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Every multi-month plan includes structured 1-on-1 monthly
                    progress reviews and InBody body composition tracking.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 p-8 rounded-3xl border border-slate-800 bg-slate-900/50 space-y-6">
            <h3 className="text-xl font-bold text-white">
              Flagship Club Hours & Location
            </h3>
            <div className="space-y-4 text-sm text-slate-300">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-1" />
                <div>
                  <div className="font-semibold text-white">
                    APEX PULSE Performance Center
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Level 4, Balewadi High Street, Baner, Pune 411045
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-emerald-400 shrink-0 mt-1" />
                <div>
                  <div className="font-semibold text-white">Operating Hours</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Mon – Sat: 5:00 AM – 11:00 PM IST
                    <br />
                    Sunday: 6:00 AM – 9:00 PM IST
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/#pricing"
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all flex items-center justify-center gap-2"
              >
                View Membership Plans
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
