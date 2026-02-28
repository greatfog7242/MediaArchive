/**
 * Seed 3 test users — one per role.
 * Run: npx tsx prisma/seed.ts
 * Idempotent: upserts by email so re-runs are safe.
 */

import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

const TEST_PASSWORD = "password123";

const users = [
  { email: "admin@test.com", name: "Admin User", role: Role.ADMIN },
  { email: "editor@test.com", name: "Editor User", role: Role.EDITOR },
  { email: "viewer@test.com", name: "Viewer User", role: Role.VIEWER },
];

async function main() {
  const hash = await bcrypt.hash(TEST_PASSWORD, 12);

  for (const user of users) {
    await db.user.upsert({
      where: { email: user.email },
      update: {},
      create: { ...user, passwordHash: hash },
    });
    console.log(`Seeded: ${user.email} (${user.role})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
