"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Colours come from the design tokens so charts follow light/dark mode.
const axis = { fontSize: 12, fill: "var(--muted)" };
const tooltip = {
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: 8,
    fontSize: 13,
    color: "var(--foreground)",
  },
  cursor: { fill: "var(--surface-2)" },
};

function Frame({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <div className="h-[260px] px-2 pt-2 pb-3 sm:px-3" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export function TrendChart({
  data,
  labels,
}: {
  data: { label: string; inward: number; outward: number }[];
  labels: { inward: string; outward: string };
}) {
  return (
    <Frame label={`${labels.inward} / ${labels.outward}`}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={axis}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
        <Tooltip {...tooltip} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
        <Area
          type="monotone"
          dataKey="inward"
          name={labels.inward}
          stroke="var(--success)"
          fill="var(--success)"
          fillOpacity={0.12}
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="outward"
          name={labels.outward}
          stroke="var(--primary)"
          fill="var(--primary)"
          fillOpacity={0.1}
          strokeWidth={2}
          strokeDasharray="5 3"
        />
      </AreaChart>
    </Frame>
  );
}

export function ZoneChart({ data }: { data: { label: string; units: number }[] }) {
  return (
    <Frame label="Stock by zone">
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="var(--line)" horizontal={false} />
        <XAxis type="number" tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={axis} tickLine={false} axisLine={false} width={64} />
        <Tooltip {...tooltip} />
        <Bar dataKey="units" fill="var(--brand)" radius={[0, 4, 4, 0]} barSize={22} />
      </BarChart>
    </Frame>
  );
}

export function ExpiryChart({ data }: { data: { label: string; units: number }[] }) {
  return (
    <Frame label="Expiry timeline">
      <BarChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={axis}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={8}
        />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
        <Tooltip {...tooltip} />
        <Bar dataKey="units" fill="var(--warning)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </Frame>
  );
}
