import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getConfig } from "@/lib/config";
import * as schema from "@/lib/db/schema";

type Database = PostgresJsDatabase<typeof schema>;

let database: Database | null = null;
let client: ReturnType<typeof postgres> | null = null;

export function getDatabase(): Database {
  const config = getConfig();
  if (!config.databaseUrl) throw new Error("DATABASE_URL is required when VECTOR_STORE=pgvector.");
  if (!database || !client) {
    client = postgres(config.databaseUrl, { max: 5 });
    database = drizzle(client, { schema });
  }
  return database;
}

export function getSql(): ReturnType<typeof postgres> {
  getDatabase();
  if (!client) throw new Error("Postgres client failed to start.");
  return client;
}
