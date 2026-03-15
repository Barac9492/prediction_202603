import { NextRequest, NextResponse } from "next/server";
import { updateWorkspacePlan } from "@/lib/billing";

// Paddle webhook handler
// Verifies webhook signature and processes subscription events
export async function POST(req: NextRequest) {
  const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET;
  if (!PADDLE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Missing PADDLE_WEBHOOK_SECRET" },
      { status: 500 }
    );
  }

  // TODO: Verify Paddle webhook signature using PADDLE_WEBHOOK_SECRET
  // For now, check a shared secret header
  const body = await req.json();
  const eventType = body.event_type;
  const data = body.data;

  try {
    switch (eventType) {
      case "subscription.activated":
      case "subscription.updated": {
        const workspaceId = data.custom_data?.workspace_id;
        if (!workspaceId) break;

        // Map Paddle price to plan
        const plan = mapPaddlePriceToPlan(data.items?.[0]?.price?.id);
        await updateWorkspacePlan(workspaceId, {
          plan,
          paddleSubscriptionId: data.id,
          paddleCustomerId: data.customer_id,
        });
        break;
      }
      case "subscription.canceled":
      case "subscription.past_due": {
        const workspaceId = data.custom_data?.workspace_id;
        if (!workspaceId) break;

        await updateWorkspacePlan(workspaceId, {
          plan: "expired",
          paddleSubscriptionId: data.id,
          paddleCustomerId: data.customer_id,
        });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Paddle webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

function mapPaddlePriceToPlan(priceId: string | undefined): string {
  // Map your Paddle price IDs to plan names
  // Configure these in environment variables
  const mapping: Record<string, string> = {
    [process.env.PADDLE_ANALYST_PRICE_ID ?? ""]: "analyst",
    [process.env.PADDLE_TEAM_PRICE_ID ?? ""]: "team",
    [process.env.PADDLE_FUND_PRICE_ID ?? ""]: "fund",
  };
  return mapping[priceId ?? ""] ?? "analyst";
}
