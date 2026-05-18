import { neon } from "@neondatabase/serverless";
import { config } from "./config";

type Sql = ReturnType<typeof neon>;

let sql: Sql | null = null;

export function isDbConfigured() {
  return Boolean(config.DATABASE_URL);
}

export function getSql() {
  if (!config.DATABASE_URL) {
    throw new Error("Falta configurar DATABASE_URL para conectar con Neon.");
  }

  if (!sql) {
    sql = neon(config.DATABASE_URL);
  }

  return sql;
}
