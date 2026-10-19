import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";
import { UserForm } from "./user-form";

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePage("users.manage");
  const t = await getTranslations("ops.users");
  const u = id === "new" ? null : await ctx.db.user.findUnique({ where: { id } });
  if ((id !== "new" && !u) || u?.role === "SUPER_ADMIN") notFound();
  return (
    <>
      <PageHeader title={u ? u.name : t("new")} />
      <UserForm
        id={u?.id}
        initial={{
          name: u?.name ?? "",
          email: u?.email ?? "",
          role: (u?.role ?? "STORE_KEEPER") as "STORE_KEEPER",
          isActive: u?.isActive ?? true,
        }}
      />
    </>
  );
}
