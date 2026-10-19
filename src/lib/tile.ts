/**
 * Floor tile codes: <ZONE>-<ROW>-<COLUMN>-<LEVEL>
 *   BT-A-03-1  -> zone BT (a Bond Therapy zone), row A, column 3, level 1
 * Zone 2-4 chars and must start with the company code (BT..., RF...).
 * Row 1-2 letters, column exactly 2 digits, level 1-2 digits.
 * Mirrors the CHECK constraint locations_code_chk in the database.
 */
export const TILE_CODE_RE = /^([A-Z0-9]{2,4})-([A-Z]{1,2})-(\d{2})-(\d{1,2})$/;

export type TileParts = { zone: string; row: string; column: number; level: number };

export function parseTileCode(input: string): TileParts | null {
  const m = TILE_CODE_RE.exec(input.trim().toUpperCase());
  if (!m) return null;
  return { zone: m[1], row: m[2], column: Number(m[3]), level: Number(m[4]) };
}

export function formatTileCode(p: TileParts): string {
  return `${p.zone}-${p.row}-${String(p.column).padStart(2, "0")}-${p.level}`;
}

/** Row letter(s) as a number for the grid: A=1 ... Z=26, AA=27. */
export const rowNumber = (row: string) => [...row.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
export const rowLetter = (n: number) => {
  let s = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/** Zones belong to a company when they start with its code (BT, BT2, BTX ... for Bond Therapy). */
export const zoneBelongsTo = (zone: string, companyCode: string) =>
  zone.toUpperCase().startsWith(companyCode.toUpperCase());

/** Valid format AND in one of the company's zones. */
export function isTileForCompany(code: string, companyCode: string): boolean {
  const p = parseTileCode(code);
  return !!p && zoneBelongsTo(p.zone, companyCode);
}

/** Expand "A-F" or "A,C,E" into row letters. */
export function expandRows(spec: string): string[] {
  const out: string[] = [];
  for (const part of spec
    .toUpperCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)) {
    const [a, b] = part.split("-").map((s) => s.trim());
    if (!/^[A-Z]{1,2}$/.test(a) || (b !== undefined && !/^[A-Z]{1,2}$/.test(b)))
      throw new Error(`Bad row range "${part}"`);
    for (let n = rowNumber(a); n <= rowNumber(b ?? a); n++) out.push(rowLetter(n));
  }
  return [...new Set(out)];
}
