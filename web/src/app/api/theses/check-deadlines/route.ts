import { NextResponse } from "next/server";
import { getWorkspaceId } from "@/lib/db/workspace";
import { checkThesisDeadlines } from "@/lib/analysis/thesis-lifecycle";

export const dynamic = "force-dynamic";

export async function GET() {
  const workspaceId = await getWorkspaceId();
  const result = await checkThesisDeadlines(workspaceId);
  return NextResponse.json(result);
}
