import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

/** Statements from a SQL file: `--` comments removed, split on `;` at line ends. */
export function splitStatements(source: string): string[] {
  return source
    .split("\n")
    .map((line) => line.replace(/--.*$/, "").trimEnd())
    .join("\n")
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main(): Promise<void> {
  const root = join(import.meta.dirname, "..");
  const envFile = join(root, ".env.local");
  if (!process.env.DATABASE_URL && existsSync(envFile)) process.loadEnvFile(envFile);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (export it or add it to .env.local)");

  const sql = neon(url);
  const statements = splitStatements(readFileSync(join(root, "db", "schema.sql"), "utf8"));
  for (const [i, statement] of statements.entries()) {
    await sql.query(statement);
    console.log(`[migrate] ${i + 1}/${statements.length} ${statement.split("\n")[0].slice(0, 80)}`);
  }
  console.log("[migrate] done");
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  main().catch((err: unknown) => {
    console.error("[migrate] failed:", err);
    process.exit(1);
  });
}
