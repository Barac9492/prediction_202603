import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceId } from "@/lib/db/workspace";

export const dynamic = "force-dynamic";

const PADDLE_PRICE_MAP: Record<string, string | undefined> = {
  analyst: process.env.PADDLE_ANALYST_PRICE_ID,
  team: process.env.PADDLE_TEAM_PRICE_ID,
  fund: process.env.PADDLE_FUND_PRICE_ID,
};

/** GET /api/billing/checkout?plan=analyst — create Paddle checkout and redirect */
export async function GET(req: NextRequest) {
  const workspaceId = await getWorkspaceId();
  const plan = req.nextUrl.searchParams.get("plan");

  if (!plan || !PADDLE_PRICE_MAP[plan]) {
    return NextResponse.json(
      { error: "Invalid plan. Must be one of: analyst, team, fund" },
      { status: 400 }
    );
  }

  const priceId = PADDLE_PRICE_MAP[plan];
  if (!priceId) {
    return NextResponse.json(
      { error: "Price not configured for this plan" },
      { status: 500 }
    );
  }

  const PADDLE_API_KEY = process.env.PADDLE_API_KEY;
  const PADDLE_ENV = process.env.PADDLE_ENV ?? "sandbox";
  if (!PADDLE_API_KEY) {
    return NextResponse.json(
      { error: "Paddle not configured" },
      { status: 500 }
    );
  }

  const baseUrl =
    PADDLE_ENV === "production"
      ? "https://api.paddle.com"
      : "https://sandbox-api.paddle.com";

  const res = await fetch(`${baseUrl}/transactions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PADDLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [{ price_id: priceId, quantity: 1 }],
      custom_data: { workspace_id: workspaceId },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Paddle transaction creation failed:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 502 }
    );
  }

  const data = await res.json();
  const checkoutUrl = data.data?.checkout?.url;

  if (!checkoutUrl) {
    return NextResponse.json(
      { error: "No checkout URL returned" },
      { status: 502 }
    );
  }

  return NextResponse.redirect(checkoutUrl);
}
