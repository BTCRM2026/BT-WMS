import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-4 text-center">
      <h1 className="text-2xl font-semibold" data-testid="forbidden">
        You don&apos;t have access to this page
      </h1>
      <p className="text-gray-600">Ask your administrator if you need it.</p>
      <Link href="/dashboard" className="text-blue-700">
        Back to dashboard
      </Link>
    </main>
  );
}
