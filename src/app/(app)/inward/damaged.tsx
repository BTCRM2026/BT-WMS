"use client";

import { useTranslations } from "next-intl";
import { useSubmit } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { writeOffDamagedAction } from "./actions";

/** One tap: a DAMAGE write-off for the cartons of this receipt line that sit on the DAMAGED tile. */
export function WriteOffDamaged({ lineId }: { lineId: string }) {
  const t = useTranslations("ops");
  const { run, pending } = useSubmit();
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      onClick={() =>
        run(
          writeOffDamagedAction,
          { lineId },
          { success: (d) => t("damages.reported", { number: (d as { damageNumber: string }).damageNumber }) },
        )
      }
    >
      {t("inward.writeOffDamaged")}
    </Button>
  );
}
