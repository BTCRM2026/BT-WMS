import type { Tone } from "@/components/ui/primitives";

/** One colour per document status across all lists. */
export const STATUS_TONES: Record<string, Tone> = {
  DRAFT: "neutral",
  OPEN: "info",
  ORDERED: "info",
  CONFIRMED: "info",
  RECEIVED: "success",
  POSTED: "success",
  DONE: "success",
  DISPATCHED: "success",
  CLOSED: "success",
  PARTIALLY_RECEIVED: "warning",
  PICKING: "warning",
  PACKED: "brand",
  IN_PROGRESS: "warning",
  COUNTING: "warning",
  SUBMITTED: "warning",
  INSPECTED: "warning",
  CANCELLED: "danger",
};
