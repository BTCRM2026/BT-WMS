import { prisma } from "@/server/db/client";

/** One row in EVERY tenant table for the given company. Returns {Model: id}. */
export async function createTenantRows(companyId: string, tag: string) {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  const warehouseId = (await prisma.warehouse.findFirstOrThrow()).id;
  const s = { companyId, warehouseId };
  const user = await prisma.user.findFirstOrThrow({ where: { companyId } });
  const product = await prisma.product.findFirstOrThrow({ where: { companyId }, orderBy: { sku: "asc" } });
  const batch = await prisma.batch.findFirstOrThrow({ where: { companyId, productId: product.id } });
  const location = await prisma.location.findFirstOrThrow({ where: { companyId, type: "STORAGE" } });
  const movement = await prisma.stockMovement.findFirstOrThrow({ where: { companyId } });
  const balance = await prisma.stockBalance.findFirstOrThrow({ where: { companyId } });
  const line = { ...s, productId: product.id };
  const placed = { ...line, batchId: batch.id, locationId: location.id };

  const po = await prisma.purchaseOrder.create({
    data: { ...s, poNumber: `PO-${tag}`, supplierName: company.name, createdById: user.id },
  });
  const poLine = await prisma.purchaseOrderLine.create({ data: { ...line, purchaseOrderId: po.id, quantity: 10 } });
  const ir = await prisma.inwardReceipt.create({
    data: { ...s, receiptNumber: `IR-${tag}`, purchaseOrderId: po.id, receivedById: user.id },
  });
  const irLine = await prisma.inwardReceiptLine.create({ data: { ...placed, inwardReceiptId: ir.id, quantity: 10 } });
  const so = await prisma.salesOrder.create({
    data: { ...s, orderNumber: `SO-${tag}`, customerName: "Salon", createdById: user.id },
  });
  const soLine = await prisma.salesOrderLine.create({ data: { ...line, salesOrderId: so.id, quantity: 2 } });
  const pl = await prisma.pickList.create({ data: { ...s, pickNumber: `PL-${tag}`, salesOrderId: so.id } });
  const plLine = await prisma.pickListLine.create({ data: { ...placed, pickListId: pl.id, quantity: 2 } });
  const ds = await prisma.dispatch.create({ data: { ...s, dispatchNumber: `DS-${tag}`, salesOrderId: so.id } });
  const dsLine = await prisma.dispatchLine.create({
    data: { ...line, batchId: batch.id, dispatchId: ds.id, quantity: 2 },
  });
  const ret = await prisma.stockReturn.create({
    data: { ...placed, returnNumber: `RT-${tag}`, quantity: 1, reason: "Leak", createdById: user.id },
  });
  const dmg = await prisma.damage.create({
    data: { ...placed, damageNumber: `DM-${tag}`, quantity: 1, reason: "Broken", reportedById: user.id },
  });
  const sa = await prisma.stockAudit.create({ data: { ...s, auditNumber: `SA-${tag}`, createdById: user.id } });
  const saLine = await prisma.stockAuditLine.create({
    data: { ...placed, stockAuditId: sa.id, systemQuantity: 5, countedQuantity: 4 },
  });
  const adj = await prisma.adjustment.create({
    data: {
      ...placed,
      adjustmentNumber: `AD-${tag}`,
      direction: -1,
      quantity: 1,
      reason: "Count",
      createdById: user.id,
    },
  });
  const log = await prisma.auditLog.create({ data: { companyId, action: "test", entity: "test" } });

  return {
    User: user.id,
    Product: product.id,
    Batch: batch.id,
    Location: location.id,
    StockMovement: movement.id,
    StockBalance: balance.id,
    PurchaseOrder: po.id,
    PurchaseOrderLine: poLine.id,
    InwardReceipt: ir.id,
    InwardReceiptLine: irLine.id,
    SalesOrder: so.id,
    SalesOrderLine: soLine.id,
    PickList: pl.id,
    PickListLine: plLine.id,
    Dispatch: ds.id,
    DispatchLine: dsLine.id,
    StockReturn: ret.id,
    Damage: dmg.id,
    StockAudit: sa.id,
    StockAuditLine: saLine.id,
    Adjustment: adj.id,
    AuditLog: log.id,
  } as Record<string, string>;
}
