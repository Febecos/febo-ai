import fs from "node:fs";
import path from "node:path";

export function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    const fullPath = path.join(process.cwd(), file);

    if (!fs.existsSync(fullPath)) {
      continue;
    }

    const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const index = trimmed.indexOf("=");

      if (index === -1) {
        continue;
      }

      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}
