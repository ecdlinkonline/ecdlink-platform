import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { archiveUserFromClerk, upsertUserFromClerk } from "@/lib/repositories/users";
import { prisma } from "@/lib/db/prisma";
import { enforceRateLimit } from "@/lib/api/security";
import { requestIp } from "@/lib/security/request-identity";

type ClerkWebhookPayload = {
  type: string;
  data: {
    id: string;
    user_id?: string;
    email_address?: string;
    email_addresses?: Array<{ email_address: string; id: string }>;
    primary_email_address_id?: string;
    first_name?: string;
    last_name?: string;
    phone_numbers?: Array<{ phone_number: string; id: string }>;
    primary_phone_number_id?: string;
    public_metadata?: { role?: string };
    unsafe_metadata?: { role?: string };
    organization?: { id?: string; slug?: string };
  };
};

function mapRole(role: unknown) {
  if (role === "super_admin") return "SUPER_ADMIN";
  if (role === "ecdlink_staff") return "ECDLINK_STAFF";
  if (role === "supplier") return "SUPPLIER";
  if (role === "donor") return "DONOR";
  if (role === "funding_partner") return "FUNDING_ORGANISATION";
  if (role === "system") return "SYSTEM";
  return "ECD_CENTRE";
}

function emailFromPayload(data: ClerkWebhookPayload["data"]) {
  return data.email_addresses?.find((item) => item.id === data.primary_email_address_id)?.email_address ?? data.email_address ?? data.email_addresses?.[0]?.email_address;
}

function phoneFromPayload(data: ClerkWebhookPayload["data"]) {
  return data.phone_numbers?.find((item) => item.id === data.primary_phone_number_id)?.phone_number ?? data.phone_numbers?.[0]?.phone_number;
}

async function verifyPayload(request: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) throw new Error("CLERK_WEBHOOK_SECRET is not configured.");

  const payload = await request.text();
  const headers = {
    "svix-id": request.headers.get("svix-id") ?? "",
    "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
    "svix-signature": request.headers.get("svix-signature") ?? ""
  };

  return new Webhook(secret).verify(payload, headers) as ClerkWebhookPayload;
}

export async function POST(request: Request) {
  const rateError = await enforceRateLimit("clerk_webhook", requestIp(request));
  if (rateError) return rateError;
  let payload: ClerkWebhookPayload;

  try {
    payload = await verifyPayload(request);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid webhook signature." }, { status: 400 });
  }

  if (["user.created", "user.updated", "email.updated"].includes(payload.type)) {
    const role = mapRole(payload.data.public_metadata?.role ?? payload.data.unsafe_metadata?.role);
    const user = await upsertUserFromClerk({
      clerkUserId: payload.data.user_id ?? payload.data.id,
      email: emailFromPayload(payload.data),
      firstName: payload.data.first_name,
      lastName: payload.data.last_name,
      phone: phoneFromPayload(payload.data),
      role
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: `clerk.${payload.type}`,
        entityType: "User",
        entityId: user.id,
        metadata: { clerkUserId: user.clerkUserId }
      }
    });

    return NextResponse.json({ ok: true });
  }

  if (payload.type === "user.deleted") {
    const user = await archiveUserFromClerk(payload.data.id);
    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "clerk.user.deleted",
        entityType: "User",
        entityId: user.id,
        metadata: { clerkUserId: payload.data.id }
      }
    });
    return NextResponse.json({ ok: true });
  }

  if (payload.type.startsWith("organizationMembership.")) {
    await prisma.auditLog.create({
      data: {
        action: `clerk.${payload.type}`,
        entityType: "OrganizationMembership",
        entityId: payload.data.id,
        metadata: payload.data
      }
    });
    return NextResponse.json({ ok: true, futureReady: true });
  }

  return NextResponse.json({ ok: true, ignored: true });
}
