import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { resolveRoleRedirectPath } from "@/services/user.service";

export const dynamic = "force-dynamic";

/**
 * Role Redirection Hub:
 * Routes ADMIN users to `/admin/dashboard` and USER accounts to `/dashboard`.
 */
export default async function AuthRedirectPage() {
  const session = await getCurrentSession();

  if (!session.isAuthenticated || !session.user) {
    redirect("/sign-in");
  }

  const destination = resolveRoleRedirectPath(session.user.role);
  redirect(destination);
}
