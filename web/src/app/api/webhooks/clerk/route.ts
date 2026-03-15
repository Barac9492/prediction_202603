import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { workspaces, workspaceMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    return new Response("Missing CLERK_WEBHOOK_SECRET", { status: 500 });
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  switch (evt.type) {
    case "organization.created": {
      const { id, name } = evt.data;
      await db.insert(workspaces).values({
        id,
        name: name ?? "Untitled Workspace",
      });
      break;
    }
    case "organizationMembership.created": {
      const { organization, public_user_data, role } = evt.data;
      await db.insert(workspaceMembers).values({
        workspaceId: organization.id,
        clerkUserId: public_user_data.user_id,
        role: role === "org:admin" ? "admin" : "analyst",
      });
      break;
    }
    case "organizationMembership.deleted": {
      const { organization, public_user_data } = evt.data;
      await db
        .delete(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, organization.id),
            eq(workspaceMembers.clerkUserId, public_user_data.user_id)
          )
        );
      break;
    }
  }

  return new Response("OK", { status: 200 });
}
