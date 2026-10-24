/**
 * Clean start for a fresh, empty production database: role permissions, the
 * warehouse, the two companies and one owner login. No tiles, products or stock.
 * Run once after `prisma migrate deploy`:
 *   DATABASE_URL=... OWNER_EMAIL=... npx tsx prisma/clean-start.ts
 * A random password is printed once; change it after the first sign-in.
 */
import { randomBytes } from "node:crypto";
import { PrismaClient, type Role } from "@prisma/client";
import { hashPassword } from "../src/server/auth/password";
import { ROLE_PERMISSIONS } from "../src/server/auth/permissions";

const prisma = new PrismaClient();

const COMPANIES = [
  { name: "Bond Therapy", slug: "bond-therapy", code: "BT", brandColor: "#6d28d9" },
  { name: "Rich Fill", slug: "rich-fill", code: "RF", brandColor: "#0f766e" },
];

async function main() {
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail) throw new Error("Set OWNER_EMAIL");
  if ((await prisma.product.count()) + (await prisma.location.count()) > 0)
    throw new Error("Database is not empty; clean start is only for a fresh database");

  await prisma.rolePermission.deleteMany();
  await prisma.rolePermission.createMany({
    data: Object.entries(ROLE_PERMISSIONS).flatMap(([role, ps]) =>
      ps.map((permission) => ({ role: role as Role, permission })),
    ),
  });

  await prisma.warehouse.upsert({
    where: { code: "WH1" },
    update: {},
    create: { code: "WH1", name: "Main Warehouse", address: "5 rooms + lobby" },
  });

  for (const c of COMPANIES) await prisma.company.upsert({ where: { slug: c.slug }, update: {}, create: c });

  const home = await prisma.company.findUniqueOrThrow({ where: { slug: "bond-therapy" } });
  if (await prisma.user.findUnique({ where: { email: ownerEmail } })) {
    console.log(`Clean start done. ${ownerEmail} already exists; its password is unchanged.`);
    return;
  }
  const password = randomBytes(12).toString("base64url");
  await prisma.user.create({
    data: {
      companyId: home.id,
      email: ownerEmail,
      name: "Owner",
      role: "SUPER_ADMIN",
      passwordHash: await hashPassword(password),
    },
  });

  console.log(`Clean start done. Sign in as ${ownerEmail} with password: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
