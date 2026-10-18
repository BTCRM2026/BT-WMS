"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/primitives";

// Charts are lazy-loaded so recharts never blocks the first paint.
const loading = () => <Skeleton className="m-4 h-[240px] sm:m-5" />;
export const TrendChart = dynamic(() => import("./charts-impl").then((m) => m.TrendChart), { ssr: false, loading });
export const ZoneChart = dynamic(() => import("./charts-impl").then((m) => m.ZoneChart), { ssr: false, loading });
export const ExpiryChart = dynamic(() => import("./charts-impl").then((m) => m.ExpiryChart), { ssr: false, loading });
