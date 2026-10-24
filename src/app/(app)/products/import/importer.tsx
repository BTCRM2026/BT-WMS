"use client";

import { Download, FileCheck2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { FormError, useSubmit } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Badge, Card, Field } from "@/components/ui/primitives";
import { importProductsAction } from "../actions";

type Report =
  Awaited<ReturnType<typeof importProductsAction>> extends { ok: true; data: infer D } | { ok: false } ? D : never;

export function Importer({ columns }: { columns: string[] }) {
  const t = useTranslations("ops.import");
  const file = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState<Report | null>(null);
  const { run, pending, error } = useSubmit();

  const send = (commit: boolean) => {
    const f = file.current?.files?.[0];
    if (!f) return;
    const form = new FormData();
    form.set("file", f);
    form.set("commit", commit ? "1" : "0");
    run((fd: FormData) => importProductsAction(fd), form as never, {
      success: commit ? (d) => t("done", { count: (d as Report).summary.valid }) : undefined,
      then: (d) => setReport(d as Report),
    });
  };

  const template = () => {
    const csv =
      columns.join(",") +
      "\r\nBT-0100,Example Argan Shampoo 250 ml,PCS,12,8901000000100,24,600,8,yes,BT-A-01-1,450,250\r\n";
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      download: "products-template.csv",
    });
    a.click();
  };

  return (
    <div className="grid max-w-4xl gap-4">
      <Card className="grid gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="font-medium">{t("columns")}:</span>
          {columns.map((c) => (
            <code key={c} className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">
              {c}
              {(c === "sku" || c === "name") && ` (${t("required")})`}
            </code>
          ))}
        </div>
        <Field label={t("file")} htmlFor="file">
          <input
            ref={file}
            id="file"
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={() => setReport(null)}
            className="block w-full max-w-full min-w-0 text-sm file:mr-3 file:h-10 file:rounded-md file:border-0 file:bg-primary-soft file:px-4 file:text-primary"
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => send(false)} loading={pending}>
            <FileCheck2 /> {t("preview")}
          </Button>
          {report && !report.committed && report.summary.invalid === 0 && (
            <Button variant="secondary" onClick={() => send(true)} loading={pending}>
              <Upload /> {t("commit", { count: report.summary.valid })}
            </Button>
          )}
          <Button variant="ghost" onClick={template}>
            <Download /> {t("template")}
          </Button>
        </div>
        <FormError error={error} />
      </Card>

      {report && (
        <Card className="overflow-hidden" data-testid="import-report">
          <div className="border-b border-line p-4 text-sm">
            <p className="font-medium">{t("summary", { ...report.summary, ignoredColumns: "" })}</p>
            {report.summary.ignoredColumns.length > 0 && (
              <p className="text-muted">{t("ignored", { cols: report.summary.ignoredColumns.join(", ") })}</p>
            )}
          </div>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="sticky top-0 bg-surface-2 text-left text-muted">
                  <th className="px-4 py-2 font-medium">{t("row")}</th>
                  <th className="px-4 py-2 font-medium">SKU</th>
                  <th className="px-4 py-2 font-medium">{t("action")}</th>
                  <th className="px-4 py-2 font-medium">{t("problems")}</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.row} className="border-t border-line align-top">
                    <td className="px-4 py-2 tabular">{r.row}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.sku || "—"}</td>
                    <td className="px-4 py-2">
                      <Badge tone={r.action === "create" ? "info" : "neutral"}>{r.action}</Badge>
                    </td>
                    <td className="px-4 py-2">
                      {r.errors.length ? (
                        <ul className="list-disc pl-4 text-danger">
                          {r.errors.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      ) : (
                        <Badge tone="success">{t("ok")}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
