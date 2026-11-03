# Kế hoạch 01 · Nền tảng & bộ tính P&L

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package `inno/pl` có danh tính và tham số nhóm thật; có các entity cấu hình (kèm seed mặc định), khách hàng, NCC, nhân sự; và một bộ tính P&L thuần TypeScript, đã kiểm bằng đơn thật TM-1040, được bundle thành Code step chạy được trong một workflow.

**Architecture:** `src/pl/` là thư viện thuần (không React, không I/O): `types.ts`, `defaults.ts`, `line.ts`, `compute.ts`, `kpi.ts`, `config-records.ts`, `code-entry.ts`. UI module (Kế hoạch 02) import trực tiếp; workflow dùng bản bundle `config/code/compute_pl.js` do `scripts/build-code.mjs` sinh bằng esbuild. Entity cấu hình mang seed lấy đúng giá trị của `defaults.ts`; một test giữ hai bên khớp nhau.

**Tech Stack:** TypeScript, Vitest, esbuild, `@reflexify/agentflow-app-builder` `sdk-v0.7.0`.

**Spec:** `docs/superpowers/specs/2026-11-02-pl-agentflow-design.md` (Thiết kế) — mục 5, 6.1, 6.4, 7.1, 13.1–13.3, 13.6. Công thức: Đặc tả `docs/source/spec.md` Phần 4.2–4.3.

## Global Constraints

- Mọi số tiền VNĐ, chưa VAT; engine giữ nguyên độ chính xác số thực, **không làm tròn** (làm tròn chỉ ở hiển thị).
- Tỷ lệ lưu dạng phân số (`0.08` = 8%), cả trong `defaults.ts` lẫn seed.
- Khóa (key) entity / trường: chữ thường, bắt đầu bằng chữ, chỉ `[a-z0-9_]`; tên file = key (`agentflow-app-authoring` SKILL, "References").
- Không sửa `package/` bằng tay; sau mỗi thay đổi `config/`: `pnpm build`, rồi `pnpm exec agentflow-app types`; commit `config/`, `package/`, `src/generated/app.ts` cùng nhau.
- Mọi entity `access.mode = "restricted"`.
- Nội dung hiển thị (label, help, name) bằng **tiếng Việt**; `contentLocale: "vi"`.
- Starter "case desk" (`config/entities/case.json`, `config/build/open-case.mjs`, `src/module/*` của case) **giữ nguyên** trong kế hoạch này; Kế hoạch 02 thay thế.
- Mỗi vướng mắc SDK mới gặp → thêm mục `F-xx` vào `docs/sdk-feedback.md` trong cùng commit.

## Review Focus

1. **Giá vốn bằng 0** (đơn toàn dịch vụ nội bộ chưa nhập giá mua): tỷ suất không được ra `NaN`/`Infinity` hiển thị; `netMargin = null`, `passed = netProfit > 0`, bậc r dùng tỷ lệ 0. → test `cost_zero_does_not_produce_nan` ở Task 4.
2. **Dòng thiếu số** (SL, giá, số tháng để trống khi đang nhập): engine coi `null`/`undefined` là 0, không ném lỗi, để màn hình tính được trong lúc gõ. → test `blank_numbers_count_as_zero` ở Task 3.
3. **Mã loại không có trong cấu hình** (Admin xóa loại, hoặc file nhập có mã lạ): dòng vẫn tính doanh thu / giá vốn như hàng 1 lần không cờ, và `result.unknownItemTypes` liệt kê mã đó. → test `unknown_item_type_is_reported` ở Task 3.
4. **Loại HĐ được chọn không có trong đơn** (Sale chọn rồi xóa hết dòng loại đó): bỏ qua lựa chọn, dùng loại có doanh thu lớn nhất. → test `override_absent_from_order_is_ignored` ở Task 5.
5. **Quỹ dự phòng âm hoặc bằng 0 khi chọn "Có"**: không bù gì, không ra số âm. → test `empty_fund_draws_nothing` ở Task 5.

---

### Task 1: Danh tính package và tham số nhóm

**Files:**
- Modify: `config/package-manifest.json`
- Modify: `README.md`, `AGENTS.md` (thay mô tả case desk ở phần giới thiệu bằng mô tả PL; giữ phần lệnh)

**Interfaces:**
- Produces: tham số `group_ref` (tất cả `required: true`): `app_users` (giữ — audience, mọi người dùng PL), `am_group`, `sa_group`, `tm_group`, `sd_group`, `proc_group`, `acc_group`, `admin_group`, `automation_group`. Các task sau grant bằng `${param:<key>}`.

- [ ] **Step 1: Sửa manifest**
  - `name`: `"TeraBox · Hiệu quả đơn hàng (P&L)"`; `summary`: `"Lập đơn bán, tự tính P&L, điều phối 15 task giữa các phòng ban có SLA và trợ lý AI, theo dõi KPI."`; `contentLocale`: `"vi"`; `publisher.name`: `"Innomation"`, `publisher.contact`: `"thinh.nguyentruong@innomation.vn"`, `publisher.support` / `dataHandling.privacy`: `"https://innomation.vn"`; `dataHandling.purpose` / `retention` (≥ 5 năm, NFR-07) viết lại cho đơn hàng; `changelog`: `"Bản đầu: nền tảng cấu hình và bộ tính P&L."`.
  - `app_users`: label `"Người dùng PL"`, help nói rõ gồm mọi người của 7 vai trò.
  - Mỗi tham số mới: label tên vai trò (AM · Nhân viên Sale, Sales Admin, Technical Manager, Sales Director, Mua hàng, Kế toán bán hàng, Quản trị viên PL, Tự động hóa PL), help nói người nào thuộc nhóm và role cần có (`entity.read`, `entity.list`, `entity.write`); `automation_group` help: chứa service principal chạy workflow, và một người.
  - `requires.permissions`: một dòng cho mỗi nhóm với `entity.read`, `entity.list`, `entity.write`.
  - Launcher entry giữ `module: "/"`, đổi `key` thành `pl`, label `{ "en": "P&L", "vi": "Hiệu quả đơn hàng" }`.

- [ ] **Step 2: Build**

Run: `pnpm build && pnpm exec agentflow-app types && pnpm test`
Expected: `wrote N package files`, `ui: built`; Vitest pass; `package/ matches the config`; `src/generated/app.ts matches package/`.

- [ ] **Step 3: Commit** — `git add -A config package src/generated README.md AGENTS.md && git commit -m "feat: danh tính package PL và tham số nhóm vai trò"`

---

### Task 2: Kiểu dữ liệu và giá trị mặc định của engine

**Files:**
- Create: `src/pl/types.ts`, `src/pl/defaults.ts`
- Test: `test/pl/defaults.test.ts`

**Interfaces:**
- Produces (`src/pl/types.ts`):

```ts
export type ContractType = 'tm_once' | 'tmdk' | 'dv_once' | 'dv_recurring' | 'fulfillment';
export type CustomerTier = 'vip' | 'potential' | 'standard';
export type PurchaseGroup = 'goods' | 'service';
export type RevenueStructure = 'one_time' | 'recurring';
export type TechSupport = 'none' | 'internal' | 'outsource';
export type WeightSet = 'new_tm' | 'new_dvdk' | 'tmdk' | 'dvdk';
export type DealStage = 'lead' | 'opportunity' | 'clarification' | 'quotation' | 'negotiation' | 'close' | 'contract';

export interface ItemType {
  code: string; name: string; contractType: Exclude<ContractType, 'fulfillment'>;
  purchaseGroup: PurchaseGroup; revenueStructure: RevenueStructure;
  monthly: boolean; termed: boolean; foreign: boolean;
  vatExemptSale: boolean; vatExemptPurchase: boolean;
  warrantyBase: boolean; licenseSupportBase: boolean; techSupport: TechSupport; deployBonusBase: boolean;
  sortOrder: number;
}
export interface ContractTypeRate { code: ContractType; name: string; threshold: number; techSupportBonus: number;
  deployBonus: number; consultBonus: number; salesBonus: number; provision: number; }
export interface FinCostTier { tier: CustomerTier; fromRatio: number; rate: number; }
export interface VatRate { code: string; label: string; rate: number; isDefault: boolean; }
export interface PlSettings { exchangeRate: number; annualInterest: number; foreignContractorTax: number;
  licenseSupportRate: number; techSupportInternalRate: number; techSupportOutsourceRate: number; warrantyRate: number;
  autoApproveLimit: number; contractFileLimit: number; debtBaseDays: number; debtStepDays: number; debtStepRate: number;
  proposalBonus: number; pocBonus: number; }
export interface TaskSla { taskCode: string; name: string; role: string; slaDays: number; }
export interface PlConfig { itemTypes: ItemType[]; contractTypeRates: ContractTypeRate[]; finCostTiers: FinCostTier[];
  vatRates: VatRate[]; settings: PlSettings; dealStageWeights: Record<WeightSet, Record<DealStage, number>>;
  taskSlas: TaskSla[]; }

export interface PlLineInput { id: string; itemTypeCode: string; quantity: number | null; months: number | null;
  unitPrice: number | null; discountPct: number | null; vatRate: number | null; unitCost: number | null; }
export interface PlOrderInput { lines: PlLineInput[]; customerTier: CustomerTier; debtDays: number | null;
  salesCost: number | null; contractTypeOverride: ContractType | null;
  deployStaff: string | null; consultStaff: string | null; proposal: boolean; poc: boolean;
  useProvisionFund: boolean; provisionFundBalance: number;
  isNewOrder: boolean; isNewLogo: boolean; leadPerson: string | null;
  dealStages: { stage: Exclude<DealStage, 'lead'>; person: string | null }[]; }
```

- Produces (`src/pl/defaults.ts`): `export const DEFAULT_CONFIG: PlConfig` với đúng các giá trị dưới đây.

  `itemTypes` (13 mã; cờ không liệt kê = `false`, `techSupport` không liệt kê = `'none'`):

  | code | contractType | purchaseGroup | revenueStructure | cờ |
  |---|---|---|---|---|
  | `TB` | tm_once | goods | one_time | warrantyBase |
  | `LIC` | tm_once | goods | one_time | vatExemptSale, vatExemptPurchase, licenseSupportBase |
  | `LIC-DK` | tmdk | goods | recurring | termed, vatExemptSale, vatExemptPurchase, licenseSupportBase |
  | `LIC-NTNN` | tmdk | service | recurring | termed, foreign, vatExemptSale, vatExemptPurchase, licenseSupportBase |
  | `DVTK-I` | dv_once | service | one_time | vatExemptPurchase, deployBonusBase |
  | `DVTK-O` | dv_once | service | one_time | techSupport: outsource |
  | `Cloud Server`, `Colocation`, `Veeam`, `Manage Service`, `Other Services` | dv_recurring | service | recurring | monthly, termed, vatExemptPurchase, techSupport: internal |
  | `DVDK-O` | dv_recurring | service | recurring | monthly, termed |
  | `DVDK-NTNN` | dv_recurring | service | recurring | monthly, termed, foreign, licenseSupportBase |

  `contractTypeRates` (threshold / techSupportBonus / deployBonus / consultBonus / salesBonus / provision):
  `tm_once` "Thương mại 1 lần" 0.08/0.03/0.05/0.03/0.10/0.01 · `tmdk` "Thương mại định kỳ" 0.05/0.03/0.05/0.01/0.08/0.005 · `dv_once` "Dịch vụ 1 lần" 0.40/0.03/0.05/0.03/0.10/0.05 · `dv_recurring` "Dịch vụ định kỳ" 0.10/0.03/0.05/0.03/0.10/0.05 · `fulfillment` "Fulfillment" 0.03/0.03/0.05/0.01/0/0.

  `finCostTiers`: mốc `fromRatio` 0, 0.1, 0.2, …, 0.7; `vip` 0.15→0.50 bước 0.05; `potential` 0.20→0.55; `standard` 0.25→0.60 (Đặc tả 4.3).

  `vatRates`: `kct` "KCT" 0 · `0` "0%" 0 · `5` "5%" 0.05 · `8` "8%" 0.08 (isDefault) · `10` "10%" 0.10.

  `settings`: exchangeRate 26000, annualInterest 0.146, foreignContractorTax 0.12, licenseSupportRate 0.005, techSupportInternalRate 0.05, techSupportOutsourceRate 0.02, warrantyRate 0.002, autoApproveLimit 300_000_000, contractFileLimit 20_000_000, debtBaseDays 30, debtStepDays 15, debtStepRate 0.005, proposalBonus 0.02, pocBonus 0.02.

  `dealStageWeights` (Thiết kế 13.3): `new_tm` lead .3 opportunity .2 clarification .3 quotation .1 negotiation .1 close .2 contract .1 · `new_dvdk` .3/.2/.3/.05/.1/.2/.15 · `tmdk` 0/0/0/.1/.1/.2/.1 · `dvdk` 0/0/0/.05/.1/.2/.15.

  `taskSlas` (Đặc tả Module 6): t11 AM 1 · t22 TM 1 · t23 PROC 1 · t31 SD 1 · t40 SA 2 · t44 PROC 1 · t42 SD 1 · t41 SA 3 · t45 PROC 2 · t51 ACC 3 · t53 ACC 2 · t61 PROC 7 · t62 TM 7 · t71 ACC 2 · t72 ACC 1; `name` lấy nguyên tên task trong Đặc tả.

- [ ] **Step 1: Write the failing test** `test/pl/defaults.test.ts`
  - `it('weights without lead sum to 100% for new orders and 50% for renewals')`: tổng trừ `lead` của `new_tm`, `new_dvdk` `toBeCloseTo(1, 10)`; của `tmdk`, `dvdk` `toBeCloseTo(0.5, 10)`.
  - `it('has one default VAT rate, 8%')`: đúng một `isDefault`, `rate === 0.08`.
  - `it('has 13 item types with unique codes and 8 tiers per customer tier')`.
  - `it('has the 15 tasks with the spec SLA')`: map `taskCode → slaDays` bằng đúng bảng trên; tổng 30.

- [ ] **Step 2:** `pnpm vitest run test/pl/defaults.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Viết `types.ts`, `defaults.ts`.
- [ ] **Step 4:** chạy lại → PASS.
- [ ] **Step 5: Commit** — `feat(pl): kiểu dữ liệu và cấu hình mặc định của bộ tính P&L`

---

### Task 3: Tính từng dòng

**Files:**
- Create: `src/pl/line.ts`
- Test: `test/pl/line.test.ts`

**Interfaces:**
- Consumes: `PlLineInput`, `ItemType`, `PlSettings` (Task 2).
- Produces:

```ts
export interface PlLineResult { id: string; itemTypeCode: string; itemType: ItemType | null;
  revenue: number; cost: number; vatOut: number; vatIn: number; profit: number; }
export function computeLine(line: PlLineInput, itemType: ItemType | null, settings: PlSettings): PlLineResult;
```

Quy tắc (Đặc tả 4.2 bước 1–2, BR-03–BR-06): `revenue = qty × unitPrice × (1 − discountPct) × (monthly ? months : 1)`; `cost = qty × unitCost × (monthly ? months : 1) × (foreign ? 1 + foreignContractorTax : 1)`; `vatOut = vatExemptSale ? 0 : revenue × vatRate`; `vatIn = vatExemptPurchase ? 0 : cost × vatRate`; `vatRate` null → 0.08 (VAT mặc định do lời gọi truyền qua `line.vatRate`; engine không tự tra); `null`/`undefined` số → 0; `itemType = null` → tính như không cờ.

- [ ] **Step 1: Write the failing tests**
  - `tm1040_line1`: TB, qty 12, unitPrice 21_000_000, unitCost 19_000_000, months 24, vat 0.08 → revenue 252_000_000, cost 228_000_000, vatOut 20_160_000, vatIn 18_240_000.
  - `monthly_service_multiplies_months`: `Cloud Server`, qty 1, unitPrice 10_000_000, unitCost 6_000_000, months 12 → revenue 120_000_000, cost 72_000_000, vatIn 0.
  - `termed_license_is_whole_period`: `LIC-DK`, qty 2, unitPrice 50_000_000, months 12, unitCost 40_000_000 → revenue 100_000_000, cost 80_000_000, vatOut 0.
  - `foreign_adds_contractor_tax`: `LIC-NTNN`, qty 1, unitPrice 100_000_000, unitCost 80_000_000 → cost 89_600_000.
  - `discount_applies_to_revenue_only`: TB, qty 1, price 100_000_000, discount 0.1, cost 70_000_000 → revenue 90_000_000, cost 70_000_000.
  - `blank_numbers_count_as_zero` (Review Focus 2): mọi số `null` → mọi kết quả 0, không ném.
  - `unknown_item_type_is_reported` (Review Focus 3, phần dòng): `itemType = null`, qty 1, price 10, cost 5, months 12 → revenue 10, cost 5 (không nhân tháng).
- [ ] **Step 2:** chạy → FAIL. **Step 3:** viết `line.ts`. **Step 4:** chạy → PASS.
- [ ] **Step 5: Commit** — `feat(pl): tính doanh thu, giá vốn, VAT từng dòng`

---

### Task 4: Tổng P&L và các khoản chi phí

**Files:**
- Create: `src/pl/compute.ts`
- Test: `test/pl/compute.test.ts`

**Interfaces:**
- Consumes: `computeLine` (Task 3), `PlConfig`, `PlOrderInput`.
- Produces:

```ts
export interface PlResult {
  lines: PlLineResult[]; unknownItemTypes: string[];
  byType: Record<string, { revenue: number; cost: number; vatOut: number; vatIn: number }>;
  byStructure: Record<RevenueStructure, { revenue: number; cost: number }>;
  byPurchaseGroup: Record<PurchaseGroup, { revenue: number; cost: number }>;
  contractTypes: ContractType[]; appliedContractType: ContractType | null;
  revenue: number; cost: number; grossProfit: number; vatOut: number; vatIn: number;
  salesCost: number; finCostRate: number; finCost: number; profitAfterSales: number;
  warranty: number; licenseSupport: number; techSupport: number; deployBonus: number; provision: number;
  consultBonusRate: number; consultBonus: number;
  netProfitBeforeFund: number; provisionFundDraw: number; netProfit: number;
  netMargin: number | null; threshold: number; passed: boolean;
  weightSet: WeightSet; kpiSplit: { person: string; weight: number; amount: number }[];
}
export function computePl(input: PlOrderInput, config: PlConfig): PlResult;
```

Task này làm các bước 3–12 và 13 *trước khi* bù quỹ (`netProfitBeforeFund`). Bước 14–15, bù quỹ, `appliedContractType` theo override và `kpiSplit` ở Task 5–6. Tạm thời: `appliedContractType` = loại có doanh thu lớn nhất (hòa thì theo thứ tự `tm_once, tmdk, dv_once, dv_recurring`), `provisionFundDraw = 0`, `netProfit = netProfitBeforeFund`, `kpiSplit = []`.

Quy tắc (Đặc tả 4.2 + Thiết kế 13.1–13.2), `rate` = `contractTypeRates` của `appliedContractType`:
- CPTC: `ratio = cost > 0 ? salesCost / cost : 0`; `finCostRate` = `rate` của bậc có `fromRatio` lớn nhất ≤ ratio trong hạng KH; `finCost = salesCost > 0 ? salesCost × r / (1 − r) : 0`.
- `profitAfterSales = grossProfit − salesCost − finCost`.
- `warranty = Σ_{dòng warrantyBase, months > 0} cost × ceil(months / 12) × warrantyRate`.
- `licenseSupport = Σ cost dòng licenseSupportBase × licenseSupportRate`.
- `techSupport = Σ cost internal × techSupportInternalRate + Σ cost outsource × techSupportOutsourceRate`.
- `deployBonus = deployStaff ? Σ revenue dòng deployBonusBase × rate.deployBonus : 0`.
- `provision = cost × rate.provision` (luôn trích — Thiết kế 13.2).
- `consultBonusRate = rate.consultBonus + (proposal ? proposalBonus : 0) + (poc ? pocBonus : 0)`; `consultBonus = consultStaff ? max(0, profitAfterSales − warranty − licenseSupport − techSupport − deployBonus − provision) × consultBonusRate : 0`.
- `netProfitBeforeFund = profitAfterSales − warranty − licenseSupport − techSupport − deployBonus − provision − consultBonus`.
- `netMargin = cost > 0 ? netProfit / cost : null`.

- [ ] **Step 1: Write the failing tests** (cấu hình = `DEFAULT_CONFIG`; input mặc định: tier `potential`, debtDays 30, salesCost 0, không nhân sự, không quỹ, isNewOrder true)
  - `fin_cost_uses_tier_of_sales_cost_over_cost`: một dòng `Cloud Server` (revenue 120M, cost 72M), salesCost 10_000_000, tier `vip` → finCostRate 0.20, finCost 2_500_000; tier `standard` → finCostRate 0.30, finCost `toBeCloseTo(4_285_714.2857, 3)`.
  - `no_sales_cost_no_fin_cost`: salesCost 0 → finCost 0.
  - `warranty_counts_started_years`: TB cost 100M months 37 → warranty 800_000; months 0 → 0; months 12 → 200_000.
  - `license_support_bases`: dòng `LIC-NTNN` (cost 89.6M) → licenseSupport 448_000.
  - `tech_support_internal_and_outsource`: `Cloud Server` cost 72M + `DVTK-O` cost 30M → techSupport 3_600_000 + 600_000.
  - `deploy_bonus_needs_staff`: `DVTK-I` revenue 50M; deployStaff null → 0; deployStaff "A" → 2_500_000 (applied dv_once, 5%).
  - `provision_always_charged`: TB cost 100M (tm_once) → provision 1_000_000.
  - `consult_bonus_floor_and_extras`: consultStaff "B", proposal + poc → consultBonusRate 0.07 (tm_once); khi LN trước tư vấn âm → consultBonus 0.
  - `structure_and_purchase_group_split`: TB + Cloud Server → byStructure.one_time.revenue = doanh thu TB, recurring = Cloud; byPurchaseGroup.goods / service tương ứng.
  - `cost_zero_does_not_produce_nan` (Review Focus 1): một dòng `DVTK-I` revenue 10M cost 0 → netMargin `null`, finCostRate = bậc 0, không `NaN` ở bất kỳ trường số nào (duyệt mọi trường number của kết quả).
  - `unknown_item_type_is_reported` (Review Focus 3, phần tổng): mã `"XYZ"` → `unknownItemTypes` = `["XYZ"]`, doanh thu vẫn cộng vào tổng.
- [ ] **Step 2:** chạy → FAIL. **Step 3:** viết `compute.ts`. **Step 4:** chạy → PASS.
- [ ] **Step 5: Commit** — `feat(pl): tổng P&L và các khoản chi phí của đơn`

---

### Task 5: Loại HĐ áp dụng, ngưỡng, kết quả và bù quỹ dự phòng

**Files:**
- Modify: `src/pl/compute.ts`
- Test: `test/pl/threshold.test.ts`

**Interfaces:**
- Produces: các trường `appliedContractType`, `threshold`, `passed`, `provisionFundDraw`, `netProfit` của `PlResult` theo quy tắc dưới.

Quy tắc:
- `contractTypes` = các `itemType.contractType` có mặt trong đơn (theo thứ tự cố định ở Task 4). `appliedContractType` = `contractTypeOverride` nếu nó là `'fulfillment'` (Thiết kế 13.5, Sale tự chọn) hoặc có trong `contractTypes`; ngược lại loại có doanh thu lớn nhất; đơn trống → `null` và dùng rate `tm_once`.
- `threshold = rate.threshold + floor(max(0, debtDays − debtBaseDays) / debtStepDays) × debtStepRate`.
- Bù quỹ (Thiết kế 6.5): `need = max(0, threshold × cost − netProfitBeforeFund)`; `provisionFundDraw = useProvisionFund ? min(need, max(0, provisionFundBalance)) : 0`; `netProfit = netProfitBeforeFund + provisionFundDraw`.
- `passed = cost > 0 ? netProfit / cost >= threshold : netProfit > 0`.

- [ ] **Step 1: Write the failing tests**
  - `applied_type_is_largest_revenue`: TB 100M + DVTK-I 150M → `dv_once`.
  - `override_present_is_used`: override `tm_once` → `tm_once`.
  - `override_absent_from_order_is_ignored` (Review Focus 4): chỉ TB, override `dv_recurring` → `tm_once`.
  - `fulfillment_can_always_be_chosen`: chỉ TB, override `fulfillment` → `fulfillment`, threshold 0.03.
  - `debt_days_raise_threshold`: tm_once, debtDays 60 → 0.09; 44 → 0.08; 75 → 0.095; 20 → 0.08.
  - `fund_draw_tops_up_exactly`: TB revenue 104M cost 100M (gross 4M, provision 1M, warranty với months 12 = 200k → netBeforeFund 2.8M), useProvisionFund, balance 50M → draw 5_200_000, netProfit 8_000_000, passed true.
  - `fund_draw_capped_by_balance`: như trên, balance 1M → draw 1_000_000, passed false.
  - `empty_fund_draws_nothing` (Review Focus 5): balance 0 và −5M → draw 0.
  - `no_draw_when_already_passing`: đơn đạt sẵn → draw 0.
- [ ] **Step 2:** FAIL. **Step 3:** sửa `compute.ts`. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(pl): ngưỡng lợi nhuận, kết luận và bù từ quỹ dự phòng`

---

### Task 6: Chia chỉ tiêu kinh doanh

**Files:**
- Create: `src/pl/kpi.ts`; Modify: `src/pl/compute.ts` (gọi `splitKpi`)
- Test: `test/pl/kpi.test.ts`

**Interfaces:**
- Produces: `export function chooseWeightSet(applied: ContractType | null, isNewOrder: boolean): WeightSet;` và `export function splitKpi(input: PlOrderInput, weights: PlConfig['dealStageWeights'], netProfit: number): { weightSet: WeightSet; split: { person: string; weight: number; amount: number }[] };`

Quy tắc (Thiết kế 13.3): `applied ∈ {dv_once, dv_recurring}` → `new_dvdk` / `dvdk`, còn lại (gồm `fulfillment`, `null`) → `new_tm` / `tmdk`, theo `isNewOrder`. Mỗi người: tổng `weights[set][stage]` các giai đoạn người đó giữ; `leadPerson` (khi `isNewLogo` và có) cộng thêm `weights[set].lead`. Bỏ người `null`. `amount = netProfit × weight` (netProfit **sau** bù quỹ — Thiết kế 13.6). Thứ tự kết quả: theo lần xuất hiện đầu tiên (lead trước).

- [ ] **Step 1: Write the failing tests**
  - `new_tm_split_am_and_inside_sales`: 5 giai đoạn đầu "ThuanNG", `contract` "ThuDTH", netProfit 100 → ThuanNG 0.9 / 90, ThuDTH 0.1 / 10.
  - `new_logo_adds_lead_weight`: như trên + isNewLogo, leadPerson "Mkt" → Mkt 0.3 / 30; tổng weight 1.3.
  - `renewal_totals_half`: isNewOrder false, applied tm_once → set `tmdk`, tổng weight 0.5; isNewLogo bị bỏ qua vì `tmdk.lead = 0` (Mkt không xuất hiện).
  - `service_orders_use_dvdk_sets`: applied dv_recurring, new → `new_dvdk`.
  - `blank_person_is_skipped`.
- [ ] **Step 2:** FAIL. **Step 3:** viết. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `feat(pl): chia chỉ tiêu KD theo giai đoạn deal`

---

### Task 7: Ca vàng TM-1040

**Files:**
- Create: `test/pl/fixtures/tm1040.ts` (input), `test/pl/golden-tm1040.test.ts`
- Modify: `docs/superpowers/specs/2026-11-02-pl-agentflow-design.md` mục 13.1 (thay câu "một bảng riêng ghi số Excel và lý do lệch" bằng kết quả: TM-1040 khớp Excel từng dòng vì đơn không có CPBH, dịch vụ, tư vấn, triển khai; các điểm lệch Excel / Đặc tả chỉ hiện ở đơn có các khoản đó)

**Interfaces:**
- Consumes: `computePl`, `DEFAULT_CONFIG`.

Input (từ `docs/source/TM-1040.xlsx`): 2 dòng TB VAT 0.08 — (1) Seagate 18TB qty 12, months 24, unitPrice 21_000_000, unitCost 19_000_000; (2) QNAP TS-H1277AXU qty 1, months 60, unitPrice 168_000_000, unitCost `150_920_000 / 1.08`. Tier `potential`, debtDays 30, salesCost 0, không triển khai / tư vấn, không dùng quỹ, isNewOrder true, isNewLogo false; giai đoạn opportunity…close = "ThuanNG", contract = "ThuDTH".

- [ ] **Step 1: Write the failing test** — mỗi assert `toBeCloseTo(x, 2)` và kèm ô Excel trong tên:
  revenue 420_000_000 (PL!I17) · cost 367_740_740.74 (PL!F17) · grossProfit 52_259_259.26 (PL!K33) · vatOut 33_600_000 (PL!J17) · vatIn 29_419_259.26 (PL!G17) · finCost 0 (PL!K38) · warranty 2_309_407.41 (PL!K41) · licenseSupport 0 · techSupport 0 · deployBonus 0 · provision 3_677_407.41 (PL!K53) · consultBonus 0 · netProfit 46_272_444.44 (PL!K56) · netMargin 0.125829 (`toBeCloseTo(…, 6)`, PL!J56) · threshold 0.08 (PL!L67) · passed true (PL!E67) · appliedContractType `tm_once` · kpiSplit ThuanNG 41_645_200 (PL!K58), ThuDTH 4_627_244.44 (PL!K61).
- [ ] **Step 2:** chạy → PASS ngay nếu Task 3–6 đúng; nếu FAIL, sửa engine (không sửa số kỳ vọng) và ghi rõ trong commit dòng nào lệch.
- [ ] **Step 3:** sửa mục 13.1 của Thiết kế như ghi ở Files.
- [ ] **Step 4: Commit** — `test(pl): ca vàng TM-1040 khớp file Excel`

---

### Task 8: Entity cấu hình có seed

**Files:**
- Create: `config/entities/item_type.json`, `contract_type_rate.json`, `fin_cost_tier.json`, `vat_rate.json`, `pl_setting.json`, `task_sla.json`, `deal_stage_weight.json`, `business_plan.json`, `kpi_target.json`
- Create: `src/pl/config-records.ts`
- Test: `test/pl/config-records.test.ts`

**Interfaces:**
- Produces: khóa trường của từng entity (dùng nguyên ở Kế hoạch 02, 08):
  - `item_type`: `code` (text, required, natural key `by_code`), `name`, `contract_type` (enum `tm_once|tmdk|dv_once|dv_recurring`), `purchase_group` (enum `goods|service`), `revenue_structure` (enum `one_time|recurring`), boolean `monthly`, `termed`, `foreign`, `vat_exempt_sale`, `vat_exempt_purchase`, `warranty_base`, `license_support_base`, `deploy_bonus_base`, `active` (default true), `tech_support` (enum `none|internal|outsource`), `sort_order` (number).
  - `contract_type_rate`: `code` (text, natural key), `name`, number `threshold`, `tech_support_bonus`, `deploy_bonus`, `consult_bonus`, `sales_bonus`, `provision` (`format: "percent"`).
  - `fin_cost_tier`: `key` (text `"<tier>_<fromRatio×100>"`, natural key), `tier` (enum `vip|potential|standard`), `from_ratio`, `rate`.
  - `vat_rate`: `code` (natural key), `label`, `rate`, `is_default`, `sort_order`.
  - `pl_setting`: `key` (natural key, seed `"default"`), number cho mỗi trường `PlSettings` dạng snake_case (`exchange_rate`, `annual_interest`, `foreign_contractor_tax`, `license_support_rate`, `tech_support_internal_rate`, `tech_support_outsource_rate`, `warranty_rate`, `auto_approve_limit`, `contract_file_limit`, `debt_base_days`, `debt_step_days`, `debt_step_rate`, `proposal_bonus`, `poc_bonus`).
  - `task_sla`: `task_code` (natural key), `name`, `role` (enum `am|sa|tm|sd|proc|acc`), `sla_days`.
  - `deal_stage_weight`: `key` (`"<set>:<stage>"`, natural key), `weight_set` (enum 4 bộ), `stage` (enum 7 giai đoạn), `weight`.
  - `business_plan`: `year` (number, natural key), `revenue`, `net_profit`; seed `{ year: 2026, revenue: 25_000_000_000, net_profit: 5_200_000_000 }`.
  - `kpi_target`: `key` (natural key, `"<year>:<mã NV>"`), `year`, `staff` (reference `${entity:staff}`, Task 9), `revenue`, `net_profit`, `order_count`, `kpi_amount`, `new_logo_min`; không seed.
- Produces (`src/pl/config-records.ts`): `export interface ConfigRecords { item_type: Rec[]; contract_type_rate: Rec[]; fin_cost_tier: Rec[]; vat_rate: Rec[]; pl_setting: Rec[]; task_sla: Rec[]; deal_stage_weight: Rec[] }` (`type Rec = Record<string, unknown>`, trường theo khóa ở trên) và `export function configFromRecords(r: ConfigRecords): PlConfig;` — bỏ `item_type` có `active === false`; thiếu `pl_setting` → dùng `DEFAULT_CONFIG.settings`.
- Mọi entity: grant `app_users` read + list toàn tổ chức; `admin_group` read, list, create, update, delete; `automation_group` read, list, update. Mỗi entity một view `all`.

- [ ] **Step 1: Write the failing tests** `test/pl/config-records.test.ts`
  - `seeds_match_defaults`: đọc 7 file JSON (trừ `business_plan`, `kpi_target`), lấy `seed`, đưa qua `configFromRecords` → `toEqual(DEFAULT_CONFIG)`.
  - `inactive_item_types_are_dropped`.
  - `missing_setting_falls_back_to_defaults`.
- [ ] **Step 2:** FAIL. **Step 3:** viết các file entity + `config-records.ts`.
- [ ] **Step 4:** `pnpm vitest run test/pl` → PASS; `pnpm build && pnpm exec agentflow-app types` → `wrote N package files`.
- [ ] **Step 5: Commit** — `feat(config): entity cấu hình P&L có seed mặc định`

---

### Task 9: Khách hàng, nhà cung cấp, nhân sự

**Files:**
- Create: `config/entities/customer.json`, `config/entities/supplier.json`, `config/entities/staff.json`
- Modify: `config/package-manifest.json` (`requires.entities.user.fields`: thêm `name`)

**Interfaces:**
- Produces:
  - `staff`: `code` (mã NV, natural key), `name`, `user` (reference Users), `team` (enum `sales|sa|technical|procurement|accounting|director|lead_source|other`), `active`. Không seed (dữ liệu riêng của tổ chức).
  - `customer`: `code` (text, natural key `by_code`; constraint pattern `^[A-Z0-9_-]{2,20}$`), `name` (searchable), `tax_code` (natural key `by_tax`; pattern `^\d{10}(-\d{3})?$`), `address`, `tier` (enum `vip|potential|standard`), `representative`, `representative_title`, `bank_account`, `bank_name`, `contacts` (list: `name`, `phone`, `email`), `receiver_name`, `receiver_phone`, `delivery_address`, `delivery_note`, `tax_lookup` (text richtext — JSON kết quả tra MST gần nhất), `tax_status` (text).
  - `supplier`: `name` (natural key `by_name`), `contact_name`, `phone`, `email`, `payment_terms` (list: `label`, `percent` number, `days` number), `debt_days`, `active`.
  - Grant: `app_users` read + list; `am_group`, `sa_group` create + update (customer, supplier); `admin_group` mọi thao tác (cả staff); `automation_group` read, list, update.
- [ ] **Step 1:** viết 3 file; `pnpm build && pnpm exec agentflow-app types` → `wrote N package files`.
- [ ] **Step 2:** `pnpm test` → PASS.
- [ ] **Step 3: Commit** — `feat(config): khách hàng, nhà cung cấp, nhân sự`

---

### Task 10: Bundle engine thành Code step và workflow tự kiểm

**Files:**
- Create: `src/pl/code-entry.ts`, `scripts/build-code.mjs`, `config/build/pl-selftest.mjs`
- Generated + committed: `config/code/compute_pl.js`
- Modify: `package.json` (devDependency `esbuild`, script `"build:code": "node scripts/build-code.mjs"`, `"build"` thành `"node scripts/build-code.mjs && agentflow-app build"`), `agentflow.app.mjs` (thêm module `pl-selftest`, ORDER `["open_case", "pl_selftest"]` hoặc thứ tự `merge` yêu cầu)
- Test: `test/pl/code-bundle.test.ts`

**Interfaces:**
- Produces: `export function runComputePl(inputs: { input: PlOrderInput; config: ConfigRecords | null }): PlResult;` (config `null` → `DEFAULT_CONFIG`). `config/code/compute_pl.js` định nghĩa hàm toàn cục `function main(inputs) { return PL.runComputePl({ input: inputs.input, config: inputs.config }); }` sau một IIFE esbuild (`format: 'iife'`, `globalName: 'PL'`, `target: 'es2020'`, không minify, có banner `// GENERATED by scripts/build-code.mjs — do not edit`).
- Kế hoạch 02 dùng: workflow gọi `code(id, name, "code/compute_pl.js", [["input", …], ["config", …]], outputSchema)`.
- `pl_selftest`: workflow người chạy tay (start access `admin_group`, run as initiator), một Code step với `input` = `lit(<TM-1040 input>)`, `config` = `lit(null)`; End output `net_profit`, `passed`. Dùng để kiểm Code runner của deployment trong sandbox (Kế hoạch 08).

- [ ] **Step 1: Write the failing test** `test/pl/code-bundle.test.ts`
  - `bundle_is_fresh`: chạy esbuild trong bộ nhớ với cùng tùy chọn (export hàm `bundle()` từ `scripts/build-code.mjs`) → chuỗi bằng nội dung file đã commit.
  - `bundle_main_matches_engine`: nạp file bằng `new Function(code + '; return main;')()`, gọi với input TM-1040 → `netProfit` `toBeCloseTo(46_272_444.44, 2)`, bằng `computePl` trực tiếp.
  - `bundle_reads_only_declared_inputs`: mã nguồn file chỉ chứa `inputs.input` và `inputs.config`.
- [ ] **Step 2:** FAIL. **Step 3:** viết `code-entry.ts`, script, workflow; `pnpm build:code`.
- [ ] **Step 4:** `pnpm build && pnpm exec agentflow-app types && pnpm test` → tất cả PASS, `package/ matches the config`. Nếu builder từ chối điều gì về Code step (kích thước file, cú pháp), ghi `F-xx` vào `docs/sdk-feedback.md`.
- [ ] **Step 5: Commit** — `feat(pl): bundle bộ tính P&L thành Code step, workflow tự kiểm`

---

### Task 11: Cập nhật tài liệu và đóng kế hoạch

**Files:**
- Modify: `README.md`, `AGENTS.md` (mục "Where things are": thêm `src/pl/`, `scripts/build-code.mjs`, `config/code/compute_pl.js` sinh tự động, các entity cấu hình; quy tắc: không sửa `config/code/compute_pl.js` bằng tay)
- Modify: `docs/superpowers/plans/2026-11-03-00-roadmap.md` (đánh dấu 01 xong)

- [ ] **Step 1:** sửa tài liệu.
- [ ] **Step 2:** `pnpm typecheck && pnpm test` → PASS.
- [ ] **Step 3: Commit & push** — `docs: cập nhật tài liệu sau kế hoạch 01`; `git push -u origin main`.
