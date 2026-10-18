import bcrypt from "bcryptjs";

const COST = 12;

export const PASSWORD_RULES = { minLength: 10 };

/** Returns an error message, or null when the password is acceptable. */
export function validatePassword(pw: string): string | null {
  if (pw.length < PASSWORD_RULES.minLength) return `Use at least ${PASSWORD_RULES.minLength} characters.`;
  if (pw.length > 128) return "Use at most 128 characters.";
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw)) {
    return "Use upper-case, lower-case letters and a number.";
  }
  return null;
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, COST);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

// Compared against when the email is unknown, so timing does not reveal which emails exist.
let dummy: Promise<string> | undefined;
export const dummyHash = () => (dummy ??= hashPassword("not-a-real-password"));
