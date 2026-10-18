import { redirect } from "next/navigation";
import { getContext } from "@/server/auth/context";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getContext()) redirect("/dashboard");
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded border bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">BT Warehouse</h1>
        <p className="mb-6 text-sm text-gray-600">Sign in to your company account</p>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
