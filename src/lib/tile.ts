/**
 * Floor tile codes: <COMPANY CODE>-<ZONE>-<ROW>-<COLUMN>
 *   BT-A-03-1  -> company BT, zone A, row 3, column 1
 * Company code 2-4 chars, zone 1-2 letters, row exactly 2 digits, column 1-2 digits.
 * Mirrors the CHECK constraint locations_code_chk in the database.
 */
export const TILE_CODE_RE = /^([A-Z0-9]{2,4})-([A-Z]{1,2})-(\d{2})-(\d{1,2})$/;

export type TileParts = { company: string; zone: string; row: number; column: number };

export function parseTileCode(input: string): TileParts | null {
  const m = TILE_CODE_RE.exec(input.trim().toUpperCase());
  if (!m) return null;
  return { company: m[1], zone: m[2], row: Number(m[3]), column: Number(m[4]) };
}

export function formatTileCode(p: TileParts): string {
  return `${p.company}-${p.zone}-${String(p.row).padStart(2, "0")}-${p.column}`;
}

/** Valid format AND belongs to the given company code. */
export function isTileForCompany(code: string, companyCode: string): boolean {
  return parseTileCode(code)?.company === companyCode.toUpperCase();
}
