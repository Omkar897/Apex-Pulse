import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getCurrentSession, isClerkConfigured } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "APEX PULSE | Athletic Club & Memberships",
  description:
    "High-performance strength, conditioning, and recovery club with flexible membership plans.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getCurrentSession();

  const content = (
    <html lang="en" className="dark">
      <body
        className={`${inter.className} antialiased bg-slate-950 text-slate-100 min-h-screen flex flex-col selection:bg-emerald-500 selection:text-slate-950`}
      >
        <Navbar user={session.user} isAuthenticated={session.isAuthenticated} />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );

  if (isClerkConfigured()) {
    const { ClerkProvider } = await import("@clerk/nextjs");
    return <ClerkProvider>{content}</ClerkProvider>;
  }

  return content;
}
