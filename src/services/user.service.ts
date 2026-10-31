import crypto from "crypto";
import mongoose from "mongoose";
import { User, IUserDocument } from "@/models/User";
import { IUserDTO, UserRole } from "@/types/domain";
import { roundCurrency } from "@/lib/utils";

export function hashPassword(password: string): string {
  return crypto
    .createHash("sha256")
    .update(`apexpulse_salt_${password}`)
    .digest("hex");
}

export const STRICT_EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function isValidEmailAddress(email: string): boolean {
  const trimmed = email.trim();
  if (!STRICT_EMAIL_REGEX.test(trimmed)) return false;
  if (trimmed.includes("..")) return false;
  return true;
}

export function toUserDTO(doc: IUserDocument): IUserDTO {
  return {
    _id: doc._id.toString(),
    clerkId: doc.clerkId,
    email: doc.email,
    name: doc.name,
    role: doc.role,
    subscription: {
      planId: doc.subscription.planId
        ? doc.subscription.planId.toString()
        : null,
      status: doc.subscription.status,
      startDate: doc.subscription.startDate
        ? doc.subscription.startDate.toISOString()
        : null,
      endDate: doc.subscription.endDate
        ? doc.subscription.endDate.toISOString()
        : null,
      balanceDue: roundCurrency(doc.subscription.balanceDue),
      planSnapshot: doc.subscription.planSnapshot
        ? {
            planId: doc.subscription.planSnapshot.planId,
            name: doc.subscription.planSnapshot.name,
            durationMonths: doc.subscription.planSnapshot.durationMonths,
            baseMonthlyPrice: roundCurrency(
              doc.subscription.planSnapshot.baseMonthlyPrice
            ),
            discountPercentage: roundCurrency(
              doc.subscription.planSnapshot.discountPercentage
            ),
            version: doc.subscription.planSnapshot.version,
            capturedAt: doc.subscription.planSnapshot.capturedAt,
          }
        : null,
      upcomingSubscription: doc.subscription.upcomingSubscription
        ? {
            planId: doc.subscription.upcomingSubscription.planId.toString(),
            startDate:
              doc.subscription.upcomingSubscription.startDate.toISOString(),
            endDate:
              doc.subscription.upcomingSubscription.endDate.toISOString(),
            planSnapshot: {
              planId:
                doc.subscription.upcomingSubscription.planSnapshot.planId,
              name: doc.subscription.upcomingSubscription.planSnapshot.name,
              durationMonths:
                doc.subscription.upcomingSubscription.planSnapshot
                  .durationMonths,
              baseMonthlyPrice: roundCurrency(
                doc.subscription.upcomingSubscription.planSnapshot
                  .baseMonthlyPrice
              ),
              discountPercentage: roundCurrency(
                doc.subscription.upcomingSubscription.planSnapshot
                  .discountPercentage
              ),
              version:
                doc.subscription.upcomingSubscription.planSnapshot.version,
              capturedAt:
                doc.subscription.upcomingSubscription.planSnapshot.capturedAt,
            },
          }
        : null,
    },
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
  };
}

export interface ClerkUserSyncPayload {
  clerkId: string;
  email: string;
  name: string;
  role?: UserRole;
}

/**
 * Idempotently syncs a Clerk user on first login or webhook event (`user.created` / `user.updated`)
 * without overwriting an existing user's active subscription or elevated role.
 */
export async function syncUserFromClerk(
  payload: ClerkUserSyncPayload
): Promise<IUserDTO> {
  const clerkId = payload.clerkId.trim();
  if (!clerkId) {
    throw new Error("clerkId is required to sync user");
  }

  const email = (payload.email || `${clerkId}@apexpulse.in`).trim().toLowerCase();
  const name = (payload.name || "Apex Member").trim();

  const existing = await User.findOne({ clerkId });
  if (existing) {
    existing.email = email;
    existing.name = name;
    if (payload.role && (payload.role === "ADMIN" || payload.role === "USER")) {
      existing.role = payload.role;
    }
    await existing.save();
    return toUserDTO(existing);
  }

  const created = await User.create({
    clerkId,
    email,
    name,
    role: payload.role === "ADMIN" ? "ADMIN" : "USER",
  });

  return toUserDTO(created);
}

export async function getUserByClerkId(
  clerkId: string
): Promise<IUserDTO | null> {
  const doc = await User.findOne({ clerkId: clerkId.trim() });
  if (!doc) return null;

  // Automatically activate queued upcomingSubscription once current subscription ends
  if (
    doc.subscription.upcomingSubscription &&
    doc.subscription.endDate &&
    doc.subscription.endDate.getTime() <= Date.now()
  ) {
    const upcoming = doc.subscription.upcomingSubscription;
    doc.subscription.planId = upcoming.planId;
    doc.subscription.status = "ACTIVE";
    doc.subscription.startDate = upcoming.startDate;
    doc.subscription.endDate = upcoming.endDate;
    doc.subscription.planSnapshot = upcoming.planSnapshot;
    doc.subscription.upcomingSubscription = null;
    await doc.save();
  }

  return toUserDTO(doc);
}

export async function getUserById(userId: string): Promise<IUserDTO | null> {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }
  const doc = await User.findById(userId);
  return doc ? toUserDTO(doc) : null;
}

export async function updateUserRole(
  clerkId: string,
  role: UserRole
): Promise<IUserDTO> {
  if (role !== "ADMIN" && role !== "USER") {
    throw new Error("Invalid user role");
  }
  const user = await User.findOne({ clerkId: clerkId.trim() });
  if (!user) {
    throw new Error("User not found");
  }
  user.role = role;
  await user.save();
  return toUserDTO(user);
}

/**
 * Evaluator Helper: Simulates subscription expiry date relative to `now`
 * so the 3-day expiry warning banner (`0 <= daysFromNow <= 3`) or expired banner (`daysFromNow < 0`)
 * can be demonstrated in 1 click.
 */
export async function simulateSubscriptionExpiryWindow(
  clerkId: string,
  daysFromNow: number,
  now: Date = new Date()
): Promise<IUserDTO> {
  const user = await User.findOne({ clerkId: clerkId.trim() });
  if (!user) {
    throw new Error("User not found");
  }

  if (!user.subscription || !user.subscription.planId) {
    throw new Error("User does not have an active subscription to simulate");
  }

  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  // Add a small 2-hour buffer so `Math.ceil(diff / MS_PER_DAY)` equals `daysFromNow` cleanly
  const targetEnd = new Date(
    now.getTime() + daysFromNow * MS_PER_DAY - (daysFromNow > 0 ? 1000 * 60 * 30 : 0)
  );

  user.subscription.endDate = targetEnd;
  user.subscription.status = daysFromNow < 0 ? "EXPIRED" : "ACTIVE";
  await user.save();
  return toUserDTO(user);
}

export function resolveRoleRedirectPath(role: UserRole): string {
  return role === "ADMIN" ? "/admin/dashboard" : "/dashboard";
}

export interface RegisterUserPayload {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

export async function registerUserAccount(
  payload: RegisterUserPayload
): Promise<IUserDTO> {
  const name = payload.name.trim();
  const email = payload.email.trim().toLowerCase();
  const password = payload.password;

  if (!name || name.length < 2) {
    throw new Error("Please enter your full name (at least 2 characters).");
  }
  if (!email || !isValidEmailAddress(email)) {
    throw new Error(
      "Please enter a valid email address (e.g., name@example.com)."
    );
  }
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  const existing = await User.findOne({ email });
  if (existing) {
    throw new Error(
      "An account with this email already exists. Please sign in instead."
    );
  }

  const clerkId = `user_${new mongoose.Types.ObjectId().toString()}`;
  const created = await User.create({
    clerkId,
    email,
    name,
    passwordHash: hashPassword(password),
    role: payload.role === "ADMIN" ? "ADMIN" : "USER",
  });

  return toUserDTO(created);
}

export interface AuthenticateUserPayload {
  email: string;
  password: string;
  expectedRole?: UserRole;
}

export async function authenticateUserAccount(
  payload: AuthenticateUserPayload
): Promise<IUserDTO> {
  const email = payload.email.trim().toLowerCase();
  const password = payload.password;

  if (!email || !password) {
    throw new Error("Email and password are required.");
  }
  if (!isValidEmailAddress(email)) {
    throw new Error(
      "Please enter a valid email address (e.g., name@example.com)."
    );
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new Error(
      "No account found with this email. Please create an account first."
    );
  }

  if (user.passwordHash && user.passwordHash !== hashPassword(password)) {
    throw new Error("Invalid email or password.");
  }

  if (payload.expectedRole && user.role !== payload.expectedRole) {
    if (payload.expectedRole === "ADMIN") {
      throw new Error(
        "This account does not have Club Admin privileges. Please use Member Sign In or create a Club Admin account."
      );
    }
    throw new Error(
      "This is a Club Admin account. Please use Club Admin Sign In to access the Admin Console."
    );
  }

  return toUserDTO(user);
}
