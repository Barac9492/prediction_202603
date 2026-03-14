import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

export interface VaultNote {
  /** Relative path from vault root, e.g. "투자·매크로/AI 버블 논쟁.md" */
  relativePath: string;
  /** Canonical URL for dedup: obsidian://투자·매크로/AI 버블 논쟁.md */
  url: string;
  title: string;
  body: string;
  frontmatter: Record<string, unknown>;
  wikilinks: string[];
  isConnectionMap: boolean;
  connectionTopics: [string, string] | null;
  mtime: Date;
}

const MAX_CONTENT_LENGTH = 8000;

/** Folders to ingest (relative to vault root) */
export const INGEST_FOLDERS = [
  "투자·매크로",
  "AI·테크",
  "시리즈",
  "Deal Flow",
];

// ————————————————————————————————————————————————————————————————
// Frontmatter parsing
// ————————————————————————————————————————————————————————————————

export function parseFrontmatter(raw: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: raw };

  const yamlBlock = match[1];
  const body = match[2];
  const frontmatter: Record<string, unknown> = {};

  let currentKey: string | null = null;
  let arrayValues: string[] | null = null;

  for (const line of yamlBlock.split("\n")) {
    // Array item (  - value)
    if (/^\s+-\s+/.test(line) && currentKey) {
      const val = line.replace(/^\s+-\s+/, "").trim();
      if (arrayValues) arrayValues.push(val);
      continue;
    }

    // Flush any pending array
    if (arrayValues && currentKey) {
      frontmatter[currentKey] = arrayValues;
      arrayValues = null;
      currentKey = null;
    }

    // Key: value line
    const kvMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
    if (!kvMatch) continue;

    const key = kvMatch[1];
    let value = kvMatch[2].trim();

    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Inline array: [a, b, c]
    if (value.startsWith("[") && value.endsWith("]")) {
      frontmatter[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      currentKey = null;
      continue;
    }

    // Empty value → might be a YAML array on following lines
    if (value === "") {
      currentKey = key;
      arrayValues = [];
      continue;
    }

    // Boolean
    if (value === "true") { frontmatter[key] = true; continue; }
    if (value === "false") { frontmatter[key] = false; continue; }

    frontmatter[key] = value;
    currentKey = null;
  }

  // Flush trailing array
  if (arrayValues && currentKey) {
    frontmatter[currentKey] = arrayValues;
  }

  return { frontmatter, body };
}

// ————————————————————————————————————————————————————————————————
// Wikilink parsing
// ————————————————————————————————————————————————————————————————

export function parseWikilinks(body: string): string[] {
  const matches = body.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g);
  const links = new Set<string>();
  for (const m of matches) links.add(m[1].trim());
  return [...links];
}

// ————————————————————————————————————————————————————————————————
// Connection map detection
// ————————————————————————————————————————————————————————————————

/**
 * Parse "Connections — Topic1 ↔ Topic2" from filename.
 * Returns the two topic names or null.
 */
export function parseConnectionMapTopics(filename: string): [string, string] | null {
  // Remove .md extension
  const name = filename.replace(/\.md$/, "");
  const match = name.match(/^Connections\s*[—–-]\s*(.+?)\s*↔\s*(.+)$/);
  if (!match) return null;
  return [match[1].trim(), match[2].trim()];
}

// ————————————————————————————————————————————————————————————————
// Vault scanner
// ————————————————————————————————————————————————————————————————

async function scanFolder(vaultRoot: string, folder: string): Promise<VaultNote[]> {
  const folderPath = join(vaultRoot, folder);
  const notes: VaultNote[] = [];

  let entries: string[];
  try {
    entries = await readAllMarkdownFiles(folderPath);
  } catch {
    // Folder doesn't exist — skip
    return [];
  }

  for (const filePath of entries) {
    const raw = await readFile(filePath, "utf-8");
    const fileStat = await stat(filePath);
    const relPath = relative(vaultRoot, filePath);
    const filename = filePath.split("/").pop() ?? "";

    const { frontmatter, body } = parseFrontmatter(raw);
    const wikilinks = parseWikilinks(body);
    const connectionTopics = parseConnectionMapTopics(filename);

    // Title: frontmatter title → first H1 → filename
    const title =
      (frontmatter.title as string) ??
      body.match(/^#\s+(.+)$/m)?.[1] ??
      filename.replace(/\.md$/, "");

    notes.push({
      relativePath: relPath,
      url: `obsidian://${relPath}`,
      title,
      body: body.slice(0, MAX_CONTENT_LENGTH),
      frontmatter,
      wikilinks,
      isConnectionMap: connectionTopics !== null || frontmatter.type === "connection-map",
      connectionTopics,
      mtime: fileStat.mtime,
    });
  }

  return notes;
}

/** Recursively find all .md files under a directory */
async function readAllMarkdownFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await readAllMarkdownFiles(fullPath)));
    } else if (entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results;
}

export async function scanVault(
  vaultRoot: string,
  folders: string[] = INGEST_FOLDERS,
): Promise<VaultNote[]> {
  const allNotes: VaultNote[] = [];
  for (const folder of folders) {
    const notes = await scanFolder(vaultRoot, folder);
    allNotes.push(...notes);
  }
  return allNotes;
}
