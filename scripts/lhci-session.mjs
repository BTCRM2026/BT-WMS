// CI only: create a session for the seeded owner so Lighthouse can audit signed-in pages.
// Prints the cookie value. Never run against production.
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV === "production" && !process.env.CI) throw new Error("CI only");
const prisma = new PrismaClient();
const user = await prisma.user.findUniqueOrThrow({ where: { email: "owner@btwarehouse.test" } });
const token = randomBytes(32).toString("base64url");
await prisma.session.create({
  data: {
    tokenHash: createHash("sha256").update(token).digest("hex"),
    userId: user.id,
    activeCompanyId: user.companyId,
    expiresAt: new Date(Date.now() + 3600_000),
  },
});
await prisma.$disconnect();
process.stdout.write(token);
