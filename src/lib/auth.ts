import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/db";
import {
  DEFAULT_DEMO_ADMIN_CLERK_ID,
  DEFAULT_DEMO_USER_CLERK_ID,
} from "@/lib/seed";
import {
  getUserByClerkId,
  syncUserFromClerk,
} from "@/services/user.service";
import { IUserDTO, UserRole } from "@/types/domain";

export const DEMO_SESSION_COOKIE = "apex_session_token_v3";
export const DEMO_ROLE_COOKIE = "apex_role_token_v3";

/**
 * Checks whether valid (non-placeholder) Clerk environment variables are configured.
 */
export function isClerkConfigured(): boolean {
  const pubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const secKey = process.env.CLERK_SECRET_KEY;
  if (!pubKey || !secKey) return false;
  if (pubKey.includes("xxxxxxxx") || secKey.includes("xxxxxxxx")) return false;
  return pubKey.startsWith("pk_") && secKey.startsWith("sk_");
}

export interface SessionContext {
  isAuthenticated: boolean;
  clerkId: string | null;
  user: IUserDTO | null;
  isDemoMode: boolean;
}

/**
 * Resolves the currently authenticated user from Clerk (with JIT MongoDB sync)
 * or from the Evaluator/Demo session cookie when running locally without Clerk keys.
 */
export async function getCurrentSession(): Promise<SessionContext> {
  await connectToDatabase();

  if (isClerkConfigured()) {
    try {
      const { auth, currentUser } = await import("@clerk/nextjs/server");
      const { userId } = auth();
      if (userId) {
        let dbUser = await getUserByClerkId(userId);
        if (!dbUser) {
          const clerkUser = await currentUser();
          const email =
            clerkUser?.emailAddresses?.[0]?.emailAddress ||
            `${userId}@apexpulse.in`;
          const fullName =
            [clerkUser?.firstName, clerkUser?.lastName]
              .filter(Boolean)
              .join(" ") || "Apex Member";
          const metadataRole =
            (clerkUser?.publicMetadata?.role as UserRole | undefined) || "USER";

          dbUser = await syncUserFromClerk({
            clerkId: userId,
            email,
            name: fullName,
            role: metadataRole,
          });
        }
        return {
          isAuthenticated: true,
          clerkId: userId,
          user: dbUser,
          isDemoMode: false,
        };
      }
    } catch {
      // Fall through to demo session check if Clerk context is unavailable
    }
  }

  // Local Session Resolution
  const cookieStore = cookies();
  const demoSessionState = cookieStore.get(DEMO_SESSION_COOKIE)?.value;

  if (!demoSessionState || demoSessionState === "signed_out") {
    return {
      isAuthenticated: false,
      clerkId: null,
      user: null,
      isDemoMode: true,
    };
  }

  const demoRole =
    (cookieStore.get(DEMO_ROLE_COOKIE)?.value as UserRole | undefined) || "USER";
  const targetClerkId =
    demoSessionState !== "signed_in"
      ? demoSessionState
      : demoRole === "ADMIN"
      ? DEFAULT_DEMO_ADMIN_CLERK_ID
      : DEFAULT_DEMO_USER_CLERK_ID;

  let user = await getUserByClerkId(targetClerkId);
  if (!user) {
    if (demoSessionState !== "signed_in") {
      return {
        isAuthenticated: false,
        clerkId: null,
        user: null,
        isDemoMode: true,
      };
    }
    user = await syncUserFromClerk({
      clerkId: targetClerkId,
      email:
        demoRole === "ADMIN"
          ? "admin@apexpulse.in"
          : "aarav.mehta@apexpulse.in",
      name:
        demoRole === "ADMIN"
          ? "Club Admin"
          : "Aarav Mehta",
      role: demoRole,
    });
  }

  return {
    isAuthenticated: true,
    clerkId: user.clerkId,
    user,
    isDemoMode: true,
  };
}
