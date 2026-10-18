import { inject, vi } from "vitest";

// Point the app's Prisma client at this run's fresh database (before it is first imported).
process.env.DATABASE_URL = inject("databaseUrl");

// Next.js request APIs, backed by a per-test fake request.
export const fakeRequest = {
  cookies: new Map<string, string>(),
  headers: new Headers({ "x-forwarded-for": "10.0.0.1" }),
};

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (fakeRequest.cookies.has(name) ? { name, value: fakeRequest.cookies.get(name) } : undefined),
    set: (name: string, value: string) => fakeRequest.cookies.set(name, value),
    delete: (name: string) => fakeRequest.cookies.delete(name),
  }),
  headers: async () => fakeRequest.headers,
}));
