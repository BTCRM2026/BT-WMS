import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      ".local-db/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // The unscoped Prisma client is only for src/server (auth, audit, tenant layer).
    // Pages, components and API routes must go through getContext().db.
    files: ["src/app/**", "src/components/**", "src/lib/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message: "Use getContext().db (tenant-scoped). Type imports: `import type`.",
              allowTypeImports: true,
            },
          ],
          patterns: [
            { group: ["@/server/db/client", "**/server/db/client"], message: "Use getContext().db (tenant-scoped)." },
          ],
        },
      ],
    },
  },
  {
    // Raw SQL bypasses the tenant filter; allowed only inside the db layer.
    files: ["src/**"],
    ignores: ["src/server/db/**", "src/app/api/health/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[property.name=/^\\$(queryRaw|executeRaw|queryRawUnsafe|executeRawUnsafe)$/]",
          message: "Raw SQL bypasses tenant isolation. Add a function in src/server/db instead.",
        },
      ],
    },
  },
];

export default config;
