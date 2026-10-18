# Design system and UX decisions

## Tokens (one place: `src/app/globals.css`)

- **Colour**: slate neutrals (`background`, `surface`, `surface-2`, `foreground`, `muted`, `line`),
  one primary accent (deep blue `#1e40af`), semantic `success` (in stock), `warning` (low stock / near expiry),
  `danger` (expired / errors), `info`. Each has a `-soft` background pair. Components only use these names.
- **Per-company accent**: `--brand-base` comes from `companies.brand_color` (Bond Therapy violet, Rich Fill teal)
  and is applied on the app shell after login: logo, active nav item, avatar, charts. Dark mode lightens it
  automatically with `color-mix` so contrast holds.
- **Type**: Inter (self-hosted by `next/font`, system fallback). Scale 12/14/16/18/22/28, tabular numbers for figures.
- **Spacing**: Tailwind's 4px scale used on an 8px grid. **Radius** 6/8/12. Two shadows only.
- **Motion**: 150–200 ms colour/opacity transitions; nothing animates layout; `prefers-reduced-motion` turns it off.

## Components

shadcn-style components on Radix primitives (`src/components/ui`): Button (with loading state that
also blocks double submits), DropdownMenu, Sheet (dialog), Card, Badge, Field/Input, Skeleton, EmptyState.
Icons: Lucide only.

## Layout

- **Phone (< 768px)**: compact top bar, bottom navigation (Dashboard, Stock, **Scan**, Floor map, More),
  cards instead of tables, 44px minimum touch targets (`pointer-coarse:` sizes), safe-area padding.
- **Tablet (768–1023px)**: icon rail sidebar, tables.
- **Desktop (≥ 1024px)**: collapsible grouped sidebar (choice remembered), top bar with global search,
  breadcrumbs, company switcher (owner only), notifications, theme toggle, user menu. Content max 1600px for 4K.

## Screens

- **Dashboard**: KPI cards (SKUs, units, below-minimum, expiring in 90 days, tiles in use), quick actions,
  inward vs outward trend, stock by zone, expiry timeline (charts lazy-loaded), alerts panel.
- **Tables** (products, tiles, stock): sticky header, sorting, search, filters, column show/hide,
  pagination, CSV export (UTF-8 with BOM so Excel opens it; formula injection neutralised),
  saved views per browser, skeleton loading, empty states.
- **Floor map**: tiles laid out by zone/row/column, coloured by fill level with the % printed on each
  tile (colour is never the only signal); click a tile to see product, batch, expiry and quantity.
- **Scan**: camera scanning via the browser's BarcodeDetector, plus a code box that works with USB
  scanners (they type + Enter). Pick / putaway / count buttons are placeholders until those modules exist.

## Stability

- One shared Prisma client; pool size, connect/pool/socket timeouts and idle lifetime set in the URL.
- Reads retry with exponential backoff on connection errors; a dropped pool is reset so it reconnects
  after a Railway Postgres restart. Startup waits for the database before serving.
- Users never see raw errors: friendly error screens with a reference id, a "reconnecting" banner that
  polls `/api/health`, automatic reload of the page data when the database is back.

## Accessibility

WCAG 2.1 AA target: token contrast ≥ 4.5:1 in both themes, visible focus rings, labelled controls,
skip link, `aria-current` / `aria-sort` / live regions, keyboard-operable menus and dialogs (Radix).
Checked with axe in e2e on every main screen, light and dark, phone and desktop.

## i18n

All UI text is in `messages/en.json` via next-intl. To add Hindi: create `messages/hi.json` and add
`"hi"` to `LOCALES` in `src/i18n/request.ts`; the `locale` cookie selects it.
