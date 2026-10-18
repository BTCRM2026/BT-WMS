// Lighthouse CI: Performance, Accessibility and Best Practices must each score >= 90.
// Signed-in pages get a session cookie from scripts/lhci-session.mjs (CI only).
const cookie = process.env.LHCI_SESSION ? { Cookie: `wms_session=${process.env.LHCI_SESSION}` } : undefined;
const base = "http://localhost:3000";

module.exports = {
  ci: {
    collect: {
      startServerCommand: "node scripts/start.mjs",
      startServerReadyPattern: "Ready in",
      url: cookie
        ? ["/dashboard", "/products", "/locations/map", "/stock", "/scan"].map((p) => base + p)
        : [`${base}/login`],
      numberOfRuns: 1,
      settings: { preset: "desktop", ...(cookie ? { extraHeaders: JSON.stringify(cookie) } : {}) },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
      },
    },
    upload: { target: "filesystem", outputDir: ".lighthouseci/reports" },
  },
};
