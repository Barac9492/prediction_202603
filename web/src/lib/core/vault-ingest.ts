import { scanVault, type VaultNote } from "@/lib/vault/parser";
import {
  insertNewsEvent,
  getNewsEventByUrl,
  updateNewsEvent,
  upsertEntity,
  createConnection,
} from "@/lib/db/graph-queries";

const DEFAULT_VAULT_PATH = "/Users/yeojooncho/Documents/Obsidian Vault/";

/**
 * Scan Obsidian vault folders, upsert notes as newsEvents,
 * and pre-seed connection map entities.
 */
export async function ingestVault(
  workspaceId: string,
): Promise<{
  scanned: number;
  inserted: number;
  updated: number;
  skipped: number;
  connectionMaps: string[];
}> {
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH || DEFAULT_VAULT_PATH;

  const notes: VaultNote[] = await scanVault(vaultPath);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const connectionMaps: string[] = [];

  for (const note of notes) {
    // Build content: frontmatter tags + body
    const tags = Array.isArray(note.frontmatter.tags)
      ? (note.frontmatter.tags as string[]).join(", ")
      : "";
    const category =
      typeof note.frontmatter.category === "string"
        ? note.frontmatter.category
        : "";
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
    const existing = await getNewsEventByUrl(workspaceId, note.url);

    if (existing) {
      // Compare mtime — if file is newer, update content and re-process
      if (note.mtime > (existing.ingestedAt ?? new Date(0))) {
        await updateNewsEvent(workspaceId, existing.id, {
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
    await insertNewsEvent(workspaceId, {
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
        const entityA = await upsertEntity(workspaceId, {
          name: topicA,
          type: "concept",
          description: `Concept from Obsidian connection map: ${note.title}`,
        });
        const entityB = await upsertEntity(workspaceId, {
          name: topicB,
          type: "concept",
          description: `Concept from Obsidian connection map: ${note.title}`,
        });
        await createConnection(workspaceId, {
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

  return {
    scanned: notes.length,
    inserted,
    updated,
    skipped,
    connectionMaps,
  };
}
