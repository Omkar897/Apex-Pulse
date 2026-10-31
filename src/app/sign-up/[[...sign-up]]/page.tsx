import React from "react";
import { SignUp } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/auth";
import { BrandedAuthPortal } from "@/components/auth/BrandedAuthPortal";

export default function SignUpPage() {
  const liveClerk = isClerkConfigured();

  return (
    <div className="py-6">
      {liveClerk && (
        <div className="mx-auto max-w-md mb-8 flex justify-center">
          <SignUp
            routing="path"
            path="/sign-up"
            fallbackRedirectUrl="/auth/redirect"
          />
        </div>
      )}
      <BrandedAuthPortal mode="sign-up" />
    </div>
  );
}
