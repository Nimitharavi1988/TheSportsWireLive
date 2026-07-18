/**
 * Run once to create your first admin login:
 *   npx tsx scripts/createAdmin.ts you@example.com yourpassword
 */
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";

async function main() {
  const [, , email, password] = process.argv;
  if (!email || !password) {
    console.error("Usage: npx tsx scripts/createAdmin.ts <email> <password>");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await db.adminUser.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  console.log(`Admin user ready: ${user.email}`);
  process.exit(0);
}

main();
