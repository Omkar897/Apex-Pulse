import { Webhook } from "svix";
import { syncUserFromClerk } from "@/services/user.service";
import { IUserDTO, UserRole } from "@/types/domain";

export interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{ email_address: string }>;
    first_name?: string | null;
    last_name?: string | null;
    public_metadata?: {
      role?: string;
    };
  };
}

/**
 * Verifies Svix webhook headers when `webhookSecret` is provided.
 */
export function verifyClerkWebhookSignature(
  rawBody: string,
  headers: {
    "svix-id"?: string | null;
    "svix-timestamp"?: string | null;
    "svix-signature"?: string | null;
  },
  webhookSecret?: string
): ClerkWebhookEvent {
  if (
    webhookSecret &&
    !webhookSecret.includes("xxxxxxxx") &&
    webhookSecret.startsWith("whsec_")
  ) {
    const svixId = headers["svix-id"];
    const svixTimestamp = headers["svix-timestamp"];
    const svixSignature = headers["svix-signature"];

    if (!svixId || !svixTimestamp || !svixSignature) {
      throw new Error("Missing Svix webhook verification headers");
    }

    const wh = new Webhook(webhookSecret);
    return wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  }

  return JSON.parse(rawBody) as ClerkWebhookEvent;
}

/**
 * Processes a verified Clerk webhook event (`user.created`, `user.updated`, `session.created`)
 * and syncs the user metadata into MongoDB.
 */
export async function handleClerkWebhookEvent(
  event: ClerkWebhookEvent
): Promise<{ synced: boolean; user: IUserDTO | null; eventType: string }> {
  const supportedEvents = ["user.created", "user.updated", "session.created"];
  if (!supportedEvents.includes(event.type)) {
    return {
      synced: false,
      user: null,
      eventType: event.type,
    };
  }

  const clerkId = event.data?.id;
  if (!clerkId) {
    throw new Error("Webhook payload missing user id");
  }

  const primaryEmail =
    event.data.email_addresses?.[0]?.email_address ||
    `${clerkId}@apexpulse.in`;
  const fullName =
    [event.data.first_name, event.data.last_name].filter(Boolean).join(" ") ||
    "Apex Member";
  const rawRole = event.data.public_metadata?.role?.toUpperCase();
  const role: UserRole | undefined =
    rawRole === "ADMIN" ? "ADMIN" : rawRole === "USER" ? "USER" : undefined;

  const syncedUser = await syncUserFromClerk({
    clerkId,
    email: primaryEmail,
    name: fullName,
    role,
  });

  return {
    synced: true,
    user: syncedUser,
    eventType: event.type,
  };
}
