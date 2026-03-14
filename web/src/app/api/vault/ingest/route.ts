import { NextResponse } from "next/server";
import { scanVault, type VaultNote } from "@/lib/vault/parser";
import {
  insertNewsEvent,
  getNewsEventByUrl,
  updateNewsEvent,
  upsertEntity,
  createConnection,
} from "@/lib/db/graph-queries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_VAULT_PATH = "/Users/yeojooncho/Documents/Obsidian Vault/";

/**
 * POST /api/vault/ingest
 * Scan Obsidian vault folders, upsert notes as newsEvents, pre-seed connection map entities.
 */
export async function POST() {
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH || DEFAULT_VAULT_PATH;

  let notes: VaultNote[];
  try {
    notes = await scanVault(vaultPath);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to scan vault: ${err}` },
      { status: 500 },
    );
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const connectionMaps: string[] = [];

  for (const note of notes) {
    // Build content: frontmatter tags + body
    const tags = Array.isArray(note.frontmatter.tags)
      ? (note.frontmatter.tags as string[]).join(", ")
      : "";
    const category = typeof note.frontmatter.category === "string" ? note.frontmatter.category : "";
    const content = [
      tags && `Tags: ${tags}`,
      category && `Category: ${category}`,
      note.body,
    ]
      .filter(Boolean)
      .join("\n\n");

    const publishedAt = note.frontmatter.date
      ? new Date(note.frontmatter.date as string)
      : note.mtime;

    // Check for existing event by URL
    const existing = await getNewsEventByUrl(note.url);

    if (existing) {
      // Compare mtime — if file is newer, update content and re-process
      if (note.mtime > (existing.ingestedAt ?? new Date(0))) {
        await updateNewsEvent(existing.id, {
          title: note.title,
          content,
          publishedAt,
        });
        updated++;
      } else {
        skipped++;
      }
      continue;
    }

    // Insert new
    await insertNewsEvent({
      title: note.title,
      url: note.url,
      source: "obsidian",
      content,
      publishedAt,
    });
    inserted++;

    // Connection map: pre-seed entity pairs
    if (note.connectionTopics) {
      const [topicA, topicB] = note.connectionTopics;
      try {
        const entityA = await upsertEntity({
          name: topicA,
          type: "concept",
          description: `Concept from Obsidian connection map: ${note.title}`,
        });
        const entityB = await upsertEntity({
          name: topicB,
          type: "concept",
          description: `Concept from Obsidian connection map: ${note.title}`,
        });
        await createConnection({
          fromType: "entity",
          fromId: entityA.id,
          toType: "entity",
          toId: entityB.id,
          relation: "ANALYZED_WITH",
          confidence: 0.9,
          reasoning: `Connection map: ${note.title}`,
        });
        connectionMaps.push(`${topicA} ↔ ${topicB}`);
      } catch {
        // Entity/connection creation failed — non-critical, continue
      }
    }
  }

  return NextResponse.json({
    scanned: notes.length,
    inserted,
    updated,
    skipped,
    connectionMaps,
  });
}
