# Kế hoạch 02b · Màn hình đơn hàng

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay màn hình "case desk" của starter bằng màn hình đơn hàng thật: danh sách đơn, trang đơn (thông tin KH & giao nhận có gợi ý KH cũ, Phiếu khảo sát, Danh mục Thiết bị / Dịch vụ, Nhà cung cấp, Kết quả P&L, Đơn mua hàng), P&L tính tức thời khi gõ, lưu đơn và yêu cầu tính P&L chính thức — mỗi vai trò chỉ thấy phần mình được xem.

**Architecture:** Màn hình React trong `src/module/`, theo khuôn của starter (một interface API, bản HTTP qua `host.api`, bản bộ nhớ cho demo / test). Mọi logic thuần đã có ở `src/order/` và `src/pl/` (Kế hoạch 01, 02) — màn hình chỉ gọi. Thêm hai mô-đun thuần mới: `save-plan.ts` (so bản nháp với bản đã lưu → danh sách thao tác ghi) và `access.ts` (vai trò nhìn thấy gì, suy từ những gì máy chủ cho đọc). Lưu xong, màn hình đặt `order.pl_requested_at` để trigger chạy `compute_pl`.

**Tech Stack:** React 19, `@reflexify/agentflow-elements/kit`, `@reflexify/agentflow-sdk`, Vitest + Testing Library (jsdom), Vite (đã có trong starter).

**Spec:** `docs/superpowers/specs/2026-11-02-pl-agentflow-design.md` (Thiết kế) — mục 2, 6.2, 7.2, 10, 13.3–13.6. Đặc tả `docs/source/spec.md` Module 1–5 (FR-1.1–1.7, FR-2.1–2.8, FR-3.1–3.5, FR-4.1–4.6, FR-5.1–5.6), BR-20–BR-23, 4.8. Bố cục: `docs/source/mockup.html` — `renderList` (L1271), `renderDetail` (L5056), `renderInfo` (L1558), `kSug` (L1468), `renderDelivery` (L1605), `renderForm` (L1906), `renderBanMua` (L1802), `specRow` (L1744), `renderSuppliers` (L2732), `renderMHProcure` (L2241), `renderPLview` (L2074).

**Hướng dẫn bắt buộc đọc trước khi viết module:** skill `agentflow-ui-module` (bản trong `C:/Users/thinh/.claude/plugins/cache/agentflow-sdk/agentflow/0.7.0/skills/agentflow-ui-module/`, khớp `sdk-v0.7.0`), `node_modules/@reflexify/agentflow-elements/DESIGN.md` ("Module rules", "Review checklist", Layout).

## Global Constraints

- Mọi quy tắc module của DESIGN.md mục 2: một `<style>` trong shadow root; không selector `:root`/`html`/`body`; token trên root của module; độ rộng bằng `@container`; không listener trên `document`/`window`; id đọc qua `getAppObjects(host.api)` một lần mỗi mount; `host.apiUrl` cho link trình duyệt tự mở. `test/module/styles.test.ts`, `test/module/ui-build.test.ts` giữ nguyên và phải xanh.
- Root class của module: `pl` (đổi mọi `.cases`, `container: pl / inline-size`, `@container pl`).
- `ui.contract` giữ `1` (chưa gọi `host.assistant`).
- Tiếng Việt là ngôn ngữ chính; mọi chữ ở `src/module/text.ts`, đủ `vi` và `en`. Số tiền: dấu chấm hàng nghìn (`21.000.000`), không số lẻ; ngày `dd/mm/yyyy`; tỷ lệ hiển thị `%` nhưng lưu phân số.
- Màn hình **không bao giờ** tự ghi P&L: P&L chính thức chỉ do `compute_pl` ghi; màn hình chỉ đặt `order.pl_requested_at`.
- Nhập liệu đi qua `checkFormat` (Kế hoạch 02, `src/order/formats.ts`); kiểm trước khi lưu bằng `validateOrder(draft, config, 'draft')`, trước khi bấm "Gửi duyệt" (Kế hoạch 03) bằng `'submit'` — 02b hiện banner đếm trường thiếu theo `'submit'` nhưng chỉ chặn lưu khi có lỗi `'draft'`.
- Chỉnh sửa: chỉ AM / SA của đơn (`order.am` / `order.sa` = người đang xem) và chỉ khi `order.status = draft`. Khóa theo giai đoạn đầy đủ là Kế hoạch 03.
- Nguồn KH "Không" lưu là `null` (BR-23 kiểm `lead_source` có giá trị).
- Xóa starter "case desk" trong kế hoạch này: `config/entities/case.json`, `config/build/open-case.mjs`, mục `open_case` trong `agentflow.app.mjs`, `src/module/{CasesScreen,NewCaseDialog,cases-api,http-cases-api,memory-cases-api}.tsx?`, test tương ứng. Sau mỗi thay đổi `config/`: `pnpm build && pnpm exec agentflow-app types`.
- Ngoài phạm vi (ghi rõ ở màn hình bằng chỗ trống, không nút giả): tạo đơn từ file (Kế hoạch 06), ✦ Tra cứu MST (05), khối KPI và huy hiệu việc chờ (07, 03), tab Bảng quy trình, Gửi duyệt, Close-lost (03), Hợp đồng (04), Cấu hình (08), chép dòng từ đơn cũ, số đơn của KH trong gợi ý.

## Review Focus

1. **Lưu bị đứt giữa chừng** (mạng rơi sau khi đã tạo đơn nhưng chưa tạo dòng): bấm Lưu lại thì hoàn tất, không tạo trùng. → test `retry_after_partial_failure_completes` ở Task 2.
2. **`updated_at` cũ** — `compute_pl` vừa ghi `code` lên đơn nên lần lưu sau nhận 409 `STALE_VERSION`: màn hình đọc lại đơn và lưu lại một lần, không báo lỗi với người dùng nếu không có xung đột thật. → test `stale_version_is_retried_once` ở Task 3.
3. **Đổi mã loại một dòng từ hàng hóa sang dịch vụ** sau khi đã có giá: bản ghi giá chuyển sang entity đúng (xóa cũ, tạo mới), không để lại hai bản. → test `moving_group_moves_the_price` ở Task 2.
4. **Người không được xem tiền mở trang đơn** (TM, Mua hàng; hoặc mọi 403/404): không lỗi, tab / cột tiền không hiện, không gọi P&L đầy đủ. → test `tm_sees_services_without_full_pl` ở Task 9.
5. **Gõ số kiểu Việt Nam trong bảng dòng** ("21.000.000", "0,5", "21,000"): hiện đúng, ô sai viền đỏ kèm hướng dẫn, không lưu được khi còn lỗi định dạng. → test `vietnamese_numbers_in_the_grid` ở Task 7.

---

### Task 1: Dọn starter, khung ứng dụng và đường dẫn

**Files:**
- Delete: `config/entities/case.json`, `config/build/open-case.mjs`, `src/module/CasesScreen.tsx`, `NewCaseDialog.tsx`, `cases-api.ts`, `http-cases-api.ts`, `memory-cases-api.ts`, `test/module/cases-screen.test.tsx`, `test/module/http-cases-api.test.ts`
- Modify: `agentflow.app.mjs` (bỏ `openCase`, `exposedSteps`; ORDER `["pl_selftest", "compute_pl"]`), `README.md` / `AGENTS.md` (bỏ câu "case desk objects stay until plan 02 replaces them"), `src/module/mount.tsx` (`ScreenHost` mở rộng `navigate`, `onLocationChange` — `reference/routes.md`; render `App`), `src/module/styles.css` (root `.pl`), `src/module/text.ts` (viết lại), `src/module/demo.tsx`, `module.html` (tiêu đề)
- Create: `src/module/App.tsx`, `src/module/routes.ts`, `src/module/format.ts`
- Test: `test/module/routes.test.ts`, `test/module/format.test.ts`, `test/module/app.test.tsx`

**Interfaces:**
- Produces:
  - `export type Route = { name: 'list' } | { name: 'new' } | { name: 'order'; id: string; tab: TabKey | null };`
  - `export type TabKey = 'form' | 'lines' | 'suppliers' | 'pl' | 'purchase';`
  - `export function parseRoute(path: string): Route` / `export function routePath(route: Route): string` — `/`, `/orders/new`, `/orders/<id>`, `/orders/<id>?tab=<key>`; đường dẫn lạ → `list`.
  - `export function usePath(host: Pick<AppHost, 'onLocationChange'>): string` (như `reference/routes.md`).
  - `format.ts`: `formatMoney(n: number | null): string` ("21.000.000", null → "—"), `formatPercent(fraction: number | null, digits = 1): string` ("8%", "12,6%"), `formatDay(iso: string | null): string` ("05/11/2026"), `formatDateTime(iso)`.
  - `App` nhận `{ host: ScreenHost; api: OrdersApi; element: HTMLElement }` và chọn màn hình theo `parseRoute(usePath(host))`.

- [ ] **Step 1: Write the failing tests**
  - `routes.test.ts`: `parses_each_route` (4 dạng trên + `/x/y` → list); `round_trips` (`routePath(parseRoute(p)) === p`).
  - `format.test.ts`: `formatMoney(21_000_000)` → `"21.000.000"`; `formatMoney(-2_500_000)` → `"-2.500.000"`; `formatMoney(46_272_444.4444)` → `"46.272.444"`; `formatPercent(0.125829)` → `"12,6%"`; `formatPercent(0.08)` → `"8%"`; `formatDay("2026-11-05")` → `"05/11/2026"`.
  - `app.test.tsx`: host thử có `onLocationChange` / `navigate` (theo `reference/routes.md`, "A test host with a working route"); `/` hiện tiêu đề `Danh sách đơn hàng`; `/orders/new` hiện `Tạo đơn hàng mới`.
- [ ] **Step 2:** `pnpm vitest run test/module` → FAIL.
- [ ] **Step 3:** xóa file starter, viết `routes.ts`, `format.ts`, `App.tsx` (màn hình tạm: tiêu đề), sửa `mount.tsx`, `styles.css`, `text.ts`, `demo.tsx`, `agentflow.app.mjs`; `pnpm build && pnpm exec agentflow-app types`.
- [ ] **Step 4:** `pnpm test && pnpm typecheck` → PASS; `pnpm build` in `ui: built`.
- [ ] **Step 5: Commit** — `feat(ui): dọn case desk, khung ứng dụng đơn hàng và đường dẫn`

---

### Task 2: `OrdersApi`, bản bộ nhớ và kế hoạch lưu

**Files:**
- Create: `src/module/orders-api.ts`, `src/module/memory-orders-api.ts`, `src/module/save-plan.ts`, `src/module/demo-data.ts`
- Test: `test/module/save-plan.test.ts`, `test/module/memory-orders-api.test.ts`

**Interfaces:**
- Consumes: `OrderDraft`, `OrderRecords`, `draftFromRecords`, `lineGroup` (`src/order/`), `ConfigRecords`, `configFromRecords`, `PlConfig`.
- Produces (`orders-api.ts`):

```ts
export interface OrderSummary { id: string; code: string; customerName: string; customerCode: string; am: string | null;
  sa: string | null; status: OrderFields['status']; stage: number; createdAt: string;
  revenue: number | null; passed: boolean | null; myLines: number | null; }   // null = this person may not see it
export interface Access { seesPl: boolean; seesGoodsPrices: boolean; seesServicePrices: boolean; seesProposals: boolean;
  seesPlService: boolean; seesPlGoods: boolean; canCreateOrder: boolean; isAdmin: boolean; }
export interface OfficialPl { order_pl: Rec | null; order_pl_service: Rec | null; order_pl_goods: Rec | null; }
export interface Person { id: string; name: string; }
export interface StaffMember { id: string; code: string; name: string; user: string | null; team: string; active: boolean; }
export interface CustomerHit { id: string; code: string; name: string; taxCode: string; address: string; tier: CustomerTier | null; record: Rec; }
export interface LoadedOrder { draft: OrderDraft; records: OrderRecords; official: OfficialPl; proposals: Rec[]; }
export interface OrdersApi {
  me(): Person;
  access(): Promise<Access>;
  config(): Promise<ConfigRecords>;
  staff(): Promise<StaffMember[]>;
  suppliers(): Promise<Rec[]>;
  createSupplier(input: { name: string; contact_name?: string; phone?: string }): Promise<Rec>;
  list(): Promise<OrderSummary[]>;
  load(id: string): Promise<LoadedOrder>;
  findCustomers(text: string): Promise<CustomerHit[]>;                 // ≥ 2 ký tự; tối đa 6
  previousOrders(customerId: string, beforeId: string | null): Promise<{ id: string; code: string; finance: FinanceFields; pl: Rec | null }[]>;
  save(draft: OrderDraft, saved: OrderRecords | null, config: PlConfig): Promise<LoadedOrder>;  // chạy savePlan, rồi requestPl
  saveProposal(lineId: string, orderId: string, fields: { proposed_cost: number | null; proposed_supplier: string | null; note: string }): Promise<Rec>;
  deleteOrder(id: string): Promise<void>;
}
export class OrdersError extends Error { constructor(readonly code: string, readonly reason: string | null) }
```

- Produces (`save-plan.ts`):

```ts
export type SaveOp =
  | { kind: 'create'; entity: 'order' | 'order_line' | 'goods_line_price' | 'service_line_price' | 'order_finance'; key: string; body: Rec }
  | { kind: 'patch'; entity: string; id: string; changes: Rec }
  | { kind: 'delete'; entity: string; id: string };
export function savePlan(draft: OrderDraft, saved: OrderRecords | null, config: PlConfig): SaveOp[];
```
  Thứ tự: đơn (create hoặc patch, `deal_stages` luôn trong patch sau create vì form không nhận list — Kế hoạch 02 Task 5) → `order_finance` → dòng (create / patch / delete) → giá (create / patch / delete; giá đi theo nhóm của mã loại: đổi nhóm = delete giá cũ + create giá mới). `key` của create là id tạm (`new:<n>`) để thao tác sau tham chiếu (`order`, `order_line` trỏ `new:…` được thay bằng id thật khi chạy). Chỉ patch trường thực sự đổi; không có gì đổi → `[]`. Patch đơn **không** chứa `pl_requested_at` (do `save` đặt sau cùng).

- `memory-orders-api.ts`: lưu bản ghi trong bộ nhớ với hình dạng như API (`{ id, body, updated_at }`), chạy `savePlan` thật, mô phỏng `compute_pl` bằng `runComputeOrderPl` khi `pl_requested_at` đổi; tùy chọn `{ failAfter?: number; access?: Partial<Access>; me?: Person }` để test lỗi giữa chừng và vai trò. `demo-data.ts`: đơn TM-1040 (từ `test/order/fixtures/tm1040-records.ts`, chép giá trị), một đơn dịch vụ Cloud Server 12 tháng, 3 khách hàng, 2 NCC, nhân sự `ThuanNG` (sales), `ThuDTH` (sa), `Mkt` (lead_source).

- [ ] **Step 1: Write the failing tests** `save-plan.test.ts`
  - `new_order_creates_in_dependency_order`: bản nháp mới 2 dòng TB → ops: create order, patch order (`deal_stages`), create order_finance, create 2 order_line, create 2 goods_line_price; `order_line.body.order === 'new:order'`.
  - `unchanged_draft_has_no_ops` (lưu xong lưu lại → `[]`).
  - `only_changed_fields_are_patched`: đổi `customer_name` → một patch `{ customer_name }`.
  - `deleted_line_deletes_line_and_price`.
  - `moving_group_moves_the_price` (Review Focus 3): TB → Cloud Server → delete goods_line_price + create service_line_price.
  - `memory-orders-api.test.ts`: `retry_after_partial_failure_completes` (Review Focus 1): `failAfter: 3` → `save` ném `OrdersError`; gọi lại `save` với bản ghi đã có (đọc lại bằng `load`) → đơn đủ 2 dòng, 2 giá, không trùng; `save_requests_pl_and_official_matches_excel`: lưu TM-1040 → `load` → `official.order_pl.net_profit` `toBeCloseTo(46_272_444.44, 2)`.
- [ ] **Step 2:** FAIL. **Step 3:** viết 4 file. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(ui): OrdersApi, bản bộ nhớ và kế hoạch lưu đơn`

---

### Task 3: `OrdersApi` qua HTTP và quyền nhìn thấy

**Files:**
- Create: `src/module/http-orders-api.ts`, `src/module/access.ts`
- Test: `test/module/http-orders-api.test.ts`, `test/module/access.test.ts`

**Interfaces:**
- Consumes: `OrdersApi`, `savePlan`, `getAppObjects`, `ok`, `AgentFlowError` (SDK); `reference/records-api.md` (query, PATCH với `expected_updated_at`, DELETE, lỗi).
- Produces:
  - `export function createHttpOrdersApi(host: Pick<AppHost, 'api' | 'context'>): OrdersApi`. Id entity đọc qua `getAppObjects` một lần (cache của SDK). Bản ghi API mang trường trong `body` (Kế hoạch 02, Task 9) — đọc qua `fieldsOf` / `draftFromRecords`. `list()` = query `order` (sắp `created_at` desc, mọi trang) + query `order_pl` nếu `seesPl` (gộp theo `order`) + đếm dòng theo nhóm cho TM / Mua hàng. `findCustomers` = query `customer` với `filter.q`, `limit: 6`. Mỗi `PATCH` lấy `expected_updated_at` từ bản ghi đã đọc; 409 `STALE_VERSION` → đọc lại bản ghi đó, áp lại đúng `changes`, thử **một** lần (Review Focus 2). `save` chạy các `SaveOp` tuần tự, thay id tạm bằng id thật, rồi PATCH `order.pl_requested_at = new Date().toISOString()`, rồi `load`.
  - `access.ts`: `export async function probeAccess(api): Promise<Access>` — mỗi cờ `sees*` = một query `limit: 1` lên entity tương ứng trả 200 (403 / 404 → false); `canCreateOrder` = người xem có bản ghi `staff` (`user` = mình) với `team` `sales` hoặc `sa`; `isAdmin` = query `order_pl` trả 200 **và** `purchase_proposal` 403/404 **và** không có staff sales/sa — chỉ dùng để hiện nút Xóa (máy chủ vẫn quyết định).
  - `export function tabsFor(access: Access, isEditor: boolean): TabKey[]` — theo `ROLETABS` của mockup (L1227), bỏ `flow`: người sửa (AM/SA của đơn) `['form', 'lines', 'suppliers', 'pl']`; `seesPl && seesProposals` (SD, Kế toán) `['pl', 'lines', 'purchase', 'suppliers', 'form']`; `seesPl && !seesProposals` (Admin, AM/SA không phải của đơn) `['pl', 'lines', 'suppliers', 'form']`; `!seesPl && (seesProposals || seesServicePrices)` (Mua hàng, Kỹ thuật) `['purchase']`.
  - `export function isEditor(order: OrderFields, me: Person): boolean` — `order.status === 'draft'` và (`order.am === me.id` hoặc `order.sa === me.id`).

- [ ] **Step 1: Write the failing tests** (giả `host.api` như test HTTP của starter làm — `git show d552b73:test/module/http-cases-api.test.ts`, file bị xóa ở Task 1: một hàm fetch trả theo đường dẫn)
  - `http-orders-api.test.ts`: `ids_are_read_once_per_api`; `records_are_read_from_body`; `stale_version_is_retried_once` (409 lần đầu, 200 lần hai → thành công; 409 hai lần → `OrdersError('STALE_VERSION', …)`); `save_sets_pl_requested_at_last`; `refusal_reason_is_agentflows_sentence` (detail `ENTITY_VALIDATION_RULE_FAILED: …` → reason không còn mã).
  - `access.test.ts`: `probe_maps_403_and_404_to_false`; `tabs_by_role` (4 trường hợp trên); `editor_only_in_draft`.
- [ ] **Step 2:** FAIL. **Step 3:** viết. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(ui): OrdersApi qua HTTP, thử quyền đọc để chọn tab`

---

### Task 4: Danh sách đơn hàng

**Files:**
- Create: `src/module/OrderListScreen.tsx`
- Modify: `src/module/App.tsx`, `src/module/text.ts`, `src/module/styles.css`
- Test: `test/module/order-list.test.tsx`

**Interfaces:**
- Consumes: `OrdersApi.list`, `access`, `staff`, `deleteOrder`; `formatMoney`, `formatDay`; `routePath`.
- Hành vi (FR-1.1, 1.2, 1.5, 1.7; mockup `renderList`):
  - Tiêu đề `Danh sách đơn hàng`; nút chính `+ Tạo đơn hàng mới` khi `canCreateOrder` → `/orders/new`.
  - Thanh lọc: kỳ `Tất cả / Năm / Quý / Tháng / Tuần` (theo `createdAt`, kỳ hiện tại, nút `‹ ›`), trạng thái `Mọi trạng thái / Nháp / Đang xử lý / Hoàn tất / Close-lost`, `Tất cả AM` (chỉ khi `seesPl && seesProposals` hoặc `isAdmin`, danh sách từ `staff` team sales); lọc ở máy khách (BR-35 kỳ).
  - Cột: `Mã đơn` (mã, hoặc `Nháp` khi chưa có), `Khách hàng` (tên, dưới là mã KH · ngày), `Phụ trách` (tên AM theo `staff.user`, dưới `SA:`), `Trạng thái` (tag theo `status`, `GĐ n/7`), rồi `Doanh thu (VNĐ)` khi `seesPl` / `Dòng thuộc bạn` khi Mua hàng hoặc Kỹ thuật; `Kết quả P&L` (Đạt / Không đạt) khi `seesPl && seesProposals`; nút Xóa khi `isAdmin` (hộp xác nhận, FR-1.7).
  - Bấm dòng → `/orders/<id>`. Các trạng thái tải / rỗng / lỗi theo starter (skeleton sau 150 ms; rỗng `Không có đơn hàng nào khớp bộ lọc.`; lỗi kèm lý do và `Thử lại`). Bảng gập dưới 720 px (`@container pl`).
- [ ] **Step 1: Write the failing tests** — `lists_orders_newest_first`; `revenue_hidden_without_pl_access` (`access.seesPl = false` → không có cột `Doanh thu`); `filters_by_status_and_period`; `new_button_only_for_sales`; `admin_deletes_after_confirm`; `empty_and_error_states` (vi + en).
- [ ] **Step 2:** FAIL. **Step 3:** viết. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(ui): danh sách đơn hàng theo vai trò`

---

### Task 5: Trang đơn — khung, thông tin KH & giao nhận, gợi ý KH cũ, tạo đơn

**Files:**
- Create: `src/module/OrderPage.tsx`, `src/module/useOrderDraft.ts`, `src/module/CustomerCard.tsx`, `src/module/DeliveryCard.tsx`, `src/module/Field.tsx`
- Test: `test/module/order-page.test.tsx`, `test/module/customer-card.test.tsx`

**Interfaces:**
- Consumes: `OrdersApi.load/config/access/save/findCustomers`, `validateOrder`, `checkFormat`, `computePl`, `toPlOrderInput`, `configFromRecords`, `tabsFor`, `isEditor`.
- Produces:
  - `export function useOrderDraft(api: OrdersApi, id: string | null): { state: 'loading' | 'ready' | 'error'; draft: OrderDraft; saved: LoadedOrder | null; config: PlConfig; live: PlResult; issues: FieldIssue[]; missing: number; dirty: boolean; set(path: string, raw: string | boolean | null): void; setDraft(fn: (d: OrderDraft) => OrderDraft): void; save(): Promise<void>; saving: boolean; error: string | null }` — `set` chạy `checkFormat` theo loại của trường (bảng `FIELD_KINDS` trong hook, khóa theo đường dẫn), giữ chuỗi gõ dở cho ô lỗi; `live` = `computePl(toPlOrderInput(draft), config)` mỗi lần đổi; `issues` = `validateOrder(draft, config, 'submit')`; lưu bị chặn khi `validateOrder(…, 'draft')` còn lỗi. Đơn mới: `am` = `me().id` khi `canCreateOrder` và staff team `sales`; SA tạo thì bắt chọn AM và `sa` = mình (Kế hoạch 02: `am` bắt buộc); `deal_stages` mặc định 6 giai đoạn, người = mã NV của AM (giai đoạn `contract` = Inside Sales nếu có — BR-30, mockup `STAGE_DEFS`); `is_new_order` true.
  - `Field`: nhãn, `*` khi bắt buộc, ô nhập, viền đỏ + câu hướng dẫn khi có issue cho đường dẫn đó (`aria-invalid`, `aria-describedby`).
- Hành vi (FR-1.6, 1.6a, 1.6c; mockup `renderDetail`, `renderInfo`, `kSug`, `renderDelivery`):
  - Đầu trang: tên KH (tiêu đề), mã đơn, tag `Nháp`, `AM · <tên>`, `IS · <tên>`; nút `Lưu` (chính) khi là người sửa, `Đang lưu…` khi bận, khóa khi không có thay đổi hoặc còn lỗi định dạng (`aria-disabled` + lý do). Sau khi lưu: toast `Đã lưu. Đang tính P&L…`.
  - Thẻ `Thông tin khách hàng` thu gọn được (`▾ Thu gọn` / `▸ Mở rộng`), lưới 3 cột (gập 1 cột dưới 720 px): `Tên khách hàng*`, `Mã khách hàng*`, `Mã số thuế*`, `Địa chỉ`, `Người liên hệ*`, `Điện thoại liên hệ`, `Email`, `Người đại diện`, `Chức vụ`, `Số tài khoản`, `Ngân hàng`, `Ngày báo giá`, `Hiệu lực đến`, `Tỷ giá`; banner `Còn N trường bắt buộc chưa điền ở Thông tin khách hàng.`
  - Gợi ý KH cũ: gõ ≥ 2 ký tự ở Tên / Mã KH / MST → `findCustomers` (chờ 250 ms sau phím cuối), tối đa 6 dòng: **tên** · mã · tag hạng, dòng dưới `MST … · địa chỉ`; ↑↓ + Enter chọn, Esc đóng (listener trên ô, không trên `document`); chân `↑↓ chọn · Enter để điền · Esc để đóng`; không có → `Không có KH cũ khớp — sẽ tạo khách hàng mới.` Chọn: điền các trường **đang trống** từ hồ sơ (`customer`), đặt `order.customer`, `customer_tier`; trường đã nhập mà khác hồ sơ hiện bảng `Chọn giữ / cập nhật` (FR-1.6a; ghi "Bỏ qua gợi ý" vào lịch sử là Kế hoạch 03).
  - Thẻ `Thông tin giao nhận hàng`: `Người nhận hàng`, `Số điện thoại`, `Địa chỉ nhận hàng`, `Ghi chú giao hàng`; nút nhanh `Người nhận = người liên hệ`, `Địa chỉ nhận = địa chỉ KH`.
  - Thanh tab bên dưới theo `tabsFor` (hàng ngang trên ≥ 720 px, menu chọn dưới 720 px; tab hiện tại ở `?tab=`, mặc định tab đầu). Nội dung tab ở Task 6–9.
  - Không phải người sửa: mọi ô chỉ đọc (văn bản, không input).
- [ ] **Step 1: Write the failing tests**
  - `order-page.test.tsx`: `new_order_defaults_am_and_stages` (`me` là sales `ThuanNG` → `am` = mình, 6 giai đoạn người `ThuanNG`); `save_creates_then_navigates` (Lưu trên `/orders/new` → `navigate('/orders/<id>')`, toast); `save_locked_while_format_errors` (MST `123` → nút Lưu `aria-disabled`, lý do đọc được); `readonly_for_non_editor`; `missing_banner_counts_customer_fields`.
  - `customer-card.test.tsx`: `suggests_after_two_chars`; `enter_fills_empty_fields_only`; `differing_field_asks_to_keep_or_update`; `escape_closes`.
- [ ] **Step 2:** FAIL. **Step 3:** viết. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(ui): trang đơn, thông tin khách hàng và giao nhận, gợi ý KH cũ`

---

### Task 6: Tab Phiếu khảo sát

**Files:**
- Create: `src/module/tabs/SurveyTab.tsx`
- Test: `test/module/survey-tab.test.tsx`

**Interfaces:**
- Consumes: `useOrderDraft` (`draft`, `set`, `setDraft`, `issues`, `live`), `staff`, `previousOrders`, `chooseWeightSet`, `DEFAULT_CONFIG.dealStageWeights` (qua `config`).
- Hành vi (FR-2.1–2.8, BR-20–23, Thiết kế 13.3, 13.5; mockup `renderForm`):
  - `Thông tin đơn hàng`: `Số HĐ nội bộ*`, `Số HĐ / PO khách hàng`, `Nội dung đơn hàng*`, `Ngày ký`, `AM phụ trách*` (chọn từ `staff` team sales, lưu `staff.user`; người sửa là AM thì chỉ đọc), `Sales Admin`, `Inside Sales` (staff team sa / sales), `Có phải đơn hàng mới?` (Có / Không), `Khách hàng mới (new logo)?`.
  - Đơn tái ký (`is_new_order = false`): `Lấy số liệu từ đơn trước của KH` (chọn trong `previousOrders(customer)`, điền 4 ô từ `finance` / `pl` của đơn đó — BR-22), `Số HĐ / PO năm trước*`, `CPBH năm trước (đ)*`, `Doanh thu năm trước (đ)*`, `LN thuần năm trước (đ)*`; `Nguồn khách hàng` tự đặt `Không` và khóa (BR-23).
  - `Nguồn khách hàng (Không = KH cũ)` (staff team `lead_source` hoặc `sales`, lưu mã NV, `Không` = null), `Hạng khách hàng*` (`VIP — Loại I` / `Tiềm năng — Loại II` / `Phổ thông — Loại III`), `Số ngày công nợ*`, `Chi phí bán hàng (đ)*`, `NV triển khai` và `NV tư vấn` (staff, có `Không`), `Hạng mục tư vấn` `Proposal` / `PoC` (chỉ khi có NV tư vấn), `Sử dụng chi phí dự phòng?` (Có / Không — bù tự động, Thiết kế 6.5; số dư quỹ ở Kế hoạch 07), `Số lần thanh toán`, `KH tạm ứng trước khi giao / triển khai?`.
  - `Loại hợp đồng (tự nhận)`: chip từ `live.contractTypes`; `Loại HĐ áp ngưỡng LN`: chọn trong các loại đó **và** `Fulfillment` (13.5), mặc định trống = loại doanh thu lớn nhất (hiện tên loại đang áp từ `live.appliedContractType`).
  - `Phân bổ giai đoạn deal` (thu gọn được): bảng `Giai đoạn | Người phụ trách | Hệ số`; hệ số **chỉ đọc**, lấy từ bộ hệ số cấu hình đang áp (`live.weightSet`) — tổng hiện `100%` (đơn mới) / `50%` (tái ký); hàng có hệ số 0 mờ đi; người chọn từ staff (mã NV). Hàng Lead hiện khi `is_new_logo` với người = Nguồn KH.
  - Banner `Còn N trường bắt buộc chưa điền — các ô viền đỏ bên dưới.` (đếm issue `order.*` / `finance.*` của tab này).
- [ ] **Step 1: Write the failing tests** — `renewal_shows_last_year_and_locks_lead_source`; `fill_from_previous_order`; `consult_ticks_only_with_consultant`; `weights_follow_the_configured_set` (đơn mới tổng 100%, tái ký 50%, không có ô sửa hệ số); `fulfillment_is_always_offered`; `banner_counts_this_tab`.
- [ ] **Step 2:** FAIL. **Step 3:** viết. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(ui): tab phiếu khảo sát`

---

### Task 7: Tab Danh mục Thiết bị / Dịch vụ

**Files:**
- Create: `src/module/tabs/LinesTab.tsx`, `src/module/tabs/NumberCell.tsx`
- Test: `test/module/lines-tab.test.tsx`

**Interfaces:**
- Consumes: `useOrderDraft`, `live.lines` (`PlLineResult` theo `id`), `config.itemTypes`, `config.vatRates`, `suppliers`, `createSupplier`, `checkFormat`.
- Hành vi (FR-3.1–3.5, FR-4.1; mockup `renderBanMua`, `specRow`):
  - Thẻ `Tổng hợp doanh thu – giá vốn`: Doanh thu, Giá vốn, Lợi nhuận gộp × `Trước VAT / VAT / Sau VAT / Tỷ lệ` (từ `live`).
  - Bảng dòng, cột: `STT` (▸ mở rộng), `Loại` (chọn trong `config.itemTypes` đang dùng), `CO/CQ` (chỉ TB), `Hàng hóa / Dịch vụ*`, `ĐVT*`, `Số lượng*`, `Thời hạn / Bảo hành (tháng)`, `Đơn giá bán (VNĐ)*`, `Thành tiền (VNĐ)`, `Đơn giá mua (VNĐ)`, `Thành tiền mua (VNĐ)`, `LN gộp (VNĐ)`, `Tỷ suất LN gộp / giá vốn`, `Nhà cung cấp đề xuất*`, `Ghi chú`, nút xóa (`aria-label` "Xóa dòng N"). Hàng `Tổng`. Bảng cuộn ngang trong vùng của nó (không cuộn cả trang) dưới 1200 px.
  - ▸ mở rộng: `Chiết khấu (%)`, `VAT` (chọn `config.vatRates`, mặc định mức `isDefault`), `SKU`, `Thông số kỹ thuật`, `Ngày bắt đầu` / `Ngày kết thúc` (loại `termed`), `Thời gian giao hàng`, `Ưu tiên NCC` (Không / Hỗ trợ / Chỉ định), `End User`.
  - `NumberCell`: hiện `formatMoney` khi không sửa, nhận chuỗi gõ (`checkFormat('money' | 'quantity' | 'months' | 'percent')`), ô sai viền đỏ + câu hướng dẫn, giữ chuỗi gõ dở.
  - `+ Thêm dòng` (mặc định loại TB, SL 1, VAT mặc định); NCC: chọn trong danh sách, mục cuối `+ Thêm NCC mới…` mở form gọn (Tên NCC, Người liên hệ, SĐT, `Lưu NCC mới`) gọi `createSupplier`.
  - Công tắc `Gộp theo NCC`: sắp dòng theo NCC, chèn hàng đầu nhóm `<NCC> · N sản phẩm · Tổng giá vốn …`.
  - Banner `N dòng còn thiếu trường bắt buộc.` (issue `lines[*]`); mã loại lạ (từ dữ liệu cũ) hiện cảnh báo trên dòng.
- [ ] **Step 1: Write the failing tests** — `line_totals_follow_the_engine` (TM-1040: dòng 1 thành tiền `252.000.000`, tổng doanh thu `420.000.000`); `monthly_service_multiplies_months`; `vietnamese_numbers_in_the_grid` (Review Focus 5: gõ `21.000.000` → hiện `21.000.000`, lưu số `21000000`; `21,000` → viền đỏ, nút Lưu khóa); `co_cq_only_for_tb`; `termed_type_shows_dates`; `add_supplier_inline`; `group_by_supplier`; `delete_line`.
- [ ] **Step 2:** FAIL. **Step 3:** viết. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(ui): tab danh mục thiết bị / dịch vụ, tính tức thời từng dòng`

---

### Task 8: Tab Kết quả P&L và tab Nhà cung cấp

**Files:**
- Create: `src/module/tabs/PlTab.tsx`, `src/module/tabs/SuppliersTab.tsx`
- Test: `test/module/pl-tab.test.tsx`, `test/module/suppliers-tab.test.tsx`

**Interfaces:**
- Consumes: `live: PlResult`, `saved.official`, `draft`, `config`, `access`, `suppliers`.
- Hành vi PL (FR-5.1–5.6; mockup `renderPLview`):
  - Người sửa xem **số tính tức thời** (`live`); người khác xem **số chính thức** (`official.order_pl`, đọc `detail` / `kpi_split` JSON). Khi người sửa có số chính thức: dòng `Số chính thức tính lúc <ngày giờ>`; khác số tức thời (lệch > 1 VNĐ ở `net_profit`) hoặc chưa có → `Chưa tính lại — bấm Lưu để tính P&L chính thức.`; `locked` → `Đã chốt số liệu (nhập từ Excel) — không tính lại.`
  - Thẻ: `Kết quả P&L` (Đạt / Không đạt ngưỡng LN — chữ và biểu tượng, không chỉ màu), `Tỷ suất LN thuần / giá vốn`, `Ngưỡng LN tối thiểu` (tooltip: ngưỡng loại HĐ + phần cộng công nợ), `Doanh thu chưa VAT`, `LN thuần`.
  - `Báo cáo P&L đơn hàng`: Doanh thu (chưa VAT), Giá vốn (chưa VAT), Lợi nhuận gộp (%), − Chi phí bán hàng, − Chi phí tài chính, LN sau CPBH & CP tài chính, ▸ − Chi phí khác (mở: bảo hành, hỗ trợ license, hỗ trợ kỹ thuật, thưởng triển khai, thưởng tư vấn, dự phòng), + Bù từ quỹ dự phòng (khi > 0), Lợi nhuận thuần. Nút `▸ Xem công thức` thêm cột `Cách tính` (chuỗi theo Đặc tả 4.2 kèm tham số đang áp: r, tỷ lệ, ngưỡng).
  - `Doanh thu – giá vốn theo loại` (từ `byType`; chỉ khi `seesProposals && seesPl` — SD, Kế toán, như mockup).
  - `Chia chỉ tiêu kinh doanh (KPI)`: `Nhân sự | Giai đoạn & hệ số | Chỉ tiêu KD ghi nhận (VNĐ)` (tên theo mã NV từ `staff`).
  - `So sánh PO năm trước / năm nay` khi tái ký: Số HĐ / PO, CPBH, Doanh thu, LN thuần.
- Hành vi Nhà cung cấp (FR-4.1; mockup `renderSuppliers`): NCC được các dòng của đơn dùng: `Tên nhà cung cấp | Người liên hệ | Số điện thoại | Email | Thanh toán` (từ `payment_terms`), chỉ đọc (sửa NCC là việc của trang NCC sau này).
- [ ] **Step 1: Write the failing tests** — `tm1040_live_figures` (LN thuần `46.272.444`, `Đạt ngưỡng LN`, ngưỡng `8%`); `other_costs_collapse`; `formula_column_toggles`; `reader_sees_official_not_live`; `stale_official_is_flagged`; `locked_is_shown`; `renewal_comparison`; `suppliers_of_this_order_only`.
- [ ] **Step 2:** FAIL. **Step 3:** viết. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(ui): tab kết quả P&L và nhà cung cấp`

---

### Task 9: Tab Đơn mua hàng (Mua hàng, Kỹ thuật, SD / Kế toán)

**Files:**
- Create: `src/module/tabs/PurchaseTab.tsx`, `config/build/request-pl.mjs`
- Modify: `agentflow.app.mjs` (ORDER thêm `request_pl_on_proposal`, `request_pl_on_proposal_update`)
- Test: `test/module/purchase-tab.test.tsx`, `test/order/request-pl-workflow.test.ts` (đọc `package/objects/`: hai workflow chạy bằng `automation_principal`, không có start grant, mỗi cái một trigger trên `purchase_proposal`, bước `update` ghi `pl_requested_at` lên đơn của đề xuất); thêm vào `e2e/orders.sandbox.test.ts` ca `proposal_triggers_recompute` (Mua hàng sửa `proposed_cost` → `order_pl_goods.proc_saving` đổi trong 120 s)

**Interfaces:**
- Consumes: `LoadedOrder` (`draft.lines` với `price.source`, `official.order_pl_goods` / `order_pl_service`, `proposals`), `access`, `saveProposal`, `lineGroup`.
- Hành vi (FR-4.2–4.6, Thiết kế 13.4; mockup `renderMHProcure`, `renderTechSpecView`):
  - **Hàng hóa** (khi `seesGoodsPrices`): thẻ `KPI mua hàng` (Tiết kiệm / Vượt giá = `proc_saving`, `Giá vốn Sale đề xuất`, `Giá vốn Mua hàng đề xuất`, %) từ `order_pl_goods`; bảng dòng hàng hóa: STT, Loại, CO/CQ, Hàng hóa, ĐVT, SL, Thời hạn, `Đơn giá mua — Sale đề xuất`, `Thành tiền`, `NCC đề xuất`, rồi khi `seesProposals`: `Đơn giá mua đề xuất — Mua hàng`, `NCC đề xuất — Mua hàng`, `Thành tiền đề xuất`, `Chênh lệch so với Sale`, `Ghi chú`. Ô Mua hàng sửa được khi người xem là Mua hàng (`seesProposals && !seesPl`) — lưu từng dòng bằng `saveProposal`. Mua hàng không sửa được đơn nên không tự đặt `pl_requested_at`: workflow mới `request_pl_on_proposal` (trigger `entity_record` trên `purchase_proposal`, `created` — và một workflow thứ hai `request_pl_on_proposal_update` cho `updated`, vì mỗi workflow tối đa một trigger; cùng một hàm dựng trong `config/build/request-pl.mjs`), chạy bằng `automation_principal`, start access `NOBODY`, một bước `update` đơn `subject.record.order` đặt `pl_requested_at = NOW` → trigger của `compute_pl` chạy tiếp. Màn hình hiện `KPI mua hàng đang được tính lại…` cho tới khi `order_pl_goods.computed_at`… mới hơn (đọc lại sau 5 s, tối đa 60 s). Nhãn `Phần đề xuất chỉ Mua hàng, SD, Kế toán xem.` README: Admin bật thêm hai trigger này.
  - **Dịch vụ** (khi `seesServicePrices`): thẻ từ `order_pl_service` (Doanh thu, Giá vốn, LN gộp dịch vụ; một lần / định kỳ; nội bộ / thuê ngoài); bảng `STT | Tên hàng / dịch vụ | Loại | ĐVT | SL | Đơn giá mua | Thời hạn | Nhà cung cấp | Giá vốn`.
  - **Thông số kỹ thuật** (Kỹ thuật, FR-4.5): danh sách dòng hàng hóa với SKU, thông số, không có giá.
  - Dòng có giá nằm sai entity (`misplacedPrices` trong `order_pl.detail`, hoặc `price.source ≠ lineGroup`) hiện cảnh báo cho người sửa ở tab Danh mục, và màn hình chuyển giá khi lưu (Task 2).
- [ ] **Step 1: Write the failing tests** — `procurement_edits_proposals_and_sees_saving`; `tm_sees_services_without_full_pl` (Review Focus 4: `access` của TM → tab `Đơn mua hàng` duy nhất, không có `Kết quả P&L`, không gọi đọc `order_pl`, thấy giá vốn dịch vụ và thông số TB không giá); `director_reads_proposals_without_editing`.
- [ ] **Step 2:** FAIL. **Step 3:** viết. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(ui): tab đơn mua hàng cho Mua hàng, Kỹ thuật, SD / Kế toán`

---

### Task 10: Rà soát trên trình duyệt và trên sandbox

**Files:**
- Create: `e2e/module.sandbox.test.ts`
- Modify: `src/module/demo.tsx` (nếu rà soát cần), `docs/sdk-feedback.md` (vướng mắc mới)

- [ ] **Step 1:** `pnpm test && pnpm typecheck && pnpm build` → xanh, `ui: built`.
- [ ] **Step 2: Rà soát demo** — `pnpm demo` (`http://localhost:5174/module.html`, trong trình duyệt của phiên), đi hết danh sách → đơn TM-1040 → từng tab; trả lời `reference/checklist.md` của skill UI ở sáng / tối, vi / en, 1280 px và 800 px, một lần với màu chính đỏ (skill, bước 11). Ghi mục nào kiểm bằng mắt, mục nào **chưa kiểm**.
- [ ] **Step 3: Write** `e2e/module.sandbox.test.ts` theo `reference` của skill release, "Checking a module without a browser": đăng nhập `am`, `GET /api/v1/apps/<key>/module` → `ready`; `outsider` → `not_assigned`; `GET …/objects` có `entity:order`, `workflow:compute_pl` ở trạng thái `live`.
- [ ] **Step 4:** `pnpm af deploy --sandbox` (tạo mới — `case` bị xóa) → `pnpm test:sandbox` → mọi test PASS. Mở `pnpm sandbox open --as am`, tạo một đơn TB qua màn hình, lưu, thấy P&L chính thức xuất hiện (ghi kết quả vào hand-off, không tự động hóa).
- [ ] **Step 5: Commit** — `test: rà soát màn hình đơn hàng trên demo và sandbox`

---

### Task 11: Tài liệu và đóng kế hoạch

**Files:**
- Modify: `README.md`, `AGENTS.md` (bỏ mô tả case desk; phần module: các màn hình, `OrdersApi`, `save-plan`, `access`; `pnpm demo` với dữ liệu mẫu TM-1040), `docs/superpowers/plans/2026-11-03-00-roadmap.md` (02b xong; ghi lại những gì để cho 03: nút Gửi duyệt dùng `validateOrder(…, 'submit')`, khóa sửa theo giai đoạn, tab Bảng quy trình)

- [ ] **Step 1:** sửa tài liệu.
- [ ] **Step 2:** `pnpm typecheck && pnpm test` → PASS.
- [ ] **Step 3: Commit & push** — `docs: cập nhật tài liệu sau kế hoạch 02b`; `git push`.
