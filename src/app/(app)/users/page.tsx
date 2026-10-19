import { Plus } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ListTable } from "@/components/list-table";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const ctx = await requirePage("users.view");
  const t = await getTranslations("ops.users");
  const users = await ctx.db.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true, isActive: true, lockedUntil: true },
  });
  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { company: ctx.company.name })}
        actions={
          ctx.can("users.manage") && (
            <Link href="/users/new" className={buttonVariants()}>
              <Plus /> {t("new")}
            </Link>
          )
        }
      />
      <ListTable
        id="users"
        searchPlaceholder={t("email")}
        emptyText={t("title")}
        columns={[
          { key: "name", header: t("name"), primary: true },
          { key: "email", header: t("email") },
          { key: "role", header: t("role"), kind: "badge" },
          { key: "active", header: t("active"), kind: "badge", tones: { Yes: "success", No: "danger" } },
          { key: "locked", header: t("lastLocked"), kind: "date", defaultHidden: true },
        ]}
        rows={users.map((u) => ({
          id: u.id,
          href: ctx.can("users.manage") && u.role !== "SUPER_ADMIN" ? `/users/${u.id}` : undefined,
          name: u.name,
          email: u.email,
          role: u.role,
          active: u.isActive ? "Yes" : "No",
          locked: u.lockedUntil && u.lockedUntil > new Date() ? u.lockedUntil.toISOString() : null,
        }))}
      />
    </>
  );
}
