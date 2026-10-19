"use client";

import { ClipboardList, PackageCheck, Truck, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormError, useDraft, useSubmit, type ProductOption } from "@/components/forms";
import { QtyLines, type QtyLine } from "@/components/line-items";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, Field, Input } from "@/components/ui/primitives";
import {
  cancelDispatchAction,
  cancelSoAction,
  createSoAction,
  dispatchAction,
  generatePickAction,
  packAction,
} from "../actions";

const EMPTY = { customerName: "", lines: [{ productId: "", quantity: "1" }] as QtyLine[] };

export function NewSalesOrder({ products }: { products: ProductOption[] }) {
  const t = useTranslations("ops");
  const router = useRouter();
  const [v, setV, clear] = useDraft("so:new", EMPTY);
  const { run, pending, error } = useSubmit();
  return (
    <Card className="max-w-3xl p-4 sm:p-5">
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(createSoAction, v, {
            success: (d) => (d as { orderNumber: string }).orderNumber,
            then: (d) => {
              clear();
              router.push(`/sales-orders/${(d as { id: string }).id}`);
            },
          });
        }}
      >
        <Field label={t("customer")} htmlFor="customer">
          <Input
            id="customer"
            required
            value={v.customerName}
            onChange={(e) => setV({ ...v, customerName: e.target.value })}
          />
        </Field>
        <QtyLines
          lines={v.lines}
          onChange={(lines) => setV({ ...v, lines })}
          products={products}
          labels={{ product: t("product"), qty: t("qty"), add: t("addLine"), remove: t("remove") }}
        />
        <FormError error={error} />
        <Button type="submit" loading={pending} className="justify-self-start">
          {t("create")}
        </Button>
      </form>
    </Card>
  );
}

export function OrderActions({
  salesOrderId,
  can,
  state,
}: {
  salesOrderId: string;
  can: { pick: boolean; dispatch: boolean; sales: boolean };
  state: { needsPick: boolean; allConfirmed: boolean; packed: boolean; readyQty: number; hasDispatch: boolean };
}) {
  const t = useTranslations("ops.so");
  const to = useTranslations("ops");
  const { run, pending, error } = useSubmit();
  const [d, setD] = useState({ vehicleNo: "", lrNumber: "", transporter: "" });
  const [reason, setReason] = useState("");

  return (
    <Card className="grid content-start gap-3 p-4 sm:p-5">
      <CardHeader title={to("actions")} />
      {can.pick && state.needsPick && (
        <Button
          loading={pending}
          onClick={() =>
            run(
              generatePickAction,
              { salesOrderId },
              {
                success: (r) => {
                  const x = r as { pickNumber: string; shortages: { sku: string; short: number }[] };
                  return x.shortages.length
                    ? `${t("pickCreated", { number: x.pickNumber })}. ${t("shortages", { list: x.shortages.map((s) => `${s.sku} −${s.short}`).join(", ") })}`
                    : t("pickCreated", { number: x.pickNumber });
                },
              },
            )
          }
        >
          <ClipboardList /> {t("generatePick")}
        </Button>
      )}
      {can.pick && state.allConfirmed && !state.packed && state.readyQty > 0 && (
        <Button
          variant="secondary"
          loading={pending}
          onClick={() => run(packAction, { salesOrderId }, { success: t("packed") })}
        >
          <PackageCheck /> {t("pack")}
        </Button>
      )}
      {can.dispatch && state.packed && state.readyQty > 0 && (
        <form
          className="grid gap-3 border-t border-line pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              dispatchAction,
              { salesOrderId, ...d },
              { success: (r) => t("dispatchedMsg", { number: (r as { dispatchNumber: string }).dispatchNumber }) },
            );
          }}
        >
          <h3 className="font-medium">{t("dispatchTitle")}</h3>
          <Field label={t("vehicle")} htmlFor="vehicle">
            <Input
              id="vehicle"
              required
              value={d.vehicleNo}
              onChange={(e) => setD({ ...d, vehicleNo: e.target.value.toUpperCase() })}
              className="font-mono"
              placeholder="MH12AB1234"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("lr")} htmlFor="lr">
              <Input id="lr" value={d.lrNumber} onChange={(e) => setD({ ...d, lrNumber: e.target.value })} />
            </Field>
            <Field label={t("transporter")} htmlFor="transporter">
              <Input
                id="transporter"
                value={d.transporter}
                onChange={(e) => setD({ ...d, transporter: e.target.value })}
              />
            </Field>
          </div>
          <Button type="submit" loading={pending}>
            <Truck /> {t("dispatch")}
          </Button>
        </form>
      )}
      {can.sales && !state.hasDispatch && (
        <form
          className="grid gap-2 border-t border-line pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(cancelSoAction, { salesOrderId, reason }, { success: to("saved") });
          }}
        >
          <Field label={t("cancelReason")} htmlFor="cancel">
            <Input id="cancel" required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Button type="submit" variant="ghost" loading={pending} className="justify-self-start text-danger">
            <XCircle /> {t("cancelOrder")}
          </Button>
        </form>
      )}
      <FormError error={error} />
    </Card>
  );
}

export function DispatchCancel({ dispatchId }: { dispatchId: string }) {
  const t = useTranslations("ops.so");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { run, pending, error } = useSubmit();
  if (!open)
    return (
      <Button size="sm" variant="ghost" className="text-danger" onClick={() => setOpen(true)}>
        {t("cancelDispatch")}
      </Button>
    );
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(cancelDispatchAction, { dispatchId, reason }, { success: t("cancelDispatch") });
      }}
    >
      <Input
        aria-label={t("cancelReason")}
        placeholder={t("cancelReason")}
        required
        minLength={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="h-9 w-48"
      />
      <Button size="sm" variant="danger" type="submit" loading={pending}>
        {t("cancelDispatch")}
      </Button>
      <FormError error={error} />
    </form>
  );
}
