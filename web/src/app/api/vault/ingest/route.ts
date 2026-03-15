import { NextResponse } from "next/server";
import { ingestVault } from "@/lib/core/vault-ingest";
import { getWorkspaceId } from "@/lib/db/workspace";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/vault/ingest
 * Scan Obsidian vault folders, upsert notes as newsEvents, pre-seed connection map entities.
 */
export async function POST() {
  const workspaceId = await getWorkspaceId();

  try {
    const result = await ingestVault(workspaceId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to scan vault: ${err}` },
      { status: 500 },
    );
  }
}
