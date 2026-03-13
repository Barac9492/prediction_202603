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
    const { title, description, direction, domain, tags, deadline, resolutionCriteria } = body;

  if (!title || !description || !direction) {
        return NextResponse.json(
          { error: "title, description, and direction are required" },
          { status: 400 }
              );
  }

  const thesis = await createThesis({
    title, description, direction, domain, tags,
    ...(deadline && { deadline: new Date(deadline) }),
    ...(resolutionCriteria && { resolutionCriteria }),
  });
    return NextResponse.json(thesis, { status: 201 });
}

/** PATCH /api/theses - update a thesis */
export async function PATCH(req: NextRequest) {
    const body = await req.json();
    const { id, ...updates } = body;

  if (!id) {
        return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const thesis = await updateThesis(parseInt(id), updates);
    return NextResponse.json(thesis);
}
