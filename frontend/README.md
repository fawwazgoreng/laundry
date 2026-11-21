# Fadarosi Frontend

React 19 single-page app for the Fadarosi laundry business system. It is built with Vite 8, React Router 7, Tailwind CSS 4, Leaflet, Recharts, and `decimal.js`. The UI language is Indonesian and dates/numbers use `id-ID`.

The backend HTTP contract consumed by this app is in [`../docs/api.yml`](../docs/api.yml).

## 📢 Commands

Run these from `frontend/`:

| Command | Purpose |
| --- | --- |
| `bun install --frozen-lockfile` | Install from `bun.lock` |
| `bun run dev` | Start the Vite dev server |
| `bun run build` | `tsc -b && vite build` |
| `bun run lint` | ESLint over the project |
| `bun run preview` | Preview `dist/` on port 5173 |
| `bun test tests/unit` | Unit tests |
| `bun run test:e2e` | Playwright browser tests |

Single unit test examples:

```bash
bun test tests/unit/apiClient.test.ts
bun test tests/unit/apiClient.test.ts -t "returns data and sends the bearer token + content type"
```

There is no separate typecheck or formatter script. `tsc -b` covers only `src` and `vite.config.ts`; `tests/`, `e2e/`, and `playwright.config.ts` are not typechecked.

## ⚙️ Runtime boundaries

- Browser entry: `index.html` → `src/main.tsx` → `src/App.tsx`.
- Provider order in `src/main.tsx` is significant: `StrictMode > ToastProvider > BrowserRouter > AuthProvider > OrderDraftProvider > App`. `ToastProvider` must remain outermost.
- `src/App.tsx` is the only route table. Public routes use `GuestLayout`, customer routes use `ProtectedRoute + CustomerLayout`, admin routes use `ProtectedRoute adminOnly + AdminLayout`, and `*` renders a role-aware 404.
- API calls go through `src/services/apiClient.ts` and the typed endpoint groups in `src/services/api.ts`. Pages should not call raw `fetch`.
- Dev API base is `import.meta.env.VITE_API_URL ?? "http://localhost:3000/api"`; it is absolute, not a Vite proxy. CORS must allow the dev origin.
- Vite proxies only `/uploads` to `API_PROXY_TARGET ?? http://localhost:3000`. The nginx image does no runtime env substitution and hardcodes `http://host.docker.internal:3000/uploads/`, so `API_PROXY_TARGET` affects dev only.

## 🗺️ Segment map

### Bootstrap and routing

| Path | Owns | Notes |
| --- | --- | --- |
| `index.html` | HTML shell | `lang="id"`, root div, module entry, no-cache intent, and a `vite:preloadError` reload handler. |
| `src/main.tsx` | Provider composition | See the provider order above. |
| `src/App.tsx` | Route table | Public: `/`, `/login`, `/register`, `/nota/:notaId`, `/laporan/nota`. Customer: `/dashboard`, `/history`, `/layanan`, `/produk`, `/checkout`, `/riwayat/:orderId`, `/tracking/:orderId`, `/payment/:orderId`. Admin: `/admin`, `/admin/pesanan`, `/admin/layanan`, `/admin/laporan`, `/admin/produk`, `/admin/pilihan`, `/admin/riwayat/:orderId`, `/admin/tracking/:orderId`, `/admin/pengaturan`. Admin reuses customer detail/tracking pages. |
| `src/components/ProtectedRoute.tsx` | Auth guard | Shows a spinner while auth loads, redirects to `/login` with `state.from`, and enforces `adminOnly` by redirecting non-admins to `/dashboard`. |
| `src/lib/scrollBehavior.ts` | Route scroll handling | Smooth-scrolls hash links and scrolls to top on route changes. |

### State and layout

| Path | Owns | Notes |
| --- | --- | --- |
| `src/context/AuthContext.tsx` | Session state | Restores session via `authApi.me()` when a token exists, exposes `user`, `loading`, `login`, `register`, `logout`, `refreshProfile`, and `isAdmin`. |
| `src/context/OrderDraftContext.tsx` | Cart/checkout draft | Holds services/products with addons, cart mutations, and `Decimal`-based totals. `per_order` addons are deduplicated. Default payment method is `transfer_bank`. |
| `src/layouts/GuestLayout.tsx` | Public shell | Bare `<main>` with `<Outlet />`; the landing page renders its own header. |
| `src/layouts/CustomerLayout.tsx` | Customer shell | `CUSTOMER_NAV`, `Topbar`, centered outlet. |
| `src/layouts/AdminLayout.tsx` | Admin shell | `ADMIN_NAV`, `Topbar`, centered outlet. Navigation changes belong in these arrays. |
| `src/components/Topbar.tsx` | Shared responsive nav | Uses `useAuth()` for role and logout. |

### Reusable components

| Path | Owns | Notes |
| --- | --- | --- |
| `src/components/ui.tsx` | Design primitives | Buttons, inputs, cards, badges, modal, empty/error/loading states, pagination, and section titles. |
| `src/components/Toast.tsx` | Global notifications | 3.5s auto-dismiss; `useToast()` throws outside `ToastProvider`. |
| `src/components/ConfirmDialog.tsx`, `deletePopUp.tsx` | Confirmation flows | `deletePopUp.tsx` is the destructive preset. |
| `src/components/FloatingInput.tsx` | Form input | Peer-based floating-label input used by profile/address forms. |
| `src/components/map.tsx` | Map views | `BasicMap` and `RouteMap`; `RouteMap` is used by order tracking. |
| `src/components/mapClickPicker.tsx` | Customer coordinate picker | Uncontrolled click-to-pick map with a default Jakarta center. |
| `src/components/mapClickPickerAdmin.tsx` | Admin radius picker | Controlled `value/onChange` picker with a `Circle` radius, `Recenter`, and `FitRadius`; used by outlet settings. |
| `src/components/userAddressMap.tsx` | GPS/reverse-geocode picker | Currently has no consumer in `src`; may be legacy. |
| `src/components/addonPopUp.tsx` | Addon selection modal | Implements `single`/`multiple` and required-group rules; currently has no consumer in `src`. |

Leaflet CSS and the marker icon fix are imported inside map components. The fix file is named `leafletIconFix.ts.ts` and must be imported with an explicit `.ts` suffix.

### API and types

| Path | Owns | Notes |
| --- | --- | --- |
| `src/services/apiClient.ts` | HTTP client | 15s timeout, `localStorage` token persistence under `fadarosi_*` keys, single-flight 401 refresh with one retry, envelope validation, and `ApiError` with `status`, `code`, and `details`. |
| `src/services/api.ts` | Endpoint registry | Typed groups: `authApi`, `addressApi`, `serviceApi`, `productApi`, `addonApi`, `outletApi`, `orderApi`, `paymentApi`, `refundApi`, `adminApi`. Use `api.page` only when `meta` is needed; other methods unwrap `data`. |
| `src/lib/types.ts` | Canonical API/domain types | Envelope and meta, users, addresses, addons, services, products, outlets, orders, payments, refunds, admin stats, and cashflow. |
| `src/global/payment.global.ts` | Legacy Snap typings | Declares `window.snap`; no current source imports it, and payments display a VA number instead. |

Money crosses the API as a 2-decimal string. Use `parseMoney`, `moneyToNumber`, `toMoneyInput`, `Decimal`, and `ROUND_HALF_UP`; never use raw floats for money.

### Library helpers

| Path | Owns | Notes |
| --- | --- | --- |
| `src/lib/utils.ts` | Formatting and labels | Decimal helpers, Rupiah/date/number formatting in `id-ID`, `timeAgo`, `cx`, and shared status/category/sort labels. |
| `src/lib/format.ts` | Form helpers | `formatIDR` alias and `formatFormError` for API validation details. |
| `src/lib/serviceAddons.ts` | Addon math | Deduplicates `per_order` addons and computes Decimal-safe subtotals. |
| `src/lib/deliveryEstimate.ts` | Delivery ETA | Adds a 6h buffer with an 18:00 cutoff and 07:00 resume. |
| `src/lib/distanceCalc.ts` | Haversine distance | Used by unit tests; runtime delivery distance is normally returned by the backend. |
| `src/lib/orderStatus.ts` | Status presentation | Shared status/payment labels and Tailwind style maps. |
| `src/lib/pagination.ts` | Client pagination | `fetchAllPages(..., 100)` plus `pageSlice`; admin/customer list pages follow this pattern. |
| `src/lib/report.ts` | Report calculations | Shared range resolution, scope filtering, cashflow split, and monthly series for `/admin/laporan` and `/laporan/nota`. |
| `src/lib/geoCode.ts`, `useGeoLocation.ts` | Geo utilities | Nominatim geocoding and a `navigator.geolocation` hook. |

### Pages

| Path | Owns | Notes |
| --- | --- | --- |
| `src/pages/public/LandingPage.tsx` | Landing page | Fetches services and in-stock products; renders its own header/footer. |
| `src/pages/public/AuthPages.tsx` | Login/register | Login sends admins to `/admin`, otherwise `state.from` or `/dashboard`. |
| `src/pages/public/ReceiptPage.tsx` | `/nota/:notaId` | Loads order detail and opens the print dialog. |
| `src/pages/public/ReportReceives.tsx` | `/laporan/nota` | Printable report; accepts filtered data via router state with a query-string fallback and auto-prints. |
| `src/pages/customer/DashboardPage.tsx` | Account dashboard | Composes profile/address sections, spending trend, and stats. Subcomponents live in `src/pages/customer/dashboard/`. |
| `src/pages/customer/LaundryWizardPage.tsx` | Service ordering | Selects services and addons, then navigates to `/checkout`. |
| `src/pages/customer/ShopPage.tsx` | Product browsing | Search/sort/filter and addon selection. |
| `src/pages/customer/CheckoutPage.tsx` | Checkout | Owns delivery state, refund preview, draft-to-payload mapping, and payment navigation. This is the only place that maps `OrderDraftContext` to `OrderCreateInput`. |
| `src/pages/customer/PaymentPage.tsx` | VA display | Shows VA/bank and a 24h countdown; reloads payment and order. |
| `src/pages/customer/OrderDetailPage.tsx` | Order detail/actions | Shared by customer and admin; handles cancel, delete, and refund decisions. |
| `src/pages/customer/OrderTrackingPage.tsx` | Tracking | Status timeline plus `RouteMap`; shared by customer and admin. |
| `src/pages/customer/HistoryPage.tsx` | Order history | Fetches all pages, filters client-side, and checks payment re-entry. |
| `src/pages/admin/AdminDashboardPage.tsx` | Admin overview | Stats, low stock, recent orders, and weekly revenue chart. |
| `src/pages/admin/AdminOrderManagementPage.tsx` | Order operations | All-pages orders, filters, status transitions, and confirmations. |
| `src/pages/admin/AdminServiceManagementPage.tsx` | Service CRUD | Normalizes money inputs with `toMoneyInput`. |
| `src/pages/admin/AdminProductManagementPage.tsx` | Product CRUD | Includes image upload validation and `/uploads` asset URL resolution. |
| `src/pages/admin/AdminAddonManagementPage.tsx` | Addon management | Group/option CRUD and service/product target linking. |
| `src/pages/admin/AdminReportPage.tsx` | Admin reports | Filters/charts; passes filtered data to `/laporan/nota` for printing. |
| `src/pages/admin/AdminSettingsPage.tsx` | Outlet settings | Weekly hours parse/serialize, GPS, radius editing. |

### Styling and assets

| Path | Owns | Notes |
| --- | --- | --- |
| `src/index.css` | Tailwind theme and print CSS | Tailwind 4 `@import` plus `@theme` tokens `primary`, `surface`, `ink`, `ink-strong`; print rules for `.print-area`, `.print-hidden`, and report sections. |
| `public/components/`, `public/*.png`, `public/*.svg` | Referenced static assets | Pages reference these by absolute URL. `src/assets/` is Vite template leftovers. |

### Tests and deployment files

| Path | Owns | Notes |
| --- | --- | --- |
| `tests/unit/` | Unit tests | `bun:test` coverage for API client, delivery estimate, distance, pagination, report, service addons, and utils. |
| `e2e/` | Browser smoke tests | `customer-order.spec.ts` and `admin-status.spec.ts` with shared helpers. Some flows are stale relative to current routes/UI, so treat them as smoke tests, not a contract. |
| `playwright.config.ts` | Playwright setup | Chromium only, serial, 1 retry, 60s timeout, starts backend from `../backend` and frontend preview on 4173 with `reuseExistingServer: false`. |
| `vite.config.ts` | Vite setup | `/uploads` dev proxy, React Compiler via Babel preset, Tailwind 4 plugin, and Node polyfills for `stream`, `util`, `Buffer`, `global`, `process`. |
| `tsconfig*.json` | TypeScript projects | Root is references-only; app includes `src`, node config includes only `vite.config.ts`. |
| `eslint.config.js` | Lint setup | Flat config with recommended TS, React Hooks, and React Refresh rules; ignores `dist`. |
| `Dockerfile`, `nginx.conf` | Production image | Bun build stage produces `dist/`, then nginx serves the SPA with history fallback and `/uploads` proxying. |

## 🔄 E2E prerequisites

E2E starts both servers itself, so ports 3000 and 4173 must be free and `dist/` must already exist from `bun run build`. Backend dependencies, generated Prisma artifacts, and a database must be ready. Pass `E2E_DATABASE_URL` explicitly: the default in `playwright.config.ts` is a stale PostgreSQL DSN, while this stack uses MySQL.
