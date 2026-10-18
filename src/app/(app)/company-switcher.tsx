"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { switchCompany } from "./actions";

export function CompanySwitcher({
  companies,
  activeId,
}: {
  companies: { id: string; name: string }[];
  activeId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Switch company"
      data-testid="company-switcher"
      value={activeId}
      disabled={pending}
      onChange={(e) =>
        start(async () => {
          const r = await switchCompany(e.target.value);
          if (r.ok) router.refresh();
          else alert(r.error);
        })
      }
      className="rounded border px-2 py-1"
    >
      {companies.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
