import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Deterministically rounds a monetary amount to 2 decimal places
 * avoiding IEEE-754 floating-point precision drift.
 */
export function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Formats an amount in Indian Rupees (INR / ₹) using Indian numbering system.
 */
export function formatINR(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const hasDecimals = safeAmount % 1 !== 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(safeAmount);
}

/**
 * Formats a Date or ISO date string into a human-readable date string.
 */
export function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "N/A";
  const parsed = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

/**
 * Generates a unique formatted invoice number: INV-YYYYMMDD-XXXX
 */
export function generateInvoiceNumber(
  date: Date = new Date(),
  randomSeed?: number
): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const rand =
    randomSeed !== undefined
      ? Math.floor(Math.abs(randomSeed) % 9000) + 1000
      : Math.floor(1000 + Math.random() * 9000);
  return `INV-${yyyy}${mm}${dd}-${rand}`;
}
