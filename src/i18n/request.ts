import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

// Add "hi" here (and messages/hi.json) to ship Hindi. Locale comes from the `locale` cookie.
export const LOCALES = ["en"] as const;

export default getRequestConfig(async () => {
  const wanted = (await cookies()).get("locale")?.value;
  const locale = LOCALES.find((l) => l === wanted) ?? "en";
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});
