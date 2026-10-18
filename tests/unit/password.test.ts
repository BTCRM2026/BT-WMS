import { describe, expect, it } from "vitest";
import { hashPassword, validatePassword, verifyPassword } from "@/server/auth/password";

describe("password hashing", () => {
  it("hashes with bcrypt and a per-hash salt", async () => {
    const a = await hashPassword("Secret12345");
    const b = await hashPassword("Secret12345");
    expect(a).toMatch(/^\$2[aby]\$12\$/);
    expect(a).not.toBe(b);
    expect(a).not.toContain("Secret12345");
  });

  it("verifies the right password and rejects others", async () => {
    const h = await hashPassword("Secret12345");
    expect(await verifyPassword("Secret12345", h)).toBe(true);
    expect(await verifyPassword("secret12345", h)).toBe(false);
    expect(await verifyPassword("", h)).toBe(false);
  });
});

describe("password rules", () => {
  it.each([
    ["short1A", false],
    ["alllowercase123", false],
    ["ALLUPPERCASE123", false],
    ["NoDigitsHereAtAll", false],
    ["x".repeat(129) + "A1", false],
    ["GoodPassword1", true],
  ])("%s -> valid=%s", (pw, ok) => {
    expect(validatePassword(pw) === null).toBe(ok);
  });
});
