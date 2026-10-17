# AUDIT_REPORT.md — Audit Alur Aplikasi (Stabilitas, Aksesibilitas, Error Handling)

- **Mode:** A (analisis saja)
- **Tanggal:** 2026-10-17
- **Repo:** `laundry` (frontend React 19 + Vite 8, backend Hono + Bun)
- **Runtime terverifikasi:** Node `v20.19.2`, Bun `1.4.0`
- **Perubahan kode:** TIDAK ADA (lihat bagian 10 & 11)

> Catatan rahasia: laporan ini tidak memuat isi `.env`, `DATABASE_URL`, token, atau secret. Nilai sensitif disamarkan bila disebut.

---

## 1. Ringkasan eksekutif

Aplikasi ini secara umum terstruktur rapi (clean layered: domain → useCase → presentation → infrastructure) dan memiliki penangan error terpusat yang baik di backend (`handleAppError`) serta validasi input berbasis Zod yang konsisten. Namun, ada beberapa kelemahan nyata pada alur kritis: pembuatan order, pembayaran, dan pencatatan cashflow **tidak dibungkus satu transaksi**, sehingga kegagalan di tengah dapat meninggalkan data setengah jadi (order ada tanpa pembayaran, atau pembayaran PAID tanpa pemasukan). Terdapat **kondisi balapan (race condition)** yang bisa menyebabkan overselling stok dan pencatatan pemasukan ganda pada webhook/konfirmasi pembayaran. Perlindungan brute-force di endpoint autentikasi **dimatikan** (baris `authRateLimiter` dikomentari), dan tidak ada graceful shutdown. Di sisi frontend, **14 pemanggilan data menelan error secara diam-diam** (`.catch(() => undefined)`), sehingga kegagalan API terlihat seperti "data kosong" tanpa umpan balik. Typecheck backend aplikasi bersih, tetapi `seed.ts` dan seluruh tes integrasi **gagal typecheck** karena masih memakai API Prisma lama. E2E juga rusak karena menavigasi ke rute `/profil` yang sudah tidak ada.

**5 temuan terpenting:**

1. **P1** — Alur order/pembayaran tidak atomik: `CreateOrderUseCase` memanggil gateway Midtrans dan membuat payment **di luar transaksi**, sehingga bisa terjadi partial state (`backend/src/useCase/order/orderUseCases.ts:140-172`, `:242-291`).
2. **P1/P2** — Race condition overselling stok: validasi stok dilakukan di use case sebelum transaksi, lalu di dalam transaksi stok dikurangi **tanpa pengecekan ulang** (`orderUseCases.ts:114` + `pgOrderRepository.ts:269-276`).
3. **P2** — Pemasukan ganda: `confirm` tidak atomik dan tidak idempotent; dua pengiriman webhook Midtrans atau klik ganda admin dapat membuat dua baris `cash_flow` (`paymentUseCases.ts:35-61`, `midtransNotificationUseCase.ts:57-95`).
4. **P2** — Pemetaan error Prisma kemungkinan **dead code**: `mapToAppError` mencocokkan `Prisma.PrismaClientKnownRequestError` dari generated client lama, sementara runtime memakai `@prisma/orm-postgres` yang tidak memakai kelas itu (`errorMappings.ts:2,24`).
5. **P2** — `.catch(() => undefined)` pada 14 titik load data frontend menelan error tanpa notifikasi ke pengguna (`ShopPage.tsx:40`, `DashboardPage.tsx:71`, dst.).

---

## 2. Papan skor

| Area | Nilai | Alasan (1 kalimat) |
|---|---|---|
| Stabilitas | **Perlu perhatian** | Banyak operasi multi-langkah non-transaksional, race condition stok/pemasukan, dan tidak ada graceful shutdown / handler `unhandledRejection`. |
| Aksesibilitas (API) | **Cukup** | Format envelope & status code konsisten, otorisasi kepemilikan data baik, tetapi tidak ada rate-limit khusus auth, tanpa batas paginasi, dan param `:id`/`page` tidak divalidasi. |
| Aksesibilitas (UI) | **Perlu perhatian** | Baru 5 dari 21 `<label>` ber-`htmlFor`, 3 `<img>` tanpa `alt`, dan beberapa halaman tidak punya state loading/error yang terbaca. |
| Error handling | **Cukup** | Handler terpusat + taksonomi `AppError` bagus, tetapi ada `catch {}` penelan error dan pemetaan error Prisma kemungkinan tidak aktif. |
| Type safety | **Cukup** | Sumber produksi backend bersih dari error `tsc`; frontend lolos `--strict`; namun masih ada `any` eksplisit dan `seed.ts`/tes integrasi gagal typecheck. |
| Tes | **Perlu perhatian** | Unit test useCase/entitas bagus (87+35 lulus), tetapi repositori, middleware, presentasi, dan error-mapping tidak diuji; E2E rusak. |

---

## 3. Jawaban `any`

> **Apakah ada penggunaan `any`? YA.** Jumlah total di kode produksi (di luar file generated & file tes): **14 baris `any` eksplisit**, **8 `as unknown as`**, **2 direktif `@ts-*`/eslint-disable**. Di file tes: puluhan `as unknown as <repo>` (mock). File `infrastructure/src/generated/prisma/**` (auto-generated, committed) memuat ratusan `any` + `@ts-nocheck` — **dikecualikan** karena bukan kode yang ditulis manusia.

**`any` eksplisit di kode produksi (14 baris):**

| Lokasi | Potongan | Alasan (dugaan) | Tipe pengganti tepat | Risiko mengubah |
|---|---|---|---|---|
| `backend/src/domain/types/globalType.ts:5` | `error?: any` | Tipe envelope error longgar | `error?: unknown` | Rendah |
| `backend/.../pgPaymentRepository.ts:72` | `raw_response: (input.raw_response ?? null) as any` | Kolom `jsonb` belum bertipe di ORM | `unknown`/`Prisma.JsonValue` sesuai kontrak | Rendah |
| `backend/.../pgPaymentRepository.ts:120` | `.update({ raw_response: rawResponse as any })` | idem | idem | Rendah |
| `backend/.../pgStatsRepository.ts:56,85,86,88,92,93` (6) | `(item.service as any)?.name` | Relasi hasil `include` tidak terbaca tipe | Tipe relasi yang di-`include` (mis. `{ service: { name: string; unit: string } }`) | Sedang (perlu definisikan tipe row) |
| `frontend/src/lib/types.ts:6` | `details?: any` | Detail error backend heterogen | `Record<string, unknown>` | Rendah |
| `frontend/src/lib/utils.ts:113` | `combineClass(...classes: any[])` | Fungsi mati (dead code) | Hapus / `(string\|false\|null\|undefined)[]` | Rendah |
| `frontend/src/lib/format.ts:7` | `formatFormError(details: any)` | Detail Zod | `Record<string, unknown>` + type guard | Sedang (lihat P2 error-handling) |
| `frontend/src/services/apiClient.ts:8` | `details?: any` | sama | `Record<string, unknown>` | Rendah |
| `frontend/src/services/apiClient.ts:10` | `details?: any` (ctor) | sama | `Record<string, unknown>` | Rendah |

**`as unknown as` di produksi (8):** `userEntity.ts:41`, `appError.ts:54`, `refreshTokenUseCase.ts:23`, `updateProfileUseCase.ts:18`, `outletUseCases.ts:50` (semuanya untuk `zod.flatten()` → `Record<string, unknown>` — aman, tapi lebih baik `z.ZodFormattedError`), `orderUseCases.ts:65` & `midtransNotificationUseCase.ts:102` (cast client Midtrans), `apiClient.ts:95` (`body as unknown as T` fallback).

**Direktif:** `frontend/src/lib/utils.ts:112` `eslint-disable no-explicit-any`; `frontend/src/lib/leafletIconFix.ts.ts:6` `@ts-expect-error` (disengaja, pengecualian Leaflet).

**Implisit:** `catch (e)` di seluruh kode memakai `unknown` (baik). `pgPaymentRepository.ts:111,122` `catch {}` tanpa parameter (menelan error — lihat P3). Doesn't use `@ts-nocheck`/`@ts-ignore` di kode produksi (hanya di generated).

---

## 4. Hasil type check

Perintah dan keluaran (dijalankan tanpa mengubah konfigurasi apa pun):

**Backend — `npx tsc --noEmit` (tsconfig `strict: true`):** **54 error**, semuanya di luar kode runtime aplikasi:

| File | Jumlah error | Inti masalah |
|---|---|---|
| `src/infrastructure/seed/seed.ts` | 26 | Memakai API lama `prisma.orders`, `prisma.user`, `prisma.$disconnect` yang tidak ada pada `PostgresClient<Contract>` |
| `tests/integration/helpers.ts` | 20 | idem (`prisma.cash_flow`, `prisma.$transaction`, dst.) |
| `tests/integration/api.test.ts` | 8 | idem + `Record<string, any>` / param `any` implisit |

Bukti potongan:
```
src/infrastructure/seed/seed.ts(18,23): error TS2339: Property 'orders' does not exist on type 'PostgresClient<Contract>'.
src/infrastructure/seed/seed.ts(334,22): error TS2339: Property '$disconnect' does not exist on type 'PostgresClient<Contract>'.
tests/integration/helpers.ts(5,18): error TS2551: Property '$transaction' does not exist ... Did you mean 'transaction'?
```
Sumber produksi lain (domain, useCase, presentation, infrastructure/repository, prisma.ts) **bersih**. `npx tsc --noEmit --strict` menghasilkan **54 baris yang sama** ⇒ **`strict` sudah aktif** di backend (tidak ada selisih).

> Ket: `pgOrderRepository.ts` dan repo lain mengakses model dengan pola baru `prisma.orm.public.Orders`; `seed.ts`/tes integrasi masih pola lama. Ini konsisten dengan kegagalan typecheck.

**Frontend — `npx tsc -b` dan `npx tsc --noEmit -p tsconfig.app.json`:** **0 error** (exit 0). `--strict` menambah **0 error** juga ⇒ lolos juga saat strict.

**Flag strict yang nonaktif di frontend `tsconfig.app.json`:** tidak ada `"strict": true` eksplisit, sehingga defaultnya `false`. Yang aktif hanya `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch`. Jadi **`strict` (beserta `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, dll.) dan `noUncheckedIndexedAccess` tidak aktif di frontend**. Namun secara empiris menyalakan `--strict` tidak memunculkan error baru (0 selisih). Backend: `strict: true` aktif; `noUncheckedIndexedAccess` tidak diset (nonaktif).

---

## 5. Hasil test check

**Lint frontend — `bun run lint`:** **8 masalah (5 error, 3 warning)** — sesuai catatan AGENTS.md.
```
src/lib/format.ts:7   error  Unexpected any (@typescript-eslint/no-explicit-any)
src/lib/format.ts:10  error  'objectDetail' is never reassigned. Use 'const'
src/lib/types.ts:6    error  Unexpected any
src/services/apiClient.ts:8   error  Unexpected any
src/services/apiClient.ts:10  error  Unexpected any
warning x3: react-hooks/exhaustive-deps (mapClickPickerAdmin.tsx:47,58; AdminSettingsPage.tsx:104)
```
Backend tidak punya script `lint`.

**Unit test:**

| Suite | Perintah | Lulus | Gagal | Skipped | Durasi | Cakupan (definisi script) |
|---|---|---|---|---|---|---|
| Backend | `bun run test` | 87 | 0 | 0 | 2.74s | 87.45% func / 94.87% line (hanya `domain/entities` + `useCase`) |
| Frontend | `bun run test` | 35 | 0 | 0 | 0.05s | 87.20% func / 95.89% line (hanya 3 file lib/service) |

Rincian cakupan backend (terpilih): `paymentUseCases.ts` 42.86% func (10-22, 67-71 tidak tercakup), `addressUseCases.ts` 60% func, `appError.ts` 70% func. Frontend: `apiClient.ts` 78.26% func (baris 103-104, 109, 111, 114-119 tidak tercakup — method `page/post/put/patch/delete/upload`).

**Tes rapuh / tanpa assertion:** tidak ditemukan tes tanpa assertion. Tidak ada tes yang di-skip. Tidak ditemukan ketergantungan waktu nyata secara eksplisit; namun tes backend memakai urutan mock implisit pada beberapa kasus order.

**Peta celah tes (berdasarkan alur kritis):**

| Prioritas | Alur kritis | Status tes |
|---|---|---|
| Tinggi | Pembuatan order + charge Midtrans + issuePayment (partial failure) | Tidak ada (di luar scope useCase mock sederhana) |
| Tinggi | Webhook Midtrans: verifikasi signature & idempotensi | Tidak ada |
| Tinggi | `confirm` pembayaran & pencatatan cashflow (double-entry) | Tidak ada |
| Tinggi | Middleware auth/admin (401/403) | Tidak ada |
| Tinggi | `errorMappings.mapToAppError` (pemetaan Prisma/Zod/SyntaxError) | Tidak ada |
| Sedang | Repositori `pg*` (transaksi, `forUpdate`, paginasi) | Tidak ada (butuh DB → di luar unit) |
| Sedang | `ExpirePendingPaymentsUseCase` | Tidak ada |
| Sedang | Rate limiter, request logging, health check | Tidak ada |
| Sedang | Alur frontend: checkout, payment, tracking, error UI | Tidak ada |
| Rendah | Utilitas format/geo/report | Sebagian (`report.ts`, `utils.ts`) |

**Coverage perintah:** dijalankan sebagai informasi tanpa mengubah konfigurasi (`bun test --coverage`). Backend hanya meng-coverage direktori yang dites (repositori/presentasi tidak ikut terhitung → cakupan nyata atas seluruh kode backend jauh lebih rendah dari 94.87%).

---

## 6. Peta alur

**Titik masuk server:** `backend/src/index.ts` — Hono, port dari `env.PORT` (default 3000). Middleware global berurutan: `secureHeaders()` → `cors()` (`CORS_ORIGIN`, credentials) → `requestLogging` → `apiRateLimiter` (`/api/*`) → static `/uploads/*`. Handler terpusat: `app.notFound` (404 envelope) dan `app.onError(handleAppError)`. Health check `GET /health`.

**Startup/shutdown:** env divalidasi eager via Zod di `src/config/env.ts` (fail-fast). Koneksi DB *lazy* (dibuat saat impor `prisma.ts` tapi tidak `connect` eksplisit). **Tidak ada** handler `SIGTERM`/`SIGINT`, **tidak ada** `process.on('unhandledRejection'|'uncaughtException')`, **tidak ada** penutupan pool DB (`prisma` tidak punya `$disconnect`). Worker `startPaymentExpiryWorker` dijalankan hanya `if (import.meta.main)` dan tidak dihentikan saat shutdown.

**Endpoint (semua di bawah `/api`):**

| Method | Path | Auth | Validasi | Sukses |
|---|---|---|---|---|
| GET | `/health` | publik | — | 200 / 503 |
| POST | `/users/register` | publik | Zod (`userEntity`) | 201 |
| POST | `/users/login` | publik | Zod | 200 |
| POST | `/users/refresh` | publik | Zod | 200 |
| POST | `/users/logout` | bearer | — | 200 |
| GET | `/users/me` | bearer | — | 200 |
| PUT | `/users/profile` | bearer | Zod | 200 |
| GET/POST | `/addresses`, `/:id`, `:id/primary` | bearer | Zod | 200/201/204 |
| GET | `/outlets`, `/outlets/default`, `/outlets/:id` | publik | — | 200 |
| PUT | `/outlets/:id` | admin | Zod | 200 |
| GET | `/services`, `/services/:id` | publik | — | 200 |
| POST/PUT/DELETE | `/services`, `/services/:id` | admin | Zod | 201/200/204 |
| GET | `/products`, `/products/:id` | publik | query cast | 200 |
| POST/PUT/DELETE | `/products`, `/products/:id` | admin | Zod | 201/200/204 |
| POST | `/products/:id/image` | admin | multipart | 200 |
| POST | `/orders` | bearer | Zod | 201 |
| GET | `/orders` | bearer | query cast | 200 |
| PATCH | `/orders/:orderId/status` | admin | Zod | 200 |
| PATCH | `/orders/:orderId/cancel` | bearer | — | 200 |
| DELETE | `/orders/:orderId` | admin | — | 200 |
| GET | `/orders/:orderId/tracking`, `/:orderId` | bearer | — | 200 |
| GET | `/payments`, `/payments/order/:orderId` | bearer | — | 200 |
| POST | `/payments/confirm` | admin | Zod | 200 |
| GET | `/admin/stats`, `/admin/cash-flow` | admin | — | 200 |
| POST | `/midtrans/notification` | publik (signature) | Zod + SHA512 | 200/400 |

**Alur kritis:**
- **Autentikasi:** register (hash password argon2 via `Bun.password`) → login (issue access+refresh, simpan & hapus token lama) → middleware memverifikasi JWT + cek token tersimpan → refresh memutar token.
- **Order:** validasi → tolak order PENDING aktif → cek alamat/outlet/layanan/produk+stok → hitung total → generate `CLN-...` (retry 3x bila bentrok) → `orderRepository.create` (transaksi: order + item + tracking + decrement stok) → **charge Midtrans** (di luar tx) → **create payment** (di luar tx) → cashflow untuk `fadarosipay`.
- **Pembayaran:** webhook Midtrans (verifikasi signature → re-check status via `Snap.transaction.status` → `confirm` + cashflow); admin `confirm` manual; worker 15 menit membatalkan pending > 24 jam.
- **Transaksi DB (`prisma.transaction`)**: `pgOrderRepository.create`, `pgOrderRepository.updateStatus`, `pgTokenRepository.saveTokens`, `pgTokenRepository.revokeUserTokens`. **Tidak** ada pada: order→payment→cashflow, confirm+cashflow, webhook applyStatus, register (cek unik + create), `assertNoActivePending`+create.

**Integrasi eksternal:** Midtrans CoreApi (`charge`, `cancelTransaction`) dan Snap (`transaction.status`). Tidak ada email/queue/storage eksternal; upload ditulis ke `public/uploads` lokal.

**Frontend:** React Router v7 (`App.tsx`), `ProtectedRoute` gate customer/admin; `AuthContext` boot via `GET /users/me`; `apiClient` menangani 401 dengan refresh-token sekali. Halaman kritis: `CheckoutPage`, `PaymentPage`, `OrderDetailPage`, `OrderTrackingPage`.

---

## 7. Temuan terperinci

### 7A. Stabilitas

| ID | Tingkat | Lokasi | Temuan | Bukti | Status | Dampak | Rekomendasi |
|---|---|---|---|---|---|---|---|
| S-01 | P1 | `orderUseCases.ts:140-172`, `:242-291` | Order, charge gateway, dan pembuatan payment tidak atomik | `order = await this.orderRepository.create(...)` lalu `gateway = await this.chargeBankTransfer(...)` lalu `await this.issuePayment(...)` — beda transaksi | Terverifikasi | Order tanpa payment, atau charge gateway tanpa record, bila langkah lanjut gagal | Bungkus order+payment dalam satu transaksi; tunda charge gateway atau gunakan pola outbox/kompensasi |
| S-02 | P1 | `orderUseCases.ts:114`, `pgOrderRepository.ts:269-276` | Overselling stok (race) | Use case cek `prod.stock < item.qty`; di dalam tx `stock: product.stock - p.qty` tanpa cek ulang | Terverifikasi | Stok bisa negatif saat dua order bersamaan | Di dalam tx: re-check stok setelah `forUpdate`, tolak bila kurang |
| S-03 | P2 | `orderUseCases.ts:190-208` | Check-then-act PENDING aktif (race) | `findActivePendingByUser` lalu `create` tanpa constraint/idempotency | Terverifikasi | Dua order pending ganda | Tambahkan guard unik/idempotency key atau transaksi + lock |
| S-04 | P2 | `paymentUseCases.ts:35-61`, `midtransNotificationUseCase.ts:57-95` | Pemasukan ganda (race) | `existing.status === "PAID"` dicek lalu `confirm` + `cashflow.create` terpisah | Terverifikasi | Dua baris `cash_flow` income | `confirm` atomik (`where status=PENDING`), dan idempotent cashflow (kunci `order_id+type`) |
| S-05 | P2 | `pgPaymentRepository.ts:62-75` | `confirm` update tanpa guard status/lock | `where({ id }).update({status})` setelah read terpisah | Terverifikasi | Transisi status balapan | Update dengan `where status = current` (compare-and-set) |
| S-06 | P2 | `index.ts` (tidak ada) | Tidak ada graceful shutdown & handler proses | grep `SIGTERM|SIGINT|unhandledRejection|uncaughtException` → nihil; seed pakai `$disconnect` yang justru tak ada di klien baru | Terverifikasi | Request terpotong saat deploy; resource tidak ditutup | Tambah handler SIGTERM/SIGINT (hentikan worker, tutup pool) & `unhandledRejection`/`uncaughtException` yang men-log |
| S-07 | P2 | `pgStatsRepository.ts:40-42` | Query tak berbatas | `.all()` atas seluruh `Service_order_item` tanpa filter/limit | Terverifikasi | Beban memori/DB tumbuh seiring data | Batasi rentang tanggal / agregasi di SQL |
| S-08 | P2 | `productController.ts:28-34`, `orderController.ts:...` | Paginasi tanpa batas atas | `perPage: Number(query) ? ... : 12`, tanpa clamp maksimum | Terverifikasi | `?perPage=1000000` membebani DB | Clamp `perPage` (mis. ≤100) dan validasi `page≥1` |
| S-09 | P2 | `orderController.ts` (list), `productController.ts:31-33,45,55,65` | Param `:id`/`page`/`perPage` tidak divalidasi (NaN) | `Number(c.req.param("id"))`, `Number(c.req.query("page"))` | Dugaan | `?page=abc` → `NaN` diteruskan ke `LIMIT/OFFSET` → kemungkinan 500 | Validasi integer & kembalikan 400/422 |
| S-10 | P2 | `productController.ts:64-74` | Upload diparse penuh ke memori; tak ada batas body | `await c.req.parseBody()` lalu cek ukuran file | Terverifikasi | DoS memori via file besar | Batas ukuran body/multipart (mis. plugin body limit) sebelum parse |
| S-11 | P3 | `prisma.ts` | Tidak ada konfigurasi pool/timeout koneksi eksplisit | `postgres<Contract>({ url, middleware })` | Dugaan | Koneksi bisa menumpuk/menggantung | Set batas pool & statement timeout |
| S-12 | P3 | `paymentExpiryWorker.ts:11` | Worker jalan pada interval tetap tanpa overlap-guard | `setInterval(tick, ...)`; `tick` async | Dugaan | Bila `run()` > interval, tick bisa tumpang tindih | Guard `isRunning` |
| S-13 | P3 | `authRateLimiter` (`rateLimit.ts:26`, `userRoute.ts:22-24`) | Proteksi brute-force auth dimatikan | Tiga baris `userRouter.use(..., authRateLimiter)` dikomentari | Terverifikasi | Login/register hanya dibatasi 300/15m global ⇒ brute-force lebih mudah | Aktifkan kembali `authRateLimiter` pada `/login`,`/register`,`/refresh` |

### 7B. Aksesibilitas

| ID | Tingkat | Lokasi | Temuan | Bukti | Status | Dampak | Rekomendasi |
|---|---|---|---|---|---|---|---|
| A-01 | P2 | `apiClient.ts:70-80` | Fetch tanpa timeout / AbortController | `fetch(...)` polos | Terverifikasi | Request menggantung; UI "loading" tak berujung | Tambah timeout via `AbortSignal.timeout()` |
| A-02 | P2 | `productController.ts:31-33` dll. | Param kuantitatif tidak divalidasi (lihat S-09) | idem | Dugaan | 500 untuk input non-numerik (bukan 400) | Validasi skema param/query |
| A-03 | P2 | `apiClient.ts:86` | `ApiError.code` diisi dari `body.status` (angka), bukan `body.code` | `typeof body?.status === "number" ? String(body.status) : undefined` | Terverifikasi | Caller yang beralih pada `err.code` mendapat "409", bukan "CONFLICT" | Gunakan `body.code`; tambahkan `code` ke `ApiEnvelope` |
| A-04 | P3 | `FloatingInput.tsx:11` | Hanya segelintir `<label>` ber-`htmlFor` | 21 `<label>` vs 5 `htmlFor` (grep) | Terverifikasi | Pembaca layar tak mengasosiasikan label | Pasang `htmlFor`/`id` atau `aria-label` |
| A-05 | P3 | `Topbar.tsx:29`, `LandingPage.tsx:80,230` | `<img>` tanpa `alt` | grep `<img` tanpa `alt=` | Terverifikasi | Gambar tak terbaca pembaca layar (bila informatif) | Tambah `alt=""` bila dekoratif atau `alt` deskriptif |
| A-06 | P2 | `ShopPage.tsx:40` dll. (14 titik) | Tidak ada state loading/error untuk load data | `.catch(() => undefined)` | Terverifikasi | Kegagalan API tampak seperti data kosong | Tampilkan state loading/error yang terbaca (role="status"/alert) |
| A-07 | P3 | `apiResponse.ts:28` vs `productController.ts:61` | Inkonsistensi bentuk respons: 204 tanpa envelope vs 200 ber-envelope | `noContent` mengembalikan body kosong | Terverifikasi | Klien harus menangani dua bentuk | Konsistenkan (tetap dalam kontrak yang disetujui pemilik) |

### 7C. Error handling

| ID | Tingkat | Lokasi | Temuan | Bukti | Status | Dampak | Rekomendasi |
|---|---|---|---|---|---|---|---|
| E-01 | P2 | `errorMappings.ts:2,24` | Pemetaan Prisma kemungkinan **dead code** | `Prisma.PrismaClientKnownRequestError` dari generated client lama; runtime `@prisma/orm-postgres` tidak mengimpor `@prisma/client/runtime` (grep dist: nihil) | Terverifikasi (kelas berbeda) / konsekuensi Dugaan | Pelanggaran unik/FK jadi 500 generik, bukan 409 | Petakan error pg (`code 23505`/`sqlState`) atau `StructuredError` orm-postgres |
| E-02 | P2 | `pgPaymentRepository.ts:111-113,122-124` | `catch {}` menelan error tanpa log | `catch { return null; }` | Terverifikasi | Kegagalan update tak terdeteksi | Log minimal + pertimbangkan propagate |
| E-03 | P2 | `format.ts:7-14` | `formatFormError` bisa melempar TypeError | `Object.values(details.fieldErrors)` saat `fieldErrors` absen | Terverifikasi (statis) | Error asli tertutup oleh TypeError | Guard `typeof details?.fieldErrors === "object"` |
| E-04 | P2 | `apiClient.ts:37-52` | `refreshAccessToken` tidak menangkap error jaringan | `const res = await fetch(...)` tanpa try/catch | Terverifikasi | Promise reject menggagalkan request asal tanpa penanganan ramah | Bungkus try/catch, kembalikan null |
| E-05 | P3 | `midtransNotificationUseCase.ts:33` | Perbandingan signature tidak timing-safe | `expected === notification.signature_key.toLowerCase()` | Terverifikasi | Risiko timing attack kecil | `crypto.timingSafeEqual` |
| E-06 | P3 | `registerUserUseCase.ts:10-16` | Race cek-email lalu create | `findByEmail` → `create` | Terverifikasi | Duplikat/500 pada balapan (bukan 409) | Andalkan constraint unik + pemetaan 23505→409 |
| E-07 | P3 | `frontend/**` | `catch(() => undefined)` pada aksi user (mis. cancel) | `OrderDetailPage.tsx:119` | Terverifikasi | Aksi gagal tanpa umpan balik | Toast error |
| E-08 | P3 | `orderUseCases.ts:165,279` | Lema error mentah (`new Error("failed to create order")`) | lead ke 500 generik | Terverifikasi | Kurang konteks di log/klien | Gunakan `AppError.internal` dengan konteks |

---

## 8. Rencana perbaikan berprioritas

**P0 (Kritis):** tidak ditemukan temuan yang memenuhi kriteria P0 tanpa asumsi tambahan (tidak ada bukti kebocoran secret, penghapusan data massal, atau celah auth terbuka langsung). Temuan terdekat (S-01/S-02) butuh kondisi balapan; tetap disarankan ditangani segera.

**P1 (segera):**
1. S-01 — jadikan pembuatan order + payment + cashflow atomik / kompensasi. Usaha: sedang→besar. Risiko: sedang. **Tidak** mengubah DB? *Berpotensi menyentuh skema (constraint/idempotency)* → tanda "butuh keputusan pemilik proyek".
2. S-02 — re-check stok di dalam transaksi. Usaha: kecil. Risiko: rendah. Tidak menyentuh skema.

**P2:**
3. S-04/S-05/E-01 — confirm atomik + pemetaan error pg. Usaha: sedang. Risiko: sedang.
4. S-06 — graceful shutdown & handler proses. Usaha: kecil. Risiko: rendah.
5. A-01/S-10/S-08 — timeout fetch, batas body upload, clamp paginasi. Usaha: kecil. Risiko: rendah.
6. A-06/A-03/E-03/E-04 — perbaiki UX error frontend & `ApiError.code`/`formatFormError`. Usaha: kecil–sedang. Risiko: rendah.
7. S-13 — aktifkan kembali `authRateLimiter`. Usaha: kecil. Risiko: rendah (bisa menolak klien lokal karena bucket "anonymous" — lihat AGENTS).
8. S-07/S-09/A-02 — batasi query stats & validasi param. Usaha: sedang. Risiko: sedang.

**P3:**
9. E-02/E-05/E-06/E-08, A-04/A-05/A-07, S-11/S-12, dan pembersihan `any` (format.ts, types.ts, apiClient.ts, utils.ts mati). Usaha: kecil. Risiko: rendah.
10. Perbaiki `seed.ts` + tes integrasi agar sesuai API orm-postgres; perbaiki rute E2E `/profil`. Usaha: sedang. Risiko: rendah.

---

## 9. Butuh keputusan pemilik proyek

Item berikut menyentuh **design, database, atau arsitektur**, sehingga hanya dilaporkan:

1. **Transaksionalitas order/payment (S-01)** — solusi robust kemungkinan perlu constraint/idempotency key atau tabel outbox ⇒ **menyentuh skema DB**. Perlu keputusan.
2. **Idempotensi cashflow (S-04)** — idealnya unique constraint (`order_id`,`type`) ⇒ **menyentuh skema DB**. Perlu keputusan.
3. **Konsistensi bentuk respons 204 vs envelope (A-07)** — mengubah `noContent` berisiko mengubah design/kontrak. Perlu keputusan.
4. **`pickup_schedule`/`discount_member`/`discount_voucher`** dikirim frontend (`OrderCreateInput`) tetapi tidak divalidasi/diterapkan backend (`orderEntity.createSchema` hanya 8 field). Menyalakan fitur ini **mengubah perilaku/desain**. Perlu keputusan.
5. **Trust terhadap `distance_km` dari klien** (dipakai menghitung `delivery_fee`) — mengubahnya menjadi perhitungan server **mengubah desain alur**. Perlu keputusan.
6. **Menghapus method `combineClass`** (dead code) — perubahan kecil tetapi menyentuh kode; perlu konfirmasi.

Tidak ada rekomendasi lain yang menyentuh design/DB/arsitektur.

---

## 10. Perubahan yang dilakukan

**Mode A — Tidak ada perubahan kode.** Tidak ada berkas sumber, konfigurasi, tes, `package.json`, `tsconfig.json`, atau `.env` yang diubah. Satu-satunya berkas yang dibuat: `AUDIT_REPORT.md` (laporan ini).

---

## 11. Bukti kepatuhan

- **`git status --short`** (ringkas, sebelum laporan): terdapat banyak berkas yang *sudah* dimodifikasi sebelum audit ini (mis. `AGENTS.md`, `backend/**`, `frontend/**`, `docker-compose.yml`) dan beberapa untracked (`backend/src/infrastructure/prisma/contract.prisma`, `backend/src/infrastructure/prisma/scalars.ts`, `backend/src/types/`, `backend/src/infrastructure/database/generated/**`). Berkas-berkas ini **tidak disentuh** oleh audit.
- **Satu-satunya perubahan dari audit ini:** berkas baru `AUDIT_REPORT.md` (untracked).
- **Perintah penulis DB:** TIDAK dijalankan. Tidak ada `prisma db push/pull/seed`, `migrate`, `db execute`, seed, reset, atau DDL via `raw.sql`. Perintah `prisma:generate`/`prisma contract emit` juga tidak dijalankan.
- **Tidak ada perubahan** pada skema, `package.json`, `tsconfig*.json`, konfigurasi lint/formatter, atau `.env`.
- Perintah yang dijalankan hanya baca/analisis: `git status`, `node -v`, `bun --version`, `npx tsc --noEmit` (+ `--strict`), `grep`, pembacaan berkas, `bun run test`/`bun test --coverage`, `bun run lint`, dan inspeksi tipe `node_modules`.

---

## 12. Batasan audit

1. **Tidak ada akses DB / produksi.** Tidak ada koneksi ke Postgres, sehingga: pemetaan error runtime Prisma vs pg (E-01 konsekuensi), perilaku `forUpdate`/transaksi, dan validasi `LIMIT NaN` (S-09/A-02) hanya diverifikasi secara statis/tipe ⇒ ditandai [Dugaan].
2. **Integrasi eksternal (Midtrans) tidak dijalankan.** Perilaku timeout/retry/circuit-breaker gateway tidak diuji end-to-end; hanya dibaca dari kode.
3. **Tes integrasi & seed tidak dijalankan** karena script menargetkan DB (`laundry_test`/`laundry`) dan berpotensi menulis; migrasi script memakai `prisma db push`. AGENTS memperingatkan kredensial hardcoded.
4. **E2E tidak dijalankan** (butuh `bun run build` + browser + backend + DB); kerusakan rute `/profil` diverifikasi dari kode.
5. **Beban/konkurensi nyata tidak diuji.** Temuan race disimpulkan dari urutan operasi kode, bukan reproduksi.
6. **Cakupan tes** hanya mengukur berkas yang di-include script (`backend/src/domain/entities src/useCase`, `frontend/tests/unit`), sehingga repositori, presentasi, middleware, dan worker backend tidak tercakup sama sekali.
7. **Analisis aksesibilitas UI** bersifat statis (grep `aria-`/`label`/`alt`), bukan audit pembaca layar atau uji keyboard nyata.
