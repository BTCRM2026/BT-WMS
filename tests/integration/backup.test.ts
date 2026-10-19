import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

// Backup / restore drill: dump the test database with the same flags as
// scripts/backup.sh, restore into an EMPTY database, compare stock totals.
// Needs pg_dump/pg_restore >= server version on PATH (CI installs postgresql-client-17).
const bin = (name: string) => (process.env.PG_BIN ? path.join(process.env.PG_BIN, name) : name);
const hasTools = spawnSync(bin("pg_dump"), ["--version"]).status === 0;

const totals = async (url: string) => {
  const db = new PrismaClient({ datasourceUrl: url });
  try {
    const rows = await db.$queryRaw<
      { company_id: string; units: bigint }[]
    >`select company_id, sum(quantity)::bigint as units from stock_balance group by company_id order by company_id`;
    const moves = await db.stockMovement.count();
    return { rows: rows.map((r) => [r.company_id, Number(r.units)]), moves };
  } finally {
    await db.$disconnect();
  }
};

describe.skipIf(!hasTools)("backup and restore drill", () => {
  it("restores into an empty database with identical stock totals", async () => {
    const source = process.env.DATABASE_URL!;
    const dump = path.join(mkdtempSync(path.join(tmpdir(), "wms-backup-")), "drill.dump");
    execFileSync(bin("pg_dump"), ["--format=custom", "--no-owner", "--no-acl", `--dbname=${source}`, `--file=${dump}`]);

    const target = new URL(source);
    const name = `wms_restore_${Date.now()}`;
    target.pathname = `/${name}`;
    const admin = new PrismaClient({ datasourceUrl: source });
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
    try {
      execFileSync(bin("pg_restore"), ["--no-owner", "--no-acl", "--exit-on-error", `--dbname=${target}`, dump]);
      const [before, after] = await Promise.all([totals(source), totals(target.toString())]);
      expect(after).toEqual(before);
      expect(before.moves).toBeGreaterThan(0);
      // The append-only guard survives the restore.
      const restored = new PrismaClient({ datasourceUrl: target.toString() });
      await expect(restored.$executeRawUnsafe("DELETE FROM stock_movements")).rejects.toThrow(/append-only/);
      await restored.$disconnect();
    } finally {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.$disconnect();
    }
  });
});
