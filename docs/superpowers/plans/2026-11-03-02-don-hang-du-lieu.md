# Kế hoạch 02 · Đơn hàng: dữ liệu, quyền, `compute_pl`, kiểm định dạng

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đơn hàng có đủ entity (đơn, dòng, giá hàng hóa / dịch vụ, tài chính, đề xuất mua, 3 entity P&L), phân quyền theo vai trò kiểm ở máy chủ, workflow `compute_pl` tính và ghi P&L chính thức từ bản ghi thật, và thư viện kiểm định dạng / kiểm bắt buộc thuần TypeScript — đủ để Kế hoạch 02b dựng màn hình lên trên.

**Architecture:** `src/order/` là thư viện thuần (không React, không I/O): `types.ts` (`OrderDraft`), `records.ts` (bản ghi ↔ `OrderDraft` ↔ `PlOrderInput`), `formats.ts` (4.8), `validate.ts` (`validateOrder`), `pl-records.ts` (kết quả engine → 3 bản ghi P&L). Workflow `compute_pl` chạy bằng service principal: đọc bản ghi bằng các bước search, một Code step (`config/code/compute_order_pl.js`, bundle từ `src/order/code-entry.ts`) tính, rồi upsert 3 entity P&L và cập nhật mã đơn. Màn hình (02b) gọi đúng các hàm này để tính tức thời và kiểm trước khi lưu.

**Tech Stack:** TypeScript, Vitest, esbuild, `@reflexify/agentflow-app-builder` `sdk-v0.7.0`, `@reflexify/agentflow-sdk/testing` (sandbox).

**Spec:** `docs/superpowers/specs/2026-11-02-pl-agentflow-design.md` (Thiết kế) — mục 2, 3 (C2, C3), 5, 6.2, 7.2, 13.4, 13.6. Đặc tả `docs/source/spec.md`: Module 1–5, BR-20–BR-23, BR-53, Phần 4.8.

**Đã kiểm ở Kế hoạch 01 (sandbox 03/11/2026):** trường `percent` lưu phân số; danh sách bản ghi qua API trả trường ở cấp trên cùng của mỗi item; tạo bản ghi qua API đi qua `create_form` của entity; người ngoài mọi grant nhận `403`.

## Global Constraints

- Mọi quy ước của Kế hoạch 01 giữ nguyên: VNĐ chưa VAT, không làm tròn trong engine; tỷ lệ lưu phân số (`0.1` = 10%) — kể cả `discount_pct`, `vat_rate` của dòng; ô nhập 0–100 ở màn hình được đổi sang phân số trước khi lưu.
- Khóa entity / trường chữ thường `[a-z0-9_]`, tên file = key; mọi entity `access.mode = "restricted"`; nhãn tiếng Việt.
- Không entity nào chứa tiền mà vai trò không được xem (C2): tiền dịch vụ ở `service_line_price` / `order_pl_service`, tiền hàng hóa ở `goods_line_price` / `order_pl_goods`, giá đề xuất của Mua hàng ở `purchase_proposal`, P&L đầy đủ ở `order_pl`. `order`, `order_line` **không có trường tiền** (trừ `exchange_rate`).
- `order_pl*` chỉ workflow ghi (automation group); AM / SA chỉ đọc.
- Một dòng thuộc nhóm `goods` hay `service` theo `item_type.purchase_group` của mã loại (Thiết kế 6.2).
- Người trong giai đoạn deal và nguồn KH lưu bằng **mã nhân viên** (`staff.code`, chữ) — engine chia KPI theo chuỗi này; nhân sự triển khai / tư vấn là reference tới `staff`.
- Sau mỗi thay đổi `config/`: `pnpm build && pnpm exec agentflow-app types`; commit `config/`, `package/`, `src/generated/app.ts` cùng nhau. `config/code/*.js` sinh tự động, không sửa tay.
- Starter "case desk" giữ nguyên trong kế hoạch này; Kế hoạch 02b xóa nó cùng lúc thay màn hình.
- Mỗi vướng mắc SDK mới → mục `F-xx` trong `docs/sdk-feedback.md` cùng commit.

## Review Focus

1. **Đổi mã loại giữa hàng hóa và dịch vụ sau khi đã nhập giá** (bản ghi giá còn nằm ở entity cũ): engine vẫn lấy đúng giá theo dòng, từ entity nào cũng được. → test `price_found_in_either_entity` ở Task 1.
2. **Dòng vừa thêm chưa có bản ghi giá / đơn chưa có `order_finance`:** tính như số 0, không ném lỗi. → test `line_without_price_counts_zero` ở Task 1.
3. **Đơn đã chốt số liệu (`order_pl.locked = true`, nhập từ Excel):** `compute_pl` không ghi đè. → test `locked_order_is_not_recomputed` ở Task 4.
4. **Số nhập kiểu Việt Nam** ("15.000.000", "0,5", "+84 909 123 456", "5-11-2026"): đọc đúng và chuẩn hóa, không thành `NaN` hay lệch 1000 lần. → các test `parse_*` ở Task 2.
5. **AM đổi trường `am` của đơn sang người khác** (đẩy đơn sang KPI người khác, hoặc tự mất quyền): bị chặn, chỉ Admin / automation đổi được. → rule `am_is_fixed` ở Task 5, kiểm trên sandbox ở Task 9 (`am_cannot_reassign_order`).

---

### Task 1: `OrderDraft` và chuyển bản ghi sang đầu vào engine

**Files:**
- Create: `src/order/types.ts`, `src/order/records.ts`
- Test: `test/order/records.test.ts`, fixture `test/order/fixtures/tm1040-records.ts`

**Interfaces:**
- Consumes: `PlOrderInput`, `PlConfig`, `ItemType` (`src/pl/types.ts`), `computePl`, `DEFAULT_CONFIG`.
- Produces (`src/order/types.ts`) — khóa trường trùng với khóa entity ở Task 5–6:

```ts
type Rec = Record<string, unknown>;
export interface OrderFields { id?: string; number?: string; code?: string; status: 'draft' | 'in_progress' | 'done' | 'close_lost';
  stage: number; customer: string | null; customer_name: string; customer_code: string; tax_code: string; address: string;
  contact_name: string; contact_phone: string; contact_email: string; representative: string; representative_title: string;
  bank_account: string; bank_name: string; receiver_name: string; receiver_phone: string; delivery_address: string;
  delivery_note: string; quote_date: string | null; quote_valid_until: string | null; exchange_rate: number | null;
  internal_contract_no: string; customer_po_no: string; content: string; signed_on: string | null;
  am: string | null; sa: string | null; inside_sales: string | null; is_new_order: boolean; is_new_logo: boolean;
  prev_contract_no: string; lead_source: string | null; customer_tier: 'vip' | 'potential' | 'standard' | null;
  debt_days: number | null; use_provision_fund: boolean; payment_count: number | null; customer_prepays: boolean;
  deploy_staff: string | null; consult_staff: string | null; proposal: boolean; poc: boolean;
  contract_type_override: ContractType | null; deal_stages: { stage: Exclude<DealStage, 'lead'>; weight: number | null; person: string | null }[];
  has_goods: boolean; has_service: boolean; }
export interface LineDraft { id: string; line_no: number; item_type_code: string; co_cq: boolean; name: string; unit: string;
  quantity: number | null; months: number | null; sku: string; specs: string; start_date: string | null; end_date: string | null;
  delivery_time: string; supplier_priority: string; end_user: string; note: string;
  price: { id?: string; unit_price: number | null; discount_pct: number | null; vat_rate: number | null; unit_cost: number | null;
    supplier: string | null }; }
export interface FinanceFields { id?: string; sales_cost: number | null; prev_sales_cost: number | null;
  prev_revenue: number | null; prev_net_profit: number | null; }
export interface OrderDraft { order: OrderFields; lines: LineDraft[]; finance: FinanceFields; }
export interface OrderRecords { order: Rec; lines: Rec[]; goods_prices: Rec[]; service_prices: Rec[]; finance: Rec[]; }
```

- Produces (`src/order/records.ts`):
  - `export function draftFromRecords(r: OrderRecords): OrderDraft` — nhận item danh sách / kết quả search (trường ở cấp trên cùng, hoặc trong `body` / `fields` — chấp nhận cả ba), số dạng chuỗi được đọc (như `configFromRecords`), sắp dòng theo `line_no`; giá của dòng tìm theo `order_line` trong **cả** `goods_prices` lẫn `service_prices` (Review Focus 1); thiếu → giá rỗng.
  - `export function toPlOrderInput(draft: OrderDraft, provisionFundBalance?: number): PlOrderInput` — `dealStages` bỏ `weight` (engine lấy hệ số từ cấu hình); `leadPerson = lead_source`; `vatRate` null giữ null (engine dùng 8%; 02b truyền mức mặc định cấu hình); `provisionFundBalance` mặc định 0 (quỹ ở Kế hoạch 07).
  - `export function lineGroup(code: string, config: PlConfig): PurchaseGroup | null` — nhóm của mã loại; mã lạ → `null`.

- [ ] **Step 1: Fixture** `test/order/fixtures/tm1040-records.ts` — đơn TM-1040 dạng bản ghi: `order` (tier `potential`, debt 30, `is_new_order` true, `deal_stages` 5 giai đoạn đầu `"ThuanNG"`, `contract` `"ThuDTH"`), 2 `order_line` TB (`line_no` 2 rồi 1 — để kiểm sắp xếp), 2 `goods_prices` (giá như `test/pl/fixtures/tm1040.ts`), `finance` `[{ sales_cost: 0 }]`, `service_prices` `[]`.
- [ ] **Step 2: Write the failing tests** `test/order/records.test.ts`
  - `tm1040_records_compute_like_the_golden_case`: `computePl(toPlOrderInput(draftFromRecords(F)), DEFAULT_CONFIG).netProfit` `toBeCloseTo(46_272_444.44, 2)`; `kpiSplit` ThuanNG `toBeCloseTo(41_645_200, 2)`.
  - `lines_are_sorted_by_line_no`.
  - `price_found_in_either_entity` (Review Focus 1): giá dòng TB đặt trong `service_prices` → vẫn đọc ra `unit_price` đúng.
  - `line_without_price_counts_zero` (Review Focus 2): bỏ hết giá và `finance: []` → không ném, `revenue` 0.
  - `fields_under_body_are_read`: cùng fixture, mỗi bản ghi bọc `{ id, body: {...} }` → kết quả như cũ.
  - `numeric_strings_are_read`: `quantity: "12"`, `unit_price: "21000000"` → như số.
  - `line_group_follows_item_type`: `TB` → `goods`, `Cloud Server` → `service`, `XYZ` → `null`.
- [ ] **Step 3:** `pnpm vitest run test/order/records.test.ts` → FAIL (module not found).
- [ ] **Step 4:** Viết `types.ts`, `records.ts`.
- [ ] **Step 5:** chạy lại → PASS.
- [ ] **Step 6: Commit** — `feat(order): OrderDraft và chuyển bản ghi đơn sang đầu vào bộ tính`

---

### Task 2: Định dạng trường nhập liệu (Đặc tả 4.8)

**Files:**
- Create: `src/order/formats.ts`
- Test: `test/order/formats.test.ts`

**Interfaces:**
- Produces: `export type FormatKind = 'phone' | 'email' | 'date' | 'tax_code' | 'bank_account' | 'customer_code' | 'contract_no' | 'sku' | 'person_name' | 'text' | 'unit' | 'money' | 'signed_money' | 'quantity' | 'months' | 'percent' | 'debt_days' | 'days' | 'payment_count' | 'count';`
  `export interface FormatResult { ok: boolean; value: string | number | null; message?: string }` (`value` = giá trị đã chuẩn hóa để lưu; `message` tiếng Việt, hiện dưới ô);
  `export function checkFormat(kind: FormatKind, raw: string): FormatResult` — chuỗi rỗng → `{ ok: true, value: null }` (bắt buộc kiểm ở Task 3);
  `export function parseNumberVi(raw: string): number | null` — "15.000.000" → 15000000, "0,5" → 0.5, "-2.500.000" → -2500000, "1.5" (một dấu chấm, 1 chữ số sau) → 1.5, rác → `null`.

Quy tắc và chuẩn hóa lấy **nguyên** bảng 4.8 (Đặc tả dòng sau "### 4.8"): ví dụ hợp lệ của từng dòng là một test `ok`. Hai chỗ bảng để ngỏ, chốt ở đây: `percent` trả **phân số** (`"30"` → `0.3`, `"0,5"` → `0.005`); `date` trả chuỗi ISO `yyyy-mm-dd` để lưu (hiển thị dd/mm/yyyy là việc của 02b).

- [ ] **Step 1: Write the failing tests** — một `describe` mỗi `FormatKind`, tối thiểu:
  - `parse_phone`: `"0909.123.456"` → `"0909 123 456"`; `"+84 909 123 456"` → `"0909 123 456"`; `"028 3800 0000"` ok → `"028 3800 0000"`; `"0123"` → `ok: false`.
  - `parse_email`: `" CNTT@Barria.gov.vn "` → `"cntt@barria.gov.vn"`; `"a@b.c"` → false.
  - `parse_date`: `"5-11-2026"`, `"5.11.2026"`, `"2026-11-05"`, `"05112026"` → `"2026-11-05"`; `"31/02/2026"` → false; `"01/01/1999"` → false.
  - `parse_tax_code`: `"0312 345 678"` → `"0312345678"`; `"0312345678-001"` ok; `"031234567"` → false.
  - `parse_bank_account`: `"0071.000-123 456"` → `"0071000123456"`; 5 chữ số → false.
  - `parse_customer_code`: `"sogt vtld"` → `"SOGTVTLD"`; `"Á"` → false.
  - `parse_contract_no`: `"018/2026/HĐ-KLM"` ok; 1 ký tự → false.
  - `parse_person_name`: `"  Chị  Hạnh (Phòng CNTT) "` → `"Chị Hạnh (Phòng CNTT)"`; `"An1"`, `"a@b"` → false.
  - `parse_money`: `"15.000.000"` → `15000000`; `"-1"` → false. `parse_signed_money`: `"-2.500.000"` → `-2500000`.
  - `parse_quantity`: `"17"` → 17; `"0"`, `"1,5"` → false. `parse_months`: `"121"` → false. `parse_percent`: `"30"` → `0.3`, `"101"` → false.
  - `parse_debt_days`: `"45 ngày"` → 45; `"366"` → false. `parse_payment_count`: `"13"` → false.
  - `empty_is_not_an_error`: mọi kind với `""` → `{ ok: true, value: null }`.
- [ ] **Step 2:** FAIL. **Step 3:** viết `formats.ts`. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(order): kiểm và chuẩn hóa định dạng trường theo Đặc tả 4.8`

---

### Task 3: Kiểm bắt buộc và ràng buộc của đơn

**Files:**
- Create: `src/order/validate.ts`
- Test: `test/order/validate.test.ts`

**Interfaces:**
- Consumes: `OrderDraft` (Task 1), `checkFormat` (Task 2), `PlConfig`, `lineGroup`.
- Produces: `export interface FieldIssue { path: string; message: string; severity: 'error' | 'warning' }` (`path` như `order.tax_code`, `lines[2].unit`, `finance.prev_revenue`);
  `export function validateOrder(draft: OrderDraft, config: PlConfig, stage: 'draft' | 'submit' | 'customer_contract'): { issues: FieldIssue[]; missingRequired: number }`.
  `stage = 'draft'`: chỉ lỗi định dạng (lưu nháp được khi còn thiếu); `'submit'` (gửi duyệt t11): thêm bắt buộc; `'customer_contract'` (t41, dùng ở Kế hoạch 03): thêm các trường lấy từ HĐ.

Quy tắc (mỗi quy tắc một test, tên test = mã):
- Bắt buộc khi `submit`: FR-1.6c `customer_name`, `customer_code`, `tax_code`, `contact_name`; FR-2.1 `internal_contract_no`, `content`, `am`; FR-2.4 `customer_tier`, `debt_days`, `finance.sales_cost`; FR-2.5 `deploy_staff` và `consult_staff` không bắt buộc (null = "Không"); FR-2.7 tổng `weight` của `deal_stages` = 1 (sai số 1e-9) và mỗi giai đoạn có `weight > 0` phải có `person`; đơn có ≥ 1 dòng.
- BR-21: `is_new_order = false` → bắt buộc `prev_contract_no`, `finance.prev_sales_cost`, `finance.prev_revenue` (> 0), `finance.prev_net_profit`.
- BR-23: `is_new_order = false` mà `lead_source` có giá trị → lỗi ở `order.lead_source`.
- FR-3.5 mỗi dòng: `name`, `unit`, `quantity > 0`, `price.unit_price > 0`, `price.supplier`; mã loại `TB` bắt buộc `co_cq`; mã có `termed` bắt buộc `start_date`, `end_date`; mã `monthly` bắt buộc `months > 0`, và `months` khớp khoảng ngày (lệch ≤ 1 tháng, 4.8 "Số tháng").
- Mã loại không có trong cấu hình → `error` ở `lines[i].item_type_code`.
- 4.8 ràng buộc giữa trường: `end_date > start_date`; `quote_valid_until > quote_date`; `prev_net_profit ≤ prev_revenue`.
- Tối đa 300 dòng (search của `compute_pl` đọc 500 bản ghi giá; 300 để dư) → lỗi ở `lines`.
- `customer_contract`: thêm `address`, `receiver_name`, `receiver_phone`, `delivery_address`, `signed_on`, `payment_count` (ghi chú cuối Module 1).
- `missingRequired` = số issue bắt buộc thiếu (cho banner "còn N trường thiếu", FR-2.8).

- [ ] **Step 1: Write the failing tests** — dựng từ fixture TM-1040 (Task 1) qua `draftFromRecords`, rồi làm hỏng từng thứ; ca chuẩn `tm1040_submits_clean` → `issues = []`.
- [ ] **Step 2:** FAIL. **Step 3:** viết. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(order): kiểm bắt buộc và ràng buộc của đơn trước khi gửi duyệt`

---

### Task 4: Kết quả engine thành bản ghi P&L, bundle `compute_order_pl.js`

**Files:**
- Create: `src/order/pl-records.ts`, `src/order/code-entry.ts`
- Modify: `scripts/build-code.mjs` (sinh **hai** file: `config/code/compute_pl.js` như cũ và `config/code/compute_order_pl.js`; `bundle(entry)` nhận tên), `scripts/build-code.d.mts`, `test/pl/code-bundle.test.ts` (gọi `bundle('compute_pl')`)
- Generated + committed: `config/code/compute_order_pl.js`
- Test: `test/order/pl-records.test.ts`, `test/order/code-bundle.test.ts`

**Interfaces:**
- Consumes: `computePl`, `configFromRecords`, `ConfigRecords`, `draftFromRecords`, `toPlOrderInput`, `lineGroup`.
- Produces:
  - `export interface PlRecordBodies { order_pl: Rec; order_pl_service: Rec; order_pl_goods: Rec; order: { code: string; has_goods: boolean; has_service: boolean } }`
  - `export function plRecordsFromResult(draft: OrderDraft, result: PlResult, config: PlConfig, proposals: Rec[], computedAt: string): PlRecordBodies` — khóa trường đúng như Task 7; `detail`, `kpi_split`, `config_snapshot` là **chuỗi JSON**; `order.code` = `(has_goods ? 'TM-' : 'DV-') + number` (BR-53; `has_goods` = có dòng nhóm `goods`), chuỗi rỗng khi đơn chưa có dòng; `order_pl_goods.proc_saving` = Σ dòng hàng hóa (`price.unit_cost` − `proposed_cost` của `purchase_proposal` cùng dòng) × SL (Thiết kế 13.4; dòng chưa có đề xuất không tính).
  - `export function runComputeOrderPl(args: { records: OrderRecords; proposals: Rec[]; existing: Rec[]; config: ConfigRecords; now: string }): PlRecordBodies & { skip: boolean }` — `existing` là kết quả search `order_pl` của đơn: có bản ghi `locked === true` → `skip: true` và không tính (Review Focus 3).
  - `config/code/compute_order_pl.js`: IIFE `PL` như bundle cũ + `function main(inputs) { return PL.runComputeOrderPl({ records: { order: inputs.order, lines: inputs.lines, goods_prices: inputs.goods_prices, service_prices: inputs.service_prices, finance: inputs.finance }, proposals: inputs.proposals, existing: inputs.existing, config: inputs.config, now: inputs.now }); }`.

- [ ] **Step 1: Write the failing tests**
  - `pl-records.test.ts`: `tm1040_bodies` — `order_pl.net_profit` `toBeCloseTo(46_272_444.44, 2)`, `passed` true, `applied_contract_type` `"tm_once"`, `JSON.parse(kpi_split)` có ThuanNG; `order.code` `"TM-" + number`; `order_pl_service.revenue` 0; `order_pl_goods.cost` = `order_pl.cost`.
  - `service_only_order_is_dv`: một dòng `Cloud Server` → `code` bắt đầu `"DV-"`, `has_service` true, `has_goods` false.
  - `proc_saving_counts_lines_with_proposals`: dòng 1 Sale 19M, PROC 18M, SL 12 → 12_000_000; dòng 2 không có đề xuất → không cộng.
  - `locked_order_is_not_recomputed` (Review Focus 3): `existing: [{ locked: true }]` → `skip: true`.
  - `code-bundle.test.ts`: `bundle_is_fresh` (`bundle('compute_order_pl')` = file commit); `bundle_main_matches_library` (nạp bằng `new Function`, so với `runComputeOrderPl`); `bundle_reads_only_declared_inputs` = {`order`, `lines`, `goods_prices`, `service_prices`, `finance`, `proposals`, `existing`, `config`, `now`}.
- [ ] **Step 2:** FAIL. **Step 3:** viết; `pnpm build:code`. **Step 4:** `pnpm test` → PASS.
- [ ] **Step 5: Commit** — `feat(order): kết quả P&L thành bản ghi, bundle compute_order_pl`

---

### Task 5: Entity `order` và `order_line`

**Files:**
- Create: `config/entities/order.json`, `config/entities/order_line.json`
- Modify: `config/package-manifest.json` (`requires.entities.user.fields` thêm `email: "text"`)
- Test: `test/order/entities.test.ts`

**Interfaces:**
- Produces: các trường đúng khóa của `OrderFields` / `LineDraft` (trừ `price`, `id`), với:
  - `order.number`: `auto_number`, `auto_number_scope: "order:{{ year() }}"`, `auto_number_format: "{{ year() }}-{{ value | pad(4) }}"`; `code` text (do `compute_pl` ghi); `display_field: "code"`.
  - `status` enum 4 giá trị (Nháp / Đang xử lý / Hoàn tất / Close-lost), mặc định `draft`; `stage` number mặc định 1; `customer` reference `${entity:customer}`; `am`, `sa`, `inside_sales` reference Users; `am` required, mặc định `creator`; `deploy_staff`, `consult_staff` reference `${entity:staff}`; `customer_tier` enum như `customer.tier`; `contract_type_override` enum 5 loại; `deal_stages` list (`stage` enum 6 giai đoạn không gồm `lead`, `weight` number, `person` text), mặc định không có; `has_goods`, `has_service` boolean (do `compute_pl` ghi).
  - `order_line.order`: reference `${entity:order}`, required, `on_target_delete: "cascade"`, `inverse_key: "lines"`; `line_no` number; `item_type_code` text required; `specs` richtext; ngày là `date`.
  - `create_form` trên cả hai, mỗi trường người nhập được một property (không có `number`, `code`, `has_goods`, `has_service`, `stage`, `status`).
- Access (Thiết kế 7.2):
  - `order`: `am_group` create (organization) + read / list / update `record_scopes [{field: am}]`; `sa_group` như vậy với `sa`; `tm_group`, `sd_group`, `proc_group`, `acc_group` read + list organization; `admin_group` read, list, update, delete organization; `automation_group` read, list, update organization.
  - `order_line`: như `order` nhưng scope `parent_field` (`field: "order"`, `parent_field: "am"` / `"sa"`) cho read, list, create, update, delete của AM / SA; còn lại như `order`.
- Rule `am_is_fixed` trên `order` (Review Focus 5) theo mẫu `team_is_fixed` (`rules-and-stages.md`, "A field fixed once the record exists"), trừ `admin_group` và `automation_group`. Nếu rule không miễn trừ được theo nhóm: chặn mọi thay đổi `am` sau khi tạo (Admin đổi AM bằng workflow ở kế hoạch sau) và ghi `F-xx`.
- `natural_key`: `order` `[]`; `order_line` `[]`.

- [ ] **Step 1: Write the failing test** `test/order/entities.test.ts` — đọc JSON: `order_has_no_money_fields` (không trường nào ngoài `exchange_rate` có `format: "currency"` hoặc tên chứa `price`, `cost`, `revenue`, `profit`); `order_fields_match_draft_keys` (mọi khóa của một `OrderFields` mẫu là trường của entity); `line_fields_match_draft_keys`; `am_is_fixed_rule_exists`.
- [ ] **Step 2:** FAIL. **Step 3:** viết 2 file; `pnpm build && pnpm exec agentflow-app types` → `wrote N package files`.
- [ ] **Step 4:** `pnpm test` → PASS.
- [ ] **Step 5: Commit** — `feat(config): entity đơn hàng và dòng danh mục`

---

### Task 6: Giá dòng, tài chính, đề xuất mua; form cho dữ liệu dùng chung

**Files:**
- Create: `config/entities/goods_line_price.json`, `service_line_price.json`, `order_finance.json`, `purchase_proposal.json`
- Modify: `config/entities/customer.json`, `supplier.json`, `staff.json` (thêm `create_form` — sandbox 03/11 cho thấy tạo bản ghi qua API cần form)
- Test: mở rộng `test/order/entities.test.ts`

**Interfaces:**
- Produces:
  - `goods_line_price`, `service_line_price`: `order_line` (reference, required, cascade; natural key `by_line`), `order` (reference, required, cascade), `unit_price`, `unit_cost` (currency VND), `discount_pct`, `vat_rate` (percent, 0–1), `supplier` (reference `${entity:supplier}`).
  - `order_finance`: `order` (natural key `by_order`), `sales_cost`, `prev_sales_cost`, `prev_revenue` (currency), `prev_net_profit` (currency, có thể âm).
  - `purchase_proposal`: `order_line` (natural key `by_line`), `order`, `proposed_cost`, `actual_cost` (currency), `proposed_supplier` (reference supplier), `note` (richtext).
  - `create_form` trên cả 7 entity.
- Access (7.2):
  - `order_finance`: AM / SA `parent_field` (order.am / order.sa) read, list, create, update; `sd_group`, `acc_group`, `admin_group` read + list; `automation_group` read, list.
  - `service_line_price`: như `order_finance`, thêm `tm_group` read + list.
  - `goods_line_price`: như `order_finance`, thêm `proc_group` read + list.
  - `purchase_proposal`: `proc_group` read, list, create, update organization; `sd_group`, `acc_group` read + list; `automation_group` read, list. AM / SA / TM / Admin không có grant (FR-4.6).

- [ ] **Step 1: Write the failing tests** — `prices_live_outside_order`; `purchase_proposal_hidden_from_am_and_tm` (không grant nào cho `am_group`, `sa_group`, `tm_group`); `tm_reads_service_but_not_goods_prices`; `proc_reads_goods_but_not_service_prices`; `shared_records_have_create_forms`.
- [ ] **Step 2:** FAIL. **Step 3:** viết; build + types. **Step 4:** `pnpm test` → PASS.
- [ ] **Step 5: Commit** — `feat(config): giá dòng hàng hóa / dịch vụ, tài chính đơn, đề xuất mua`

---

### Task 7: Ba entity P&L

**Files:**
- Create: `config/entities/order_pl.json`, `order_pl_service.json`, `order_pl_goods.json`
- Test: mở rộng `test/order/entities.test.ts`, `test/order/pl-records.test.ts`

**Interfaces:**
- Produces (khóa = khóa của `PlRecordBodies`, Task 4):
  - `order_pl`: `order` (natural key `by_order`), currency `revenue`, `cost`, `gross_profit`, `vat_out`, `vat_in`, `sales_cost`, `fin_cost`, `warranty`, `license_support`, `tech_support`, `deploy_bonus`, `provision`, `consult_bonus`, `provision_fund_draw`, `net_profit`; percent `net_margin`, `threshold`; boolean `passed`; enum `applied_contract_type`; richtext `detail`, `kpi_split`, `config_snapshot`; datetime `computed_at`; enum `source` (`computed` / `excel`) mặc định `computed`; boolean `locked`.
  - `order_pl_service`: `order` (by_order), currency `revenue`, `cost`, `gross_profit`, `one_time_revenue`, `one_time_cost`, `recurring_revenue`, `recurring_cost`, `internal_cost`, `outsource_cost`; richtext `detail` (theo mã loại dịch vụ).
  - `order_pl_goods`: `order` (by_order), currency `cost`, `sale_cost_total`, `proposed_cost_total`, `actual_cost_total`, `proc_saving`; richtext `detail`.
- Access: AM / SA `parent_field` read + list (không create / update); `order_pl`: `sd_group`, `acc_group`, `admin_group` read + list; `order_pl_service`: thêm `tm_group`; `order_pl_goods`: thêm `proc_group`; `automation_group` read, list, create, update trên cả ba. Không `create_form` (chỉ workflow ghi).

- [ ] **Step 1: Write the failing tests** — `pl_bodies_fit_entities`: mọi khóa của `plRecordsFromResult(...)` cho TM-1040 là trường của entity tương ứng và ngược lại (trừ `order`); `am_cannot_write_pl` (grant AM / SA không có `create`, `update`).
- [ ] **Step 2:** FAIL. **Step 3:** viết; build + types. **Step 4:** `pnpm test` → PASS.
- [ ] **Step 5: Commit** — `feat(config): entity P&L của đơn, phần dịch vụ và phần hàng hóa`

---

### Task 8: Workflow `compute_pl`

**Files:**
- Create: `config/build/compute-pl.mjs`
- Modify: `config/package-manifest.json` (tham số `automation_principal`, `service_principal_ref`, required, label "Tài khoản tự động hóa PL", help: service principal thuộc nhóm "Tự động hóa PL", role `entity.read`, `entity.list`, `entity.write`), `agentflow.app.mjs` (thêm module, ORDER `["open_case", "pl_selftest", "compute_pl"]`), `sandbox.json` (`"automation_principal": "@principal:pl_bot"`), `config/build/pl-selftest.mjs` (dùng chung `PL_OUTPUT_SCHEMA` nếu cần)
- Test: `test/order/compute-workflow.test.ts`

**Interfaces:**
- Produces: workflow key `compute_pl`, `start({ subject: "${entity:order}" })`, run as `servicePrincipal("automation_principal")`, start access `restricted("am_group", "sa_group", "admin_group")`. Kế hoạch 02b khởi chạy nó với đơn làm subject sau mỗi lần lưu (Thiết kế 13.6); Kế hoạch 03 gọi nó từ `advance_order`.
- Các bước (một nhánh, không vòng lặp):
  1. `search` `order_line`, `goods_line_price`, `service_line_price`, `order_finance`, `purchase_proposal`, `order_pl` — mỗi cái lọc `flt("order", "eq", ref("subject.record_id"))`, `limit: 500`.
  2. `search` 7 entity cấu hình, `limit: 500`.
  3. `code("compute", …, "code/compute_order_pl.js", [["order", ref("subject.record")], ["lines", ref("nodes.lines.output.records")], …, ["config", <object của 7 records>], ["now", NOW]], schema)` — nếu builder không nhận object lồng làm binding cho `config`, tách 7 input `cfg_item_type` … và sửa `code-entry` / Task 4 tương ứng (ghi `F-xx`).
  4. `decision`: `nodes.compute.output.skip == true` → `end` "Đã chốt số liệu".
  5. `upsert` `order_pl`, `order_pl_service`, `order_pl_goods` theo `by_order`, bind từng trường từ `nodes.compute.output.order_pl.<field>` …; `update` `order` (`code`, `has_goods`, `has_service`) theo `subject.record_id`.
  6. `end` với output `net_profit`, `passed`.

- [ ] **Step 1: Write the failing test** `compute-workflow.test.ts` — đọc `package/objects/workflow/compute_pl.json`: `runs_as_automation_principal`; `code_step_uses_committed_bundle` (source = `config/code/compute_order_pl.js`); `every_pl_field_is_written` (mỗi khóa của `PlRecordBodies.order_pl` có một bind trong bước upsert `order_pl`, tương tự hai entity kia).
- [ ] **Step 2:** FAIL. **Step 3:** viết; `pnpm build && pnpm exec agentflow-app types`. **Step 4:** `pnpm test` → PASS; `pnpm sandbox check` → `sandbox.json is valid`.
- [ ] **Step 5: Commit** — `feat(workflow): compute_pl tính và ghi P&L chính thức của đơn`

---

### Task 9: Kiểm trên sandbox

**Files:**
- Create: `e2e/orders.sandbox.test.ts`
- Modify: `docs/sdk-feedback.md` (nếu gặp vướng mắc)

**Interfaces:**
- Consumes: mọi entity, `compute_pl`, fixture TM-1040 dạng bản ghi (Task 1).

- [ ] **Step 1:** `pnpm af deploy --sandbox` (tạo mới — `sandbox.json` đổi ở Task 8) → `installed inno/pl …`.
- [ ] **Step 2: Write** `e2e/orders.sandbox.test.ts` (dùng `as`, `idsByKey`, `waitForRun`; mỗi lần chạy gắn tag vào `content` của đơn):
  - `am_creates_tm1040_and_compute_pl_matches_excel`: `am` tạo `customer`, `supplier`, `order`, 2 `order_line`, 2 `goods_line_price`, `order_finance` qua form; khởi chạy `compute_pl` với đơn làm subject; `waitForRun` completed; `am` đọc `order_pl` → `net_profit` `toBeCloseTo(46_272_444.44, 2)`, `passed` true; đơn có `code` bắt đầu `"TM-"`.
  - `tm_cannot_read_pl_goods_or_proposals`: `tm` đọc `order_pl`, `goods_line_price`, `purchase_proposal` của đơn → 403 / 404; đọc `order`, `order_line` → 200.
  - `proc_cannot_read_service_prices_or_pl`: `proc` đọc `service_line_price`, `order_pl` → bị từ chối; `goods_line_price`, `order_pl_goods` → 200.
  - `other_am_cannot_see_order`: `am2` đọc đơn → 404.
  - `am_cannot_write_pl`: `am` sửa `order_pl.net_profit` → 403.
  - `am_cannot_reassign_order` (Review Focus 5): `am` đổi `order.am` thành `am2` → 422 `ENTITY_VALIDATION_RULE_FAILED`.
  - `locked_pl_is_kept`: `pladmin` đặt `order_pl.locked = true`; chạy lại `compute_pl` → `net_profit` không đổi sau khi sửa giá dòng.
- [ ] **Step 3:** `pnpm test:sandbox` → mọi test PASS (gồm cả `plan01.sandbox.test.ts`). Lệch hành vi nền tảng (mã lỗi khác 403 / 404, form từ chối trường) → sửa test theo hành vi thật **nếu vẫn đúng quyền**, ghi `F-xx` nếu là vướng mắc SDK.
- [ ] **Step 4: Commit** — `test(e2e): đơn hàng, quyền theo vai trò và compute_pl trên sandbox`

---

### Task 10: Tài liệu và đóng kế hoạch

**Files:**
- Modify: `AGENTS.md`, `README.md` ("Where things are": `src/order/`, entity đơn, `compute_pl`, `config/code/compute_order_pl.js` sinh tự động; tham số `automation_principal` trong phần cài đặt), `docs/superpowers/plans/2026-11-03-00-roadmap.md` (02 xong; thêm dòng **02b · Màn hình đơn hàng**: danh sách đơn, trang đơn — KH & giao nhận, gợi ý KH cũ, phiếu khảo sát, danh mục, NCC / đơn mua, P&L — thay starter "case desk"; dùng `OrderDraft`, `validateOrder`, `toPlOrderInput`, `compute_pl`)

- [ ] **Step 1:** sửa tài liệu.
- [ ] **Step 2:** `pnpm typecheck && pnpm test` → PASS.
- [ ] **Step 3: Commit & push** — `docs: cập nhật tài liệu sau kế hoạch 02`; `git push`.
