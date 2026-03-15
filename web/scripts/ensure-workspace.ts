import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/db/schema";
import { eq, sql } from "drizzle-orm";

const db = drizzle(neon(process.env.DATABASE_URL!), { schema });

async function ensure() {
  const existing = await db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, "test-workspace"));

  if (existing.length === 0) {
    await db.insert(schema.workspaces).values({
      id: "test-workspace",
      name: "Test Workspace",
      plan: "analyst",
      seatLimit: 3,
      thesisLimit: 25,
      pipelineRunsPerDay: 4,
    });
    console.log("Created test-workspace");
  } else {
    console.log("test-workspace already exists");
  }

  const tc = await db.select({ c: sql<number>`count(*)::int` }).from(schema.theses).where(eq(schema.theses.workspaceId, "test-workspace"));
  const cc = await db.select({ c: sql<number>`count(*)::int` }).from(schema.connections).where(eq(schema.connections.workspaceId, "test-workspace"));
  const bc = await db.select({ c: sql<number>`count(*)::int` }).from(schema.backtestRuns).where(eq(schema.backtestRuns.workspaceId, "test-workspace"));
  console.log(`Theses: ${tc[0].c}, Connections: ${cc[0].c}, BacktestRuns: ${bc[0].c}`);
}

ensure().catch(console.error);
