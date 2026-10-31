import React from "react";
import { SignIn } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/auth";
import { BrandedAuthPortal } from "@/components/auth/BrandedAuthPortal";

export default function SignInPage() {
  const liveClerk = isClerkConfigured();

  return (
    <div className="py-6">
      {liveClerk && (
        <div className="mx-auto max-w-md mb-8 flex justify-center">
          <SignIn
            routing="path"
            path="/sign-in"
            fallbackRedirectUrl="/auth/redirect"
          />
        </div>
      )}
      <BrandedAuthPortal mode="sign-in" />
    </div>
  );
}
