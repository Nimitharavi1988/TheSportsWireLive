/**
 * Run once to create your first admin login:
 *   npx tsx scripts/createAdmin.ts you@example.com yourpassword
 */
import bcrypt from "bcryptjs";
import { db } from "../src/db";
import { adminUser } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

async function main() {
  const [, , email, password] = process.argv;
  if (!email || !password) {
    console.error("Usage: npx tsx scripts/createAdmin.ts <email> <password>");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [existing] = await db.select().from(adminUser).where(eq(adminUser.email, email)).limit(1);
  const [user] = existing
    ? await db.update(adminUser).set({ passwordHash }).where(eq(adminUser.id, existing.id)).returning()
    : await db.insert(adminUser).values({ id: createId(), email, passwordHash }).returning();

  console.log(`Admin user ready: ${user.email}`);
  process.exit(0);
}

main();
