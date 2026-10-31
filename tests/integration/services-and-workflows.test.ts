import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { connectToDatabase, disconnectDatabase } from "@/lib/db";
import {
  DEFAULT_DEMO_ADMIN_CLERK_ID,
  DEFAULT_DEMO_USER_CLERK_ID,
  ensureInitialSeedData,
} from "@/lib/seed";
import {
  createPlan,
  deletePlan,
  getPlanById,
  listPlans,
  updatePlan,
} from "@/services/plan.service";
import {
  createCoupon,
  deleteCoupon,
  getCouponByCode,
  listCoupons,
  updateCoupon,
  validateCouponForSubtotal,
} from "@/services/coupon.service";
import {
  authenticateUserAccount,
  getUserByClerkId,
  getUserById,
  registerUserAccount,
  resolveRoleRedirectPath,
  simulateSubscriptionExpiryWindow,
  syncUserFromClerk,
  updateUserRole,
} from "@/services/user.service";
import {
  listGlobalTransactions,
  listUserTransactions,
  overrideTransactionToCompleted,
  processCheckout,
  settlePartialTransactionByUser,
} from "@/services/subscription.service";
import { handleClerkWebhookEvent } from "@/lib/webhook-processor";
import { compareSnapshotWithLivePlan } from "@/lib/snapshot-service";
import { evaluateSubscriptionAlerts } from "@/lib/subscription-engine";
import { SubscriptionPlan } from "@/models/SubscriptionPlan";
import { Coupon } from "@/models/Coupon";
import { User } from "@/models/User";
import { Transaction } from "@/models/Transaction";

const mockCookieMap = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      const val = mockCookieMap.get(name);
      return val !== undefined ? { name, value: val } : undefined;
    },
  }),
}));

describe("Integration Suite: Database, Services, Checkout, Overrides & Snapshot Isolation", () => {
  beforeAll(async () => {
    await Promise.all([
      connectToDatabase({ skipSeed: true }),
      connectToDatabase({ skipSeed: true }),
      connectToDatabase({ skipSeed: true }),
    ]);
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    mockCookieMap.clear();
    await Promise.all([
      SubscriptionPlan.deleteMany({}),
      Coupon.deleteMany({}),
      User.deleteMany({}),
      Transaction.deleteMany({}),
    ]);
  });

  it("seeds initial INR plans, coupons, users, and transactions idempotently", async () => {
    await ensureInitialSeedData();

    const plans = await listPlans({ includeInactive: true });
    const coupons = await listCoupons({ onlyActive: false });
    const demoUser = await getUserByClerkId(DEFAULT_DEMO_USER_CLERK_ID);
    const demoAdmin = await getUserByClerkId(DEFAULT_DEMO_ADMIN_CLERK_ID);

    expect(plans.length).toBe(4);
    expect(coupons.length).toBe(4);
    expect(demoUser?.role).toBe("USER");
    expect(demoUser?.subscription.status).toBe("ACTIVE");
    expect(demoAdmin?.role).toBe("ADMIN");

    // Calling ensureInitialSeedData a second time should be a no-op
    await ensureInitialSeedData();
    const plansAfterSecondCall = await listPlans({ includeInactive: true });
    expect(plansAfterSecondCall.length).toBe(4);
  });

  it("supports full Plan CRUD and increments version only when financial terms change", async () => {
    const created = await createPlan({
      name: "Pro Strength 6M",
      description: "6-month progressive overload coaching",
      durationMonths: 6,
      baseMonthlyPrice: 2000,
      discountPercentage: 10,
      allowPartialPayment: true,
      minPartialPercentage: 50,
      features: ["Strength Floor", "Recovery Sauna"],
      isPopular: true,
      isActive: true,
    });

    expect(created.version).toBe(1);
    expect(created.baseMonthlyPrice).toBe(2000);

    // Cosmetic update (description & features) -> version remains 1
    const cosmeticUpdate = await updatePlan(created._id, {
      description: "Updated description without changing price",
      isPopular: false,
    });
    expect(cosmeticUpdate.version).toBe(1);
    expect(cosmeticUpdate.isPopular).toBe(false);

    // Financial update (baseMonthlyPrice 2000 -> 3500) -> version increments to 2
    const priceUpdate = await updatePlan(created._id, {
      baseMonthlyPrice: 3500,
    });
    expect(priceUpdate.version).toBe(2);
    expect(priceUpdate.baseMonthlyPrice).toBe(3500);

    const fetched = await getPlanById(created._id);
    expect(fetched?.version).toBe(2);
    expect(await getPlanById("invalid-id")).toBeNull();

    // Error guards on update/delete
    await expect(updatePlan("invalid-id", { name: "Bad" })).rejects.toThrow(
      /Invalid Plan ID/
    );
    const fakeObjectId = new mongoose.Types.ObjectId().toString();
    await expect(updatePlan(fakeObjectId, { name: "Ghost" })).rejects.toThrow(
      /not found/
    );

    const delResult = await deletePlan(created._id);
    expect(delResult.deleted).toBe(true);
    await expect(deletePlan("invalid-id")).rejects.toThrow(/Invalid Plan ID/);
    await expect(deletePlan(created._id)).rejects.toThrow(/not found/);
  });

  it("supports full Coupon CRUD, duplicate prevention, and subtotal validation", async () => {
    const futureDate = new Date(Date.now() + 30 * 86400000).toISOString();

    const flatCoupon = await createCoupon({
      code: "  save1000 ",
      description: "Flat ₹1,000 off",
      discountType: "FLAT",
      discountValue: 1000,
      minPurchaseAmount: 3000,
      maxDiscountAmount: null,
      expiryDate: futureDate,
      usageLimit: 50,
      isActive: true,
    });

    expect(flatCoupon.code).toBe("SAVE1000");

    // Duplicate code rejection
    await expect(
      createCoupon({
        code: "save1000",
        description: "Duplicate",
        discountType: "FLAT",
        discountValue: 500,
        minPurchaseAmount: 0,
        maxDiscountAmount: null,
        expiryDate: futureDate,
        usageLimit: 10,
        isActive: true,
      })
    ).rejects.toThrow(/already exists/);

    const secondCoupon = await createCoupon({
      code: "VIP25",
      description: "25% off up to ₹2,000",
      discountType: "PERCENTAGE",
      discountValue: 25,
      minPurchaseAmount: 4000,
      maxDiscountAmount: 2000,
      expiryDate: futureDate,
      usageLimit: 25,
      isActive: true,
    });

    const activeCoupons = await listCoupons({ onlyActive: true });
    expect(activeCoupons.length).toBe(2);
    expect(await getCouponByCode("   ")).toBeNull();

    // Validate coupon against subtotal
    const validEval = await validateCouponForSubtotal("vip25", 10000);
    expect(validEval.valid).toBe(true);
    expect(validEval.discountAmount).toBe(2000); // capped at 2000
    expect(validEval.coupon).not.toBeNull();
    expect(validEval.coupon?.code).toBe("VIP25");

    const invalidEval = await validateCouponForSubtotal("NONEXISTENT", 10000);
    expect(invalidEval.valid).toBe(false);
    expect(invalidEval.coupon).toBeNull();

    // Update coupon (including YYYY-MM-DD date string parsing)
    const updatedCoupon = await updateCoupon(secondCoupon._id, {
      discountValue: 30,
      maxDiscountAmount: 3000,
      expiryDate: "2027-12-31",
    });
    expect(updatedCoupon.discountValue).toBe(30);
    expect(updatedCoupon.maxDiscountAmount).toBe(3000);

    // Updating code to an existing coupon's code should throw
    await expect(
      updateCoupon(secondCoupon._id, { code: "SAVE1000" })
    ).rejects.toThrow(/already exists/);

    await expect(updateCoupon("bad-id", { isActive: false })).rejects.toThrow(
      /Invalid Coupon ID/
    );
    const missingId = new mongoose.Types.ObjectId().toString();
    await expect(updateCoupon(missingId, { isActive: false })).rejects.toThrow(
      /Coupon not found/
    );

    const deleted = await deleteCoupon(flatCoupon._id);
    expect(deleted.deleted).toBe(true);
    await expect(deleteCoupon("bad-id")).rejects.toThrow(/Invalid Coupon ID/);
    await expect(deleteCoupon(flatCoupon._id)).rejects.toThrow(
      /Coupon not found/
    );
  });

  it("handles Clerk webhook events idempotently and manages user roles & expiry simulation", async () => {
    // 1. Unsupported event
    const ignored = await handleClerkWebhookEvent({
      type: "organization.created",
      data: { id: "org_1" },
    });
    expect(ignored.synced).toBe(false);

    // 2. Missing id throws
    await expect(
      handleClerkWebhookEvent({
        type: "user.created",
        data: { id: "" },
      })
    ).rejects.toThrow(/missing user id/);

    // 3. user.created event
    const createdRes = await handleClerkWebhookEvent({
      type: "user.created",
      data: {
        id: "clerk_webhook_user_1",
        email_addresses: [{ email_address: "Webhook.User@ApexPulse.in" }],
        first_name: "Rohit",
        last_name: "Kulkarni",
        public_metadata: { role: "USER" },
      },
    });
    expect(createdRes.synced).toBe(true);
    expect(createdRes.user?.email).toBe("webhook.user@apexpulse.in");
    expect(createdRes.user?.role).toBe("USER");

    // 4. Idempotent user.updated event updates name/role without creating duplicate
    const updatedRes = await handleClerkWebhookEvent({
      type: "user.updated",
      data: {
        id: "clerk_webhook_user_1",
        email_addresses: [{ email_address: "rohit.admin@apexpulse.in" }],
        first_name: "Rohit",
        last_name: "Admin",
        public_metadata: { role: "ADMIN" },
      },
    });
    expect(updatedRes.user?._id).toBe(createdRes.user?._id);
    expect(updatedRes.user?.role).toBe("ADMIN");

    // Role redirect resolution
    expect(resolveRoleRedirectPath("ADMIN")).toBe("/admin/dashboard");
    expect(resolveRoleRedirectPath("USER")).toBe("/dashboard");

    // User lookup and role switching
    const fetchedById = await getUserById(createdRes.user!._id);
    expect(fetchedById?.clerkId).toBe("clerk_webhook_user_1");
    expect(await getUserById("invalid-id")).toBeNull();

    const switchedToUser = await updateUserRole("clerk_webhook_user_1", "USER");
    expect(switchedToUser.role).toBe("USER");

    await expect(
      updateUserRole("nonexistent_clerk", "ADMIN")
    ).rejects.toThrow(/User not found/);

    await expect(
      syncUserFromClerk({ clerkId: "   ", email: "a@b.com", name: "No ID" })
    ).rejects.toThrow(/clerkId is required/);

    // Simulate expiry when user has no active subscription -> throws
    await expect(
      simulateSubscriptionExpiryWindow("clerk_webhook_user_1", 2)
    ).rejects.toThrow(/does not have an active subscription/);
  });

  it("executes Full & Partial Checkouts, isolates Historical Plan Snapshots (Deliverable #4), and supports Admin Override & User Settlement", async () => {
    const now = new Date("2026-10-31T10:00:00.000Z");
    const futureExpiry = new Date("2026-12-31T23:59:59.000Z").toISOString();

    const user = await syncUserFromClerk({
      clerkId: "user_checkout_test",
      email: "member@apexpulse.in",
      name: "Siddharth Rao",
      role: "USER",
    });

    const planV1 = await createPlan({
      name: "Quarterly Athlete Plan",
      description: "90-day strength & conditioning",
      durationMonths: 3,
      baseMonthlyPrice: 2000,
      discountPercentage: 10, // ₹6,000 gross -> ₹600 off -> ₹5,400 subtotal
      allowPartialPayment: true,
      minPartialPercentage: 50,
      features: ["Coaching", "Sauna"],
      isPopular: true,
      isActive: true,
    });

    const coupon = await createCoupon({
      code: "FLAT400",
      description: "Flat ₹400 off",
      discountType: "FLAT",
      discountValue: 400,
      minPurchaseAmount: 3000,
      maxDiscountAmount: null,
      expiryDate: futureExpiry,
      usageLimit: 10,
      isActive: true,
    });

    // 1. Checkout with PARTIAL payment (50% upfront on ₹5,400 - ₹400 = ₹5,000 -> ₹2,500 paid, ₹2,500 remaining)
    const partialCheckout = await processCheckout({
      clerkId: user.clerkId,
      planId: planV1._id,
      paymentMode: "PARTIAL",
      upfrontPercentage: 50,
      couponCode: "flat400",
      now,
    });

    expect(partialCheckout.transaction.totalAmount).toBe(5000);
    expect(partialCheckout.transaction.amountPaid).toBe(2500);
    expect(partialCheckout.transaction.remainingBalance).toBe(2500);
    expect(partialCheckout.transaction.paymentStatus).toBe("PARTIAL");
    expect(partialCheckout.transaction.planSnapshot.baseMonthlyPrice).toBe(2000);
    expect(partialCheckout.transaction.planSnapshot.version).toBe(1);
    expect(partialCheckout.user.subscription.balanceDue).toBe(2500);
    expect(partialCheckout.user.subscription.status).toBe("ACTIVE");

    // Verify coupon usedCount incremented
    const updatedCoupon = await getCouponByCode("FLAT400");
    expect(updatedCoupon?.usedCount).toBe(1);

    // 2. Deliverable #4 Verification: Admin mutates Plan A price from ₹2,000/mo -> ₹3,500/mo and discount 10% -> 20%
    const planV2 = await updatePlan(planV1._id, {
      baseMonthlyPrice: 3500,
      discountPercentage: 20,
    });
    expect(planV2.version).toBe(2);

    // Existing transaction's embedded snapshot must remain untouched at ₹2,000/mo (v1)
    const userTxnsAfterPriceChange = await listUserTransactions(user.clerkId);
    expect(userTxnsAfterPriceChange[0].planSnapshot.baseMonthlyPrice).toBe(2000);
    expect(userTxnsAfterPriceChange[0].planSnapshot.discountPercentage).toBe(10);
    expect(userTxnsAfterPriceChange[0].planSnapshot.version).toBe(1);

    const driftReport = compareSnapshotWithLivePlan(
      userTxnsAfterPriceChange[0].planSnapshot,
      planV2
    );
    expect(driftReport.isDrifted).toBe(true);
    expect(driftReport.snapshotVersion).toBe(1);
    expect(driftReport.liveVersion).toBe(2);

    // 3. Test 3-Day Expiry Simulation on the active user subscription
    const simulated2Days = await simulateSubscriptionExpiryWindow(
      user.clerkId,
      2,
      now
    );
    const alertState = evaluateSubscriptionAlerts(
      simulated2Days.subscription,
      now
    );
    expect(alertState.isExpiringWithin3Days).toBe(true);
    expect(alertState.daysRemaining).toBe(2);

    // 4. Admin overrides the PARTIAL transaction to COMPLETED
    const overrideResult = await overrideTransactionToCompleted({
      transactionId: partialCheckout.transaction._id,
      adminIdentifier: "admin@apexpulse.in",
      note: "Verified NEFT bank transfer receipt",
      now,
    });

    expect(overrideResult.transaction.paymentStatus).toBe("COMPLETED");
    expect(overrideResult.transaction.amountPaid).toBe(5000);
    expect(overrideResult.transaction.remainingBalance).toBe(0);
    expect(overrideResult.transaction.overrideAudit?.overriddenBy).toBe(
      "admin@apexpulse.in"
    );
    expect(overrideResult.transaction.overrideAudit?.previousRemainingBalance).toBe(
      2500
    );
    expect(overrideResult.user?.subscription.balanceDue).toBe(0);

    // Idempotency guard: overriding an already COMPLETED transaction must throw
    await expect(
      overrideTransactionToCompleted({
        transactionId: partialCheckout.transaction._id,
        adminIdentifier: "admin@apexpulse.in",
      })
    ).rejects.toThrow(/already marked as COMPLETED/);

    // 5. Second checkout on v2 plan with PARTIAL payment, then settled directly by User
    const secondCheckout = await processCheckout({
      clerkId: user.clerkId,
      planId: planV2._id,
      paymentMode: "PARTIAL",
      upfrontPercentage: 60,
      now,
    });
    // v2: 3 * 3500 = 10500 gross, 20% discount = 2100 -> 8400 total. 60% upfront = 5040 paid, 3360 remaining
    expect(secondCheckout.transaction.totalAmount).toBe(8400);
    expect(secondCheckout.transaction.amountPaid).toBe(5040);
    expect(secondCheckout.transaction.remainingBalance).toBe(3360);
    expect(secondCheckout.transaction.planSnapshot.version).toBe(2);
    expect(secondCheckout.user.subscription.balanceDue).toBe(3360);

    // Unauthorized user cannot settle someone else's transaction
    const otherUser = await syncUserFromClerk({
      clerkId: "user_other_99",
      email: "other@apexpulse.in",
      name: "Other User",
    });
    await expect(
      settlePartialTransactionByUser({
        transactionId: secondCheckout.transaction._id,
        clerkId: otherUser.clerkId,
      })
    ).rejects.toThrow(/Unauthorized/);

    // Authorized user settles remaining balance
    const settledResult = await settlePartialTransactionByUser({
      transactionId: secondCheckout.transaction._id,
      clerkId: user.clerkId,
    });
    expect(settledResult.transaction.paymentStatus).toBe("COMPLETED");
    expect(settledResult.transaction.remainingBalance).toBe(0);
    expect(settledResult.user.subscription.balanceDue).toBe(0);

    // Settling again throws already settled
    await expect(
      settlePartialTransactionByUser({
        transactionId: secondCheckout.transaction._id,
        clerkId: user.clerkId,
      })
    ).rejects.toThrow(/already settled/);

    // Global transaction ledger & metrics check
    const globalAll = await listGlobalTransactions();
    expect(globalAll.metrics.totalTransactions).toBe(2);
    expect(globalAll.metrics.completedCount).toBe(2);
    expect(globalAll.metrics.partialCount).toBe(0);
    expect(globalAll.metrics.totalRevenueCollected).toBe(5000 + 8400);

    const globalFiltered = await listGlobalTransactions({
      status: "COMPLETED",
    });
    expect(globalFiltered.transactions.length).toBe(2);
  });

  it("validates error paths on checkout and session resolution", async () => {
    const plan = await createPlan({
      name: "Monthly Basic",
      description: "1 month",
      durationMonths: 1,
      baseMonthlyPrice: 1999,
      discountPercentage: 0,
      allowPartialPayment: false,
      minPartialPercentage: 50,
      features: ["Gym Access"],
      isPopular: false,
      isActive: false, // inactive plan
    });

    const user = await syncUserFromClerk({
      clerkId: "user_err_paths",
      email: "err@apexpulse.in",
      name: "Error Tester",
    });

    // Non-existent user
    await expect(
      processCheckout({
        clerkId: "ghost_user",
        planId: plan._id,
        paymentMode: "FULL",
      })
    ).rejects.toThrow(/Authenticated user record not found/);

    // Invalid planId format
    await expect(
      processCheckout({
        clerkId: user.clerkId,
        planId: "not-an-object-id",
        paymentMode: "FULL",
      })
    ).rejects.toThrow(/Invalid subscription plan ID/);

    // Inactive plan rejection
    await expect(
      processCheckout({
        clerkId: user.clerkId,
        planId: plan._id,
        paymentMode: "FULL",
      })
    ).rejects.toThrow(/not available/);

    // Activate plan and test invalid coupon rejection
    await updatePlan(plan._id, { isActive: true });
    const activePlansOnly = await listPlans();
    expect(activePlansOnly.length).toBe(1);
    const allCouponsList = await listCoupons();
    expect(Array.isArray(allCouponsList)).toBe(true);

    await expect(
      processCheckout({
        clerkId: user.clerkId,
        planId: plan._id,
        paymentMode: "FULL",
        couponCode: "NONEXISTENT_PROMO",
      })
    ).rejects.toThrow(/Coupon not found/);

    // Test additional guard branches in subscription & user services
    const missingObjId = new mongoose.Types.ObjectId().toString();
    await expect(
      overrideTransactionToCompleted({
        transactionId: "invalid-tx-id",
        adminIdentifier: "admin",
      })
    ).rejects.toThrow(/Invalid Transaction ID/);

    await expect(
      overrideTransactionToCompleted({
        transactionId: missingObjId,
        adminIdentifier: "admin",
      })
    ).rejects.toThrow(/Transaction not found/);

    await expect(
      settlePartialTransactionByUser({
        transactionId: "invalid-tx-id",
        clerkId: user.clerkId,
      })
    ).rejects.toThrow(/Invalid Transaction ID/);

    await expect(
      settlePartialTransactionByUser({
        transactionId: missingObjId,
        clerkId: "nonexistent_clerk_id",
      })
    ).rejects.toThrow(/User not found/);

    await expect(
      settlePartialTransactionByUser({
        transactionId: missingObjId,
        clerkId: user.clerkId,
      })
    ).rejects.toThrow(/Transaction not found/);

    expect(await listUserTransactions("nonexistent_clerk_id")).toEqual([]);

    await expect(
      simulateSubscriptionExpiryWindow("nonexistent_clerk_id", 2)
    ).rejects.toThrow(/User not found/);

    // Complete a checkout and simulate expired (-2 days)
    await processCheckout({
      clerkId: user.clerkId,
      planId: plan._id,
      paymentMode: "FULL",
    });
    const expiredSim = await simulateSubscriptionExpiryWindow(user.clerkId, -2);
    expect(expiredSim.subscription.status).toBe("EXPIRED");

    // Test getCurrentSession in demo mode via mocked cookies
    const {
      getCurrentSession,
      DEMO_ROLE_COOKIE,
      DEMO_SESSION_COOKIE,
    } = await import("@/lib/auth");

    // Default state with no cookies -> not auto-logged in
    const defaultUnauthenticatedSession = await getCurrentSession();
    expect(defaultUnauthenticatedSession.isAuthenticated).toBe(false);

    mockCookieMap.set(DEMO_SESSION_COOKIE, "signed_out");
    const signedOutSession = await getCurrentSession();
    expect(signedOutSession.isAuthenticated).toBe(false);

    mockCookieMap.set(DEMO_SESSION_COOKIE, "nonexistent_session_clerk_id");
    const staleCookieSession = await getCurrentSession();
    expect(staleCookieSession.isAuthenticated).toBe(false);

    mockCookieMap.set(DEMO_SESSION_COOKIE, "signed_in");
    mockCookieMap.set(DEMO_ROLE_COOKIE, "ADMIN");
    const adminSession = await getCurrentSession();
    expect(adminSession.isAuthenticated).toBe(true);
    expect(adminSession.user?.role).toBe("ADMIN");

    mockCookieMap.set(DEMO_ROLE_COOKIE, "USER");
    const userSession = await getCurrentSession();
    expect(userSession.isAuthenticated).toBe(true);
    expect(userSession.user?.role).toBe("USER");

    mockCookieMap.set(DEMO_SESSION_COOKIE, user.clerkId);
    const customClerkSession = await getCurrentSession();
    expect(customClerkSession.clerkId).toBe(user.clerkId);

    // Test user credential sign-up and sign-in workflows
    const registeredMember = await registerUserAccount({
      name: "Karan Malhotra",
      email: "karan@example.com",
      password: "securePassword123",
      role: "USER",
    });
    expect(registeredMember.email).toBe("karan@example.com");
    expect(registeredMember.role).toBe("USER");

    const signedInMember = await authenticateUserAccount({
      email: "KARAN@example.com",
      password: "securePassword123",
    });
    expect(signedInMember._id).toBe(registeredMember._id);

    // Duplicate sign-up and invalid credential edge cases
    await expect(
      registerUserAccount({
        name: "Karan Duplicate",
        email: "karan@example.com",
        password: "securePassword123",
      })
    ).rejects.toThrow(/already exists/);

    await expect(
      registerUserAccount({
        name: "A",
        email: "short@example.com",
        password: "securePassword123",
      })
    ).rejects.toThrow(/at least 2 characters/);

    await expect(
      registerUserAccount({
        name: "Valid Name",
        email: "invalid-email",
        password: "securePassword123",
      })
    ).rejects.toThrow(/valid email/);

    await expect(
      registerUserAccount({
        name: "Valid Name",
        email: "valid@example.com",
        password: "123",
      })
    ).rejects.toThrow(/at least 6 characters/);

    await expect(
      authenticateUserAccount({
        email: "",
        password: "",
      })
    ).rejects.toThrow(/required/);

    await expect(
      authenticateUserAccount({
        email: "unknown@example.com",
        password: "securePassword123",
      })
    ).rejects.toThrow(/No account found/);

    await expect(
      registerUserAccount({
        name: "Valid Name",
        email: "missing-tld@localhost",
        password: "securePassword123",
      })
    ).rejects.toThrow(/valid email/);

    await expect(
      authenticateUserAccount({
        email: "missing-tld@localhost",
        password: "securePassword123",
      })
    ).rejects.toThrow(/valid email/);

    await expect(
      authenticateUserAccount({
        email: "karan@example.com",
        password: "wrongPassword",
      })
    ).rejects.toThrow(/Invalid email or password/);

    // Member trying to sign in via Club Admin Sign In (expectedRole: "ADMIN")
    await expect(
      authenticateUserAccount({
        email: "karan@example.com",
        password: "securePassword123",
        expectedRole: "ADMIN",
      })
    ).rejects.toThrow(/does not have Club Admin privileges/);

    // Register an Admin account and verify Admin Sign In & Member Sign In separation
    const registeredAdmin = await registerUserAccount({
      name: "Vikram Admin",
      email: "vikram.admin@example.com",
      password: "adminPassword123",
      role: "ADMIN",
    });
    expect(registeredAdmin.role).toBe("ADMIN");

    const signedInAdmin = await authenticateUserAccount({
      email: "vikram.admin@example.com",
      password: "adminPassword123",
      expectedRole: "ADMIN",
    });
    expect(signedInAdmin.role).toBe("ADMIN");

    await expect(
      authenticateUserAccount({
        email: "vikram.admin@example.com",
        password: "adminPassword123",
        expectedRole: "USER",
      })
    ).rejects.toThrow(/Club Admin Sign In/);
  });

  it("queues upgrades and downgrades into upcomingSubscription when an active membership exists and promotes automatically after expiry", async () => {
    const now = new Date("2026-10-31T10:00:00.000Z");

    const quarterlyPlan = await createPlan({
      name: "Quarterly Plan",
      description: "3 months",
      durationMonths: 3,
      baseMonthlyPrice: 2499,
      discountPercentage: 15,
      allowPartialPayment: true,
      minPartialPercentage: 50,
      features: ["Strength Floor"],
      isPopular: true,
      isActive: true,
    });

    const monthlyLowerPlan = await createPlan({
      name: "Monthly Sprint",
      description: "1 month",
      durationMonths: 1,
      baseMonthlyPrice: 2499,
      discountPercentage: 0,
      allowPartialPayment: false,
      minPartialPercentage: 50,
      features: ["Strength Floor"],
      isPopular: false,
      isActive: true,
    });

    const member = await syncUserFromClerk({
      clerkId: "user_queue_upgrade_downgrade",
      email: "queue.member@apexpulse.in",
      name: "Neha Sharma",
      role: "USER",
    });

    // 1. Initial partial checkout on Quarterly Plan
    const initialCheckout = await processCheckout({
      clerkId: member.clerkId,
      planId: quarterlyPlan._id,
      paymentMode: "PARTIAL",
      upfrontPercentage: 50,
      now,
      enforceActivePlanQueueRules: true,
    });
    expect(initialCheckout.user.subscription.status).toBe("ACTIVE");
    expect(initialCheckout.user.subscription.balanceDue).toBeGreaterThan(0);

    // 2. Attempting to switch to a lower or higher plan while balanceDue > 0 must throw
    await expect(
      processCheckout({
        clerkId: member.clerkId,
        planId: monthlyLowerPlan._id,
        paymentMode: "FULL",
        now,
        enforceActivePlanQueueRules: true,
      })
    ).rejects.toThrow(/remaining balance in Billing/);

    // 3. Settle remaining balance on current plan
    await settlePartialTransactionByUser({
      transactionId: initialCheckout.transaction._id,
      clerkId: member.clerkId,
      now,
    });

    // 4. Attempting to queue next plan with PARTIAL payment must throw
    await expect(
      processCheckout({
        clerkId: member.clerkId,
        planId: quarterlyPlan._id,
        paymentMode: "PARTIAL",
        upfrontPercentage: 50,
        now,
        enforceActivePlanQueueRules: true,
      })
    ).rejects.toThrow(/Full payment is required/);

    // 5. Queue a lower membership (Monthly Sprint) with FULL payment -> scheduled after current plan ends
    const queuedDowngrade = await processCheckout({
      clerkId: member.clerkId,
      planId: monthlyLowerPlan._id,
      paymentMode: "FULL",
      now,
      enforceActivePlanQueueRules: true,
    });

    // Current plan remains Quarterly Plan
    expect(queuedDowngrade.user.subscription.planId).toBe(quarterlyPlan._id);
    // Upcoming plan is Monthly Sprint starting right when Quarterly Plan ends
    expect(queuedDowngrade.user.subscription.upcomingSubscription).not.toBeNull();
    expect(queuedDowngrade.user.subscription.upcomingSubscription?.planId).toBe(
      monthlyLowerPlan._id
    );
    expect(
      queuedDowngrade.user.subscription.upcomingSubscription?.startDate
    ).toBe(initialCheckout.user.subscription.endDate);

    // 6. Simulate current subscription expiring (-1 day) and verify automatic promotion of upcomingSubscription
    await User.updateOne(
      { clerkId: member.clerkId },
      { $set: { "subscription.endDate": new Date(Date.now() - 86400000) } }
    );

    const promotedUser = await getUserByClerkId(member.clerkId);
    expect(promotedUser?.subscription.planId).toBe(monthlyLowerPlan._id);
    expect(promotedUser?.subscription.status).toBe("ACTIVE");
    expect(promotedUser?.subscription.upcomingSubscription).toBeNull();
  });
});
