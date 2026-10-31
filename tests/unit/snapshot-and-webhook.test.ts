import { describe, expect, it, afterEach } from "vitest";
import { Webhook } from "svix";
import {
  compareSnapshotWithLivePlan,
  createPlanSnapshot,
  hasPlanPricingChanged,
} from "@/lib/snapshot-service";
import { verifyClerkWebhookSignature } from "@/lib/webhook-processor";
import { isClerkConfigured } from "@/lib/auth";

describe("Snapshot Service (Deliverable #4)", () => {
  it("creates a deeply frozen PlanSnapshot from various ID representations", () => {
    const fixedDate = new Date("2026-10-31T10:00:00.000Z");

    const snapFromObjectId = createPlanSnapshot(
      {
        _id: { toString: () => "6723456789abcdef01234567" },
        name: "  Quarterly Transformation  ",
        durationMonths: 3,
        baseMonthlyPrice: 2499.456,
        discountPercentage: 15.129,
        version: 2,
      },
      fixedDate
    );

    expect(snapFromObjectId).toEqual({
      planId: "6723456789abcdef01234567",
      name: "Quarterly Transformation",
      durationMonths: 3,
      baseMonthlyPrice: 2499.46,
      discountPercentage: 15.13,
      version: 2,
      capturedAt: "2026-10-31T10:00:00.000Z",
    });
    expect(Object.isFrozen(snapFromObjectId)).toBe(true);

    const snapFromStringId = createPlanSnapshot({
      _id: "plan_str_1",
      name: "Monthly Sprint",
      durationMonths: 1,
      baseMonthlyPrice: 1999,
      discountPercentage: 0,
    });
    expect(snapFromStringId.planId).toBe("plan_str_1");
    expect(snapFromStringId.version).toBe(1);

    const snapFallback = createPlanSnapshot({
      name: "Fallback Plan",
      durationMonths: 6,
      baseMonthlyPrice: 2200,
      discountPercentage: 10,
    });
    expect(snapFallback.planId).toBe("unknown-plan");
  });

  it("detects when plan pricing fields change vs cosmetic updates", () => {
    const basePlan = {
      durationMonths: 3,
      baseMonthlyPrice: 2499,
      discountPercentage: 15,
    };

    expect(hasPlanPricingChanged(basePlan, {})).toBe(false);
    expect(
      hasPlanPricingChanged(basePlan, {
        durationMonths: 3,
        baseMonthlyPrice: 2499,
        discountPercentage: 15,
      })
    ).toBe(false);

    expect(
      hasPlanPricingChanged(basePlan, {
        baseMonthlyPrice: 2999,
      })
    ).toBe(true);
    expect(
      hasPlanPricingChanged(basePlan, {
        discountPercentage: 25,
      })
    ).toBe(true);
    expect(
      hasPlanPricingChanged(basePlan, {
        durationMonths: 6,
      })
    ).toBe(true);
  });

  it("compares frozen snapshot against live plan or archived plan", () => {
    const snapshot = createPlanSnapshot({
      planId: "plan_1",
      name: "Quarterly Transformation",
      durationMonths: 3,
      baseMonthlyPrice: 2000,
      discountPercentage: 10,
      version: 1,
    });

    // 1. Live plan matches snapshot
    const matchingReport = compareSnapshotWithLivePlan(snapshot, {
      durationMonths: 3,
      baseMonthlyPrice: 2000,
      discountPercentage: 10,
      version: 1,
    });
    expect(matchingReport.isDrifted).toBe(false);
    expect(matchingReport.summary).toContain("Matches current live catalog pricing");

    // 2. Live plan mutated by Admin to ₹3,500/mo v2
    const driftedReport = compareSnapshotWithLivePlan(snapshot, {
      durationMonths: 3,
      baseMonthlyPrice: 3500,
      discountPercentage: 15,
      version: 2,
    });
    expect(driftedReport.isDrifted).toBe(true);
    expect(driftedReport.snapshotBaseMonthlyPrice).toBe(2000);
    expect(driftedReport.liveBaseMonthlyPrice).toBe(3500);
    expect(driftedReport.summary).toContain("Historical rate preserved at v1");

    // 3. Live plan deleted/archived
    const deletedReport = compareSnapshotWithLivePlan(snapshot, null);
    expect(deletedReport.isDrifted).toBe(true);
    expect(deletedReport.liveVersion).toBeNull();
    expect(deletedReport.summary).toContain("Catalog plan was archived or deleted");
  });
});

describe("Webhook Signature Verification & Auth Config", () => {
  const originalPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const originalSecKey = process.env.CLERK_SECRET_KEY;

  afterEach(() => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = originalPubKey;
    process.env.CLERK_SECRET_KEY = originalSecKey;
  });

  it("parses JSON payload directly when webhookSecret is omitted or placeholder", () => {
    const rawPayload = JSON.stringify({
      type: "user.created",
      data: { id: "user_123", first_name: "Omkar" },
    });

    const parsed = verifyClerkWebhookSignature(rawPayload, {}, undefined);
    expect(parsed.type).toBe("user.created");
    expect(parsed.data.id).toBe("user_123");

    const parsedPlaceholder = verifyClerkWebhookSignature(
      rawPayload,
      {},
      "whsec_xxxxxxxxxxxxxxxxxxxxxxxx"
    );
    expect(parsedPlaceholder.data.id).toBe("user_123");
  });

  it("verifies Svix signatures when a real whsec_ secret is provided and rejects missing headers", () => {
    const secret = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
    const rawPayload = JSON.stringify({
      type: "user.created",
      data: { id: "user_svix_001" },
    });

    expect(() =>
      verifyClerkWebhookSignature(rawPayload, {}, secret)
    ).toThrow(/Missing Svix webhook verification headers/);

    const wh = new Webhook(secret);
    const msgId = "msg_2abc123";
    const timestamp = new Date();
    const signature = wh.sign(msgId, timestamp, rawPayload);

    const verified = verifyClerkWebhookSignature(
      rawPayload,
      {
        "svix-id": msgId,
        "svix-timestamp": Math.floor(timestamp.getTime() / 1000).toString(),
        "svix-signature": signature,
      },
      secret
    );
    expect(verified.data.id).toBe("user_svix_001");
  });

  it("accurately checks isClerkConfigured across missing, placeholder, and valid keys", () => {
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    delete process.env.CLERK_SECRET_KEY;
    expect(isClerkConfigured()).toBe(false);

    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_xxxxxxxxxxxxxxxx";
    process.env.CLERK_SECRET_KEY = "sk_test_xxxxxxxxxxxxxxxx";
    expect(isClerkConfigured()).toBe(false);

    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_validKey12345";
    process.env.CLERK_SECRET_KEY = "sk_test_validSecret12345";
    expect(isClerkConfigured()).toBe(true);
  });
});
