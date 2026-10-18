/**
 * Seed: 2 companies, 1 warehouse, zones/tiles, products, batches, opening
 * stock, and one user per role in each company (+ the owner SUPER_ADMIN).
 * Safe to re-run: master data is upserted; stock is only posted once.
 */
import { PrismaClient, type LocationType, type Role } from "@prisma/client";
import { hashPassword } from "../src/server/auth/password";
import { ROLE_PERMISSIONS } from "../src/server/auth/permissions";
import { formatTileCode } from "../src/lib/tile";

const prisma = new PrismaClient();
const PASSWORD = process.env.SEED_PASSWORD ?? "ChangeMe!2026";

const COMPANIES = [
  {
    name: "Bond Therapy",
    slug: "bond-therapy",
    code: "BT",
    brandColor: "#6d28d9",
    domain: "bondtherapy.test",
    productCount: 35,
  },
  {
    name: "Rich Fill",
    slug: "rich-fill",
    code: "RF",
    brandColor: "#0f766e",
    domain: "richfill.test",
    productCount: 50,
  },
];

const LINES = [
  "Shampoo",
  "Conditioner",
  "Hair Mask",
  "Hair Serum",
  "Keratin Treatment",
  "Hair Spa Cream",
  "Hair Oil",
  "Scalp Tonic",
  "Hair Colour",
  "Developer",
];
const VARIANTS = ["Argan", "Keratin", "Protein", "Moisture", "Repair", "Smooth", "Volume", "Colour Protect"];
const SIZES = [
  { label: "250 ml", pack: 12, mrp: 450 },
  { label: "500 ml", pack: 6, mrp: 799 },
  { label: "1 L", pack: 4, mrp: 1399 },
];
const ROLES: Exclude<Role, "SUPER_ADMIN">[] = ["ADMIN", "WAREHOUSE_MANAGER", "STORE_KEEPER", "BILLING", "VIEWER"];

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

async function main() {
  const passwordHash = await hashPassword(PASSWORD);

  await prisma.rolePermission.deleteMany();
  await prisma.rolePermission.createMany({
    data: Object.entries(ROLE_PERMISSIONS).flatMap(([role, ps]) =>
      ps.map((permission) => ({ role: role as Role, permission })),
    ),
  });

  const warehouse = await prisma.warehouse.upsert({
    where: { code: "WH1" },
    update: {},
    create: { code: "WH1", name: "Main Warehouse", address: "Floor-tile storage, no racks" },
  });

  for (const c of COMPANIES) {
    const company = await prisma.company.upsert({
      where: { slug: c.slug },
      update: { name: c.name, brandColor: c.brandColor },
      create: { name: c.name, slug: c.slug, code: c.code, brandColor: c.brandColor },
    });
    const scope = { companyId: company.id, warehouseId: warehouse.id };

    // Users: one per role.
    for (const role of ROLES) {
      const email = `${role.toLowerCase().replace("_", "")}@${c.domain}`;
      await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          companyId: company.id,
          email,
          name: `${c.name} ${role.replace("_", " ").toLowerCase()}`,
          role,
          passwordHash,
        },
      });
    }

    // Tiles: storage zones A and B (4 rows x 5 columns), plus one tile per special area.
    const tiles: { zone: string; row: number; column: number; type: LocationType; capacity: number }[] = [];
    for (const zone of ["A", "B"])
      for (let row = 1; row <= 4; row++)
        for (let column = 1; column <= 5; column++) tiles.push({ zone, row, column, type: "STORAGE", capacity: 200 });
    const special: [string, LocationType][] = [
      ["R", "RECEIVING"],
      ["D", "DISPATCH"],
      ["X", "DAMAGED"],
      ["Q", "QUARANTINE"],
      ["RT", "RETURN"],
    ];
    for (const [zone, type] of special) tiles.push({ zone, row: 1, column: 1, type, capacity: 1000 });

    const locations: Awaited<ReturnType<typeof prisma.location.upsert>>[] = [];
    for (const t of tiles) {
      const code = formatTileCode({ company: c.code, zone: t.zone, row: t.row, column: t.column });
      locations.push(
        await prisma.location.upsert({
          where: { warehouseId_code: { warehouseId: warehouse.id, code } },
          update: {},
          create: {
            ...scope,
            code,
            zone: t.zone,
            row: t.row,
            column: t.column,
            level: 0,
            type: t.type,
            capacity: t.capacity,
          },
        }),
      );
    }
    const storage = locations.filter((l) => l.type === "STORAGE");

    // Products.
    const products: Awaited<ReturnType<typeof prisma.product.upsert>>[] = [];
    for (let i = 0; i < c.productCount; i++) {
      const line = LINES[i % LINES.length];
      const variant = VARIANTS[Math.floor(i / LINES.length) % VARIANTS.length];
      const size = SIZES[i % SIZES.length];
      const sku = `${c.code}-${String(i + 1).padStart(4, "0")}`;
      products.push(
        await prisma.product.upsert({
          where: { companyId_sku: { companyId: company.id, sku } },
          update: {},
          create: {
            ...scope,
            sku,
            name: `${c.name} ${variant} ${line} ${size.label}`,
            unit: "PCS",
            packSize: size.pack,
            barcode: `890${c.code === "BT" ? "1" : "2"}${String(i + 1).padStart(9, "0")}`,
            minStock: 24,
            maxStock: 600,
            expiryTracked: true,
            defaultLocationId: storage[i % storage.length].id,
            mrp: size.mrp,
            purchasePrice: Math.round(size.mrp * 0.55),
          },
        }),
      );
    }

    // Opening stock, posted once: inward over the last 30 days, some outward.
    if ((await prisma.stockMovement.count({ where: { companyId: company.id } })) > 0) continue;
    const owner = await prisma.user.findFirstOrThrow({ where: { companyId: company.id, role: "WAREHOUSE_MANAGER" } });
    await prisma.$transaction(
      async (tx) => {
        for (const [i, p] of products.entries()) {
          const mfg = daysAgo(120 + i * 3);
          const batch = await tx.batch.upsert({
            where: {
              companyId_productId_batchNo: {
                companyId: company.id,
                productId: p.id,
                batchNo: `B${String(i + 1).padStart(3, "0")}`,
              },
            },
            update: {},
            create: {
              ...scope,
              productId: p.id,
              batchNo: `B${String(i + 1).padStart(3, "0")}`,
              mfgDate: mfg,
              expiryDate: addDays(mfg, 200 + (i % 9) * 60),
            },
          });
          const inwardQty = i % 7 === 0 ? 20 : 60 + (i % 5) * 30; // a few low-stock items
          const base = {
            ...scope,
            productId: p.id,
            batchId: batch.id,
            locationId: p.defaultLocationId!,
            userId: owner.id,
          };
          await tx.stockMovement.create({
            data: {
              ...base,
              type: "INWARD",
              direction: 1,
              quantity: inwardQty,
              referenceType: "SEED",
              reason: "Opening stock",
              createdAt: daysAgo(30 - (i % 30)),
            },
          });
          if (i % 3 === 0) {
            await tx.stockMovement.create({
              data: {
                ...base,
                type: "OUTWARD",
                direction: -1,
                quantity: Math.floor(inwardQty / 4),
                referenceType: "SEED",
                reason: "Sample sale",
                createdAt: daysAgo(10 - (i % 10)),
              },
            });
          }
        }
      },
      { timeout: 120_000 },
    );
  }

  // The owner: SUPER_ADMIN, home company Bond Therapy, can switch to any company.
  const home = await prisma.company.findUniqueOrThrow({ where: { slug: "bond-therapy" } });
  await prisma.user.upsert({
    where: { email: "owner@btwarehouse.test" },
    update: {},
    create: { companyId: home.id, email: "owner@btwarehouse.test", name: "Owner", role: "SUPER_ADMIN", passwordHash },
  });

  console.log("Seed complete. Users (password from SEED_PASSWORD):");
  for (const u of await prisma.user.findMany({ orderBy: { email: "asc" }, select: { email: true, role: true } })) {
    console.log(`  ${u.role.padEnd(18)} ${u.email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
