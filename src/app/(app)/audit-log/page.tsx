import { getTranslations } from "next-intl/server";
import { ListTable } from "@/components/list-table";
import { PageHeader } from "@/components/ui/primitives";
import { requirePage } from "@/server/auth/context";

export const metadata = { title: "Audit log" };

/** Who did what, when, from where (latest 2000 entries; full history via Reports > User activity or export). */
export default async function AuditLogPage() {
  const ctx = await requirePage("auditlog.view");
  const t = await getTranslations("auditlog");
  const logs = await ctx.db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 2000,
    include: { user: { select: { name: true } } },
  });
  const actions = [...new Set(logs.map((l) => l.action))].sort();
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ListTable
        id="audit-log"
        searchPlaceholder={t("search")}
        emptyText={t("empty")}
        columns={[
          { key: "when", header: t("when") },
          { key: "user", header: t("user"), primary: true },
          { key: "action", header: t("action"), kind: "badge" },
          { key: "entity", header: t("entity") },
          { key: "ip", header: "IP", kind: "mono" },
          { key: "details", header: t("details"), defaultHidden: true },
        ]}
        filters={[{ key: "action", label: t("action"), options: actions.map((a) => ({ value: a, label: a })) }]}
        rows={logs.map((l) => ({
          id: l.id,
          when: l.createdAt.toISOString().slice(0, 19).replace("T", " "),
          user: l.user?.name ?? "—",
          action: l.action,
          entity: `${l.entity}${l.entityId ? ` ${l.entityId.slice(-8)}` : ""}`,
          ip: l.ip,
          details: l.after ? JSON.stringify(l.after).slice(0, 200) : "",
        }))}
      />
    </>
  );
}
