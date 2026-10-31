import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import {
  DEMO_ROLE_COOKIE,
  DEMO_SESSION_COOKIE,
  getCurrentSession,
} from "@/lib/auth";
import {
  DEFAULT_DEMO_ADMIN_CLERK_ID,
  DEFAULT_DEMO_USER_CLERK_ID,
} from "@/lib/seed";
import {
  authenticateUserAccount,
  registerUserAccount,
  resolveRoleRedirectPath,
  simulateSubscriptionExpiryWindow,
  syncUserFromClerk,
  updateUserRole,
} from "@/services/user.service";
import { UserRole } from "@/types/domain";

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const action = body.action as string;

    if (action === "REGISTER") {
      const role: UserRole = body.role === "ADMIN" ? "ADMIN" : "USER";
      const user = await registerUserAccount({
        name: String(body.name ?? ""),
        email: String(body.email ?? ""),
        password: String(body.password ?? ""),
        role,
      });

      const redirectTo = resolveRoleRedirectPath(user.role);
      const response = NextResponse.json({ user, redirectTo });
      response.cookies.set(DEMO_SESSION_COOKIE, user.clerkId, {
        path: "/",
        httpOnly: false,
      });
      response.cookies.set(DEMO_ROLE_COOKIE, user.role, {
        path: "/",
        httpOnly: false,
      });
      return response;
    }

    if (action === "SIGN_IN") {
      const expectedRole: UserRole | undefined =
        body.role === "ADMIN" || body.role === "USER" ? body.role : undefined;
      const user = await authenticateUserAccount({
        email: String(body.email ?? ""),
        password: String(body.password ?? ""),
        expectedRole,
      });

      const redirectTo = resolveRoleRedirectPath(user.role);
      const response = NextResponse.json({ user, redirectTo });
      response.cookies.set(DEMO_SESSION_COOKIE, user.clerkId, {
        path: "/",
        httpOnly: false,
      });
      response.cookies.set(DEMO_ROLE_COOKIE, user.role, {
        path: "/",
        httpOnly: false,
      });
      return response;
    }

    if (action === "SWITCH_ROLE") {
      const targetRole: UserRole = body.role === "ADMIN" ? "ADMIN" : "USER";
      const session = await getCurrentSession();

      let targetClerkId = session.clerkId;
      if (!targetClerkId) {
        targetClerkId =
          targetRole === "ADMIN"
            ? DEFAULT_DEMO_ADMIN_CLERK_ID
            : DEFAULT_DEMO_USER_CLERK_ID;
      }

      const updatedUser = await updateUserRole(targetClerkId, targetRole);
      const redirectTo = resolveRoleRedirectPath(targetRole);

      const response = NextResponse.json({
        user: updatedUser,
        redirectTo,
      });
      response.cookies.set(DEMO_SESSION_COOKIE, targetClerkId, {
        path: "/",
        httpOnly: false,
      });
      response.cookies.set(DEMO_ROLE_COOKIE, targetRole, {
        path: "/",
        httpOnly: false,
      });
      return response;
    }

    if (action === "DEMO_SIGN_IN") {
      const role: UserRole = body.role === "ADMIN" ? "ADMIN" : "USER";
      const customEmail = (body.email as string | undefined)?.trim();
      const customName = (body.name as string | undefined)?.trim();

      const clerkId =
        role === "ADMIN"
          ? DEFAULT_DEMO_ADMIN_CLERK_ID
          : DEFAULT_DEMO_USER_CLERK_ID;

      const user = await syncUserFromClerk({
        clerkId,
        email:
          customEmail ||
          (role === "ADMIN"
            ? "admin@apexpulse.in"
            : "aarav.mehta@apexpulse.in"),
        name:
          customName ||
          (role === "ADMIN"
            ? "Club Admin"
            : "Aarav Mehta"),
        role,
      });

      const redirectTo = resolveRoleRedirectPath(user.role);
      const response = NextResponse.json({ user, redirectTo });
      response.cookies.set(DEMO_SESSION_COOKIE, clerkId, {
        path: "/",
        httpOnly: false,
      });
      response.cookies.set(DEMO_ROLE_COOKIE, user.role, {
        path: "/",
        httpOnly: false,
      });
      return response;
    }

    if (action === "DEMO_SIGN_OUT") {
      const response = NextResponse.json({ signedOut: true, redirectTo: "/" });
      response.cookies.set(DEMO_SESSION_COOKIE, "signed_out", {
        path: "/",
        httpOnly: false,
      });
      return response;
    }

    if (action === "SIMULATE_EXPIRY") {
      const daysFromNow = Number(body.daysFromNow ?? 2);
      const session = await getCurrentSession();
      const clerkId = session.clerkId || DEFAULT_DEMO_USER_CLERK_ID;
      const updatedUser = await simulateSubscriptionExpiryWindow(
        clerkId,
        daysFromNow
      );
      return NextResponse.json({ user: updatedUser, daysFromNow });
    }

    return NextResponse.json(
      { error: "Unsupported evaluator action" },
      { status: 400 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Evaluator action failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
