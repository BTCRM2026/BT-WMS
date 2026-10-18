"use client";

// Last resort when the root layout itself fails (no providers available here).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
          background: "#f6f7f9",
          color: "#0f172a",
        }}
      >
        <div role="alert" style={{ textAlign: "center", padding: 24, maxWidth: 420 }}>
          <h1 style={{ fontSize: 22 }}>Something went wrong</h1>
          <p style={{ color: "#526075" }}>
            We couldn&apos;t load the app. Your data is safe. Please try again in a moment.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 12,
              padding: "10px 18px",
              borderRadius: 8,
              border: 0,
              background: "#1e40af",
              color: "#fff",
              fontSize: 15,
            }}
          >
            Try again
          </button>
          {error.digest && <p style={{ fontSize: 12, color: "#526075" }}>Reference: {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}
