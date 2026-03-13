import { NextRequest, NextResponse } from "next/server";
import {
    createThesis,
    listTheses,
    getThesis,
    updateThesis,
} from "@/lib/db/graph-queries";

export const dynamic = "force-dynamic";

/** GET /api/theses - list all theses */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("active") === "true";
    const id = searchParams.get("id");

  if (id) {
        const thesis = await getThesis(parseInt(id));
        if (!thesis) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json(thesis);
  }

  const theses = await listTheses(activeOnly);
    return NextResponse.json(theses);
}

/** POST /api/theses - create a new thesis */
export async function POST(req: NextRequest) {
    const body = await req.json();
    const { title, description, direction, domain, tags } = body;

  const VALID_DIRECTIONS = ["bullish", "bearish", "neutral"];
  if (!title || typeof title !== "string" || !description || typeof description !== "string" || !direction) {
        return NextResponse.json(
          { error: "title, description, and direction are required and must be strings" },
          { status: 400 }
              );
  }
  if (!VALID_DIRECTIONS.includes(direction)) {
        return NextResponse.json(
          { error: `direction must be one of: ${VALID_DIRECTIONS.join(", ")}` },
          { status: 400 }
              );
  }

  const thesis = await createThesis({ title, description, direction, domain, tags });
    return NextResponse.json(thesis, { status: 201 });
}

/** PATCH /api/theses - update a thesis */
export async function PATCH(req: NextRequest) {
    const body = await req.json();
    const { id, ...updates } = body;

  if (!id) {
        return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const VALID_STATUSES = ["active", "pending_review", "archived"];
  if (updates.status && !VALID_STATUSES.includes(updates.status)) {
        return NextResponse.json(
          { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
          { status: 400 }
        );
  }

  // Keep isActive consistent with status
  if (updates.status === "active") {
    updates.isActive = true;
  } else if (updates.status === "archived") {
    updates.isActive = false;
  }

  const thesis = await updateThesis(parseInt(id), updates);
  if (!thesis) {
    return NextResponse.json({ error: "Thesis not found" }, { status: 404 });
  }
    return NextResponse.json(thesis);
}
