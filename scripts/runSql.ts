// Runs a .sql file statement by statement against the database.
// Usage: npx tsx --env-file=.env scripts/runSql.ts scripts/sql/<file>.sql
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) throw new Error("usage: runSql.ts <file.sql>");
const sql = neon((process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL)!);
const statements = readFileSync(file, "utf8")
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  for (const statement of statements) {
    await sql.query(statement);
    console.log("ok:", statement.slice(0, 70).replace(/\s+/g, " "));
  }
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
