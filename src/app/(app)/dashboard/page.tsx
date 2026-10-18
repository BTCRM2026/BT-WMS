import { requirePage } from "@/server/auth/context";

export default async function Dashboard() {
  const { db, company } = await requirePage("dashboard.view");
  const [products, locations, balances] = await Promise.all([
    db.product.count(),
    db.location.count(),
    db.stockBalance.aggregate({ _sum: { quantity: true } }),
  ]);

  const kpis = [
    ["Products", products],
    ["Tiles", locations],
    ["Units in stock", balances._sum.quantity ?? 0],
  ] as const;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold" data-testid="dashboard-title">
        {company.name} dashboard
      </h1>
      <div className="grid grid-cols-3 gap-4">
        {kpis.map(([label, value]) => (
          <div key={label} className="rounded border bg-white p-4">
            <div className="text-sm text-gray-500">{label}</div>
            <div className="text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
