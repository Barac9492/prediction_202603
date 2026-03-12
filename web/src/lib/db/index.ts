import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
    if (_db) return _db;
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL environment variable is not set");
    const sql = neon(url);
    _db = drizzle(sql, { schema });
    return _db;
}

export const db = new Proxy({} as ReturnType<typeof getDb>, {
    get(_target, prop) {
          const database = getDb();
          const value = database[prop as keyof typeof database];
          return typeof value === "function" ? value.bind(database) : value;
    },
});
