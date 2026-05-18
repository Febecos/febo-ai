import fs from "node:fs/promises";
import pg from "pg";
import { loadLocalEnv } from "./load-env.mjs";

loadLocalEnv();

if (!process.env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL en .env.local o en el entorno.");
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("sslmode=require") ? undefined : { rejectUnauthorized: false }
});

await client.connect();

try {
  const schema = await fs.readFile("neon/schema.sql", "utf8");
  await client.query(schema);
  console.log("Schema aplicado en Neon.");
} finally {
  await client.end();
}
