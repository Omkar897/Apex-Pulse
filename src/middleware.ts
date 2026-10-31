import { NextRequest, NextResponse } from "next/server";

function hasLiveClerkKeys(): boolean {
  const pubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const secKey = process.env.CLERK_SECRET_KEY;
  if (!pubKey || !secKey) return false;
  if (pubKey.includes("xxxxxxxx") || secKey.includes("xxxxxxxx")) return false;
  return pubKey.startsWith("pk_") && secKey.startsWith("sk_");
}

export async function middleware(req: NextRequest) {
  if (hasLiveClerkKeys()) {
    const { clerkMiddleware, createRouteMatcher } = await import(
      "@clerk/nextjs/server"
    );
    const isProtectedRoute = createRouteMatcher([
      "/dashboard(.*)",
      "/billing(.*)",
      "/admin/dashboard(.*)",
    ]);

    return clerkMiddleware((auth, request) => {
      if (isProtectedRoute(request)) {
        auth().protect();
      }
    })(req, {} as never);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
