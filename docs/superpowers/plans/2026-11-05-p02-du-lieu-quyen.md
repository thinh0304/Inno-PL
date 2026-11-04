# Phase 2 · Dữ liệu đơn đầy đủ và quyền · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (người dùng đã chọn: làm trong session, TDD, ghi sổ,
> một lượt review cuối bằng reviewer độc lập, rồi một lượt sửa). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** lập được một đơn đầy đủ như thật (khách hàng, giao nhận, phiếu khảo sát, 6 giai đoạn deal, dòng hàng đủ trường), có kiểm
định dạng và trường bắt buộc ở cả module lẫn máy chủ, có danh bạ KH/NCC, và mỗi vai trò chỉ thấy đúng đơn và đúng số của mình.

**Architecture:** thêm hàm thuần vào `src/domain/` (`form.ts` kiểu dữ liệu đơn, `validate.ts`, `stages.ts`, `records.ts`) dùng chung cho
module và Code step `dieu_phoi`; thêm 6 entity (khách hàng, NCC, đề xuất mua hàng, tóm tắt đơn, lịch sử) và các trường mới; Code step
chặn t11 khi đơn không hợp lệ, ghi tóm tắt cho TM/PROC, lịch sử và `nguoi_duoc_chia`; module mở rộng màn đơn.

**Tech Stack:** như Phase 1 (sdk-v0.9.0, TypeScript, React 19, Vitest, esbuild).

**Spec:** `docs/superpowers/specs/2026-11-04-pl-v2-design.md` §3, §5.1, §6, §11.4, §12.1–12.4, §12.7 · **Lộ trình:**
`docs/superpowers/plans/2026-11-04-pl-v2-roadmap.md` (Phase 2) · **Phase 1:** `2026-11-04-p01-lat-mong.md`

## Global Constraints

- Như Phase 1: không đọc `docs/archive/`, không in/commit `.env` `keys/`, không sửa tay `package/` `config/code/`, `pnpm exec
  agentflow-app types` sau khi đổi object, màu enum chỉ trong bộ cho phép, module theo luật `styles.test.ts`/`ui-build.test.ts`.
- **Test tối thiểu** mỗi task; sandbox chỉ chạy `e2e/p02-quyen.sandbox.test.ts` và (vì hàm tạo đơn dùng chung đổi) `e2e/p01-lat-mong.sandbox.test.ts`; deploy
  sandbox **một lần** (không `--upgrade`: có đổi kiểu trường) ở Task 7, thêm một lần cho lượt sửa sau review nếu cần.
- Quy tắc định dạng và trường bắt buộc: spec §12.1, §12.2 (bảng chép nguyên). FIN, SM tạm bỏ qua. Mã đơn `TM-`/`DV-` (spec §12.3).
- Danh sách người chọn bằng bộ chọn người (spec §3) cần đọc danh bạ AgentFlow (nền tảng 2026.11): **để Phase 3**; Phase 2 vẫn nhập mã
  người dùng.
- Mỗi vướng mắc SDK mới: một mục F-xx trong `docs/sdk-feedback.md`.

## Review Focus

1. **Đơn bị sửa sau khi gửi duyệt** bởi người không phải AM/IS (TM, PROC, SD…) hoặc bởi AM khi đơn đã `dang_xu_ly`: phải bị từ chối ở dòng, giá bán, tài chính, tóm tắt. Test: Task 7 e2e.
2. **Hai người tạo KH cùng mã KH**: không tạo trùng; module dùng hồ sơ có sẵn. Test: Task 6 (`customerBook`), Task 7 e2e (409 natural key).
3. **Số điện thoại / ngày / MST gõ lệch dạng** (`+84 909 123 456`, `5-11-2026`, `0312345678 ` có khoảng trắng): tự chuẩn hóa rồi mới kiểm. Test: Task 1.
4. **Tổng tỷ lệ giai đoạn lệch do số thực** (0,1 + 0,2 + …) không được báo sai. Test: Task 2.
5. **Đơn tái ký thiếu số liệu năm trước** hoặc **nguồn KH là Team Marketing / Other**: kiểm đúng, không chia Lead cho ai. Test: Task 1, Task 2.

---

## Bố cục file

| File | Trách nhiệm |
|---|---|
| `src/domain/form.ts` | kiểu `OrderForm`, `LineForm`, `StageForm`; giá trị mặc định `emptyOrder`, `emptyLine` |
| `src/domain/validate.ts` | `normalize`, `checkFormat`, `validateOrder` (§12.1, §12.2) |
| `src/domain/stages.ts` | 4 bộ hệ số giai đoạn (§5.1), `stageSetFor`, `defaultStages`, `stagesIssue`, `recipientsOf` |
| `src/domain/records.ts` | `formFromRecords`: bản ghi API → `OrderForm`, `LineForm[]` (dùng ở Code step và module) |
| `config/entities/*.json` | thêm trường; entity mới `khach_hang`, `nha_cung_cap`, `de_xuat_mua_hang`, `tom_tat_don`, `lich_su` |
| `src/code/dieu-phoi.ts`, `config/build/dieu-phoi.mjs` | cổng kiểm t11, tóm tắt, lịch sử, `nguoi_duoc_chia` |
| `src/module/*` | màn đơn đủ trường, danh bạ, sao chép danh mục, điền nhanh, xóa đơn |
| `test/domain/*.test.ts`, `test/code/*`, `test/module/*`, `e2e/p02-quyen.sandbox.test.ts`, `e2e/helpers.ts` | test |

---

### Task 1: Kiểu dữ liệu đơn và kiểm định dạng

**Files:** Create `src/domain/form.ts`, `src/domain/validate.ts`, `test/domain/validate.test.ts`.

**Interfaces (Produces):**

```ts
// form.ts
export type VatCode = 'kct' | '0' | '5' | '8' | '10';
export interface LineForm { id?: string; priceId?: string; sku: string; mo_ta: string; dvt: string; so_luong: number; loai: string;
  so_thang: number; gia_mua: number; gia_mua_usd: number; don_gia_ban: number; chiet_khau: number; vat: VatCode; ncc_id: string;
  co_cq: '' | 'co' | 'khong'; ngay_bat_dau: string; ngay_ket_thuc: string }   // ngày dạng dd/mm/yyyy khi nhập, ISO khi lưu: record mapper đổi
export interface StageForm { ma: StageCode; nv: string; pct: number }   // pct là phân số (0,2 = 20%)
export type StageCode = 'co_hoi' | 'lam_ro' | 'bao_gia' | 'dam_phan' | 'chot' | 'hd_tt_cskh';
export interface OrderForm { id?: string; financeId?: string; khach_hang_id: string;
  ten_kh; ma_kh; mst; nguoi_lien_he; dien_thoai; email; dia_chi; nguoi_dai_dien; chuc_vu; so_tk; ngan_hang: string;
  noi_dung; so_hd_noi_bo; so_hd_po; ngay_ky; ngay_bao_gia; hieu_luc_den: string; ty_gia: number;
  nguoi_nhan; sdt_nhan; dia_chi_nhan; email_nhan_license; ghi_chu_giao: string;
  am; is: string; hang_kh: 'vip'|'tiem_nang'|'pho_thong'; cong_no_ngay; cpbh: number; so_lan_tt: number;
  nv_trien_khai; nv_tu_van: string; tv_proposal; tv_poc: boolean; loai_hd_chon: string; tu_truoc: boolean;
  don_moi: boolean; kh_moi: boolean; nguon_kh: 'khong'|'nguoi'|'marketing'|'other'; nguon_kh_nguoi: string; hinh_thuc: ''|'hop_dong'|'don_hang'|'thau';
  so_hd_truoc: string; cpbh_truoc; doanh_thu_truoc; ln_truoc: number | null;   // null = chưa nhập (không mặc định 0)
  giai_doan: StageForm[] }
// validate.ts
export type FormatKind = 'phone'|'email'|'date'|'taxId'|'account'|'customerCode'|'contractNo'|'sku'|'personName'|'text'|'unit'|'money'
  |'quantity'|'months'|'percent'|'creditDays'|'days'|'payments'|'count';
export function normalize(kind: FormatKind, raw: string): string;
export function checkFormat(kind: FormatKind, value: string): string | null;   // null = hợp lệ, ngược lại mã lỗi (ví dụ 'format.phone')
export interface Issue { field: string; code: string }   // field: khóa trường, hoặc `dong_<n>.<trường>`
export function validateOrder(order: OrderForm, lines: LineForm[]): Issue[];
```

- [ ] **Step 1: Viết test thất bại** `validate.test.ts` (một `it` mỗi nhóm, giá trị đúng spec §12.1):
  - `normalize('phone', '+84 909 123 456')` → `0909 123 456`; `'028-3800-0000'` → `028 3800 0000`; `checkFormat('phone','0909123456')` null, `'0109123456'` và `'12345'` lỗi.
  - `normalize('date', '5-11-2026' | '5.11.2026' | '2026-11-05' | '05112026')` → `05/11/2026`; `checkFormat('date','31/02/2026')` lỗi, `'05/11/1999'` lỗi (năm 2000–2100).
  - `normalize('taxId',' 0312345678 ')` → `0312345678`; hợp lệ `0312345678`, `0312345678-001`; lỗi `031234567`, `0312345678-01`.
  - `normalize('customerCode',' sogtvtld ')` → `SOGTVTLD`; `checkFormat('customerCode','A')` lỗi (2–20 ký tự).
  - `email`: `normalize` → chữ thường bỏ khoảng trắng; `checkFormat('email','a@b')` lỗi, `'cntt@barria.gov.vn'` hợp lệ.
  - số: `checkFormat('quantity','0')` lỗi, `'17'` ok, `'1.5'` lỗi; `'months','121'` lỗi; `'percent','100,5'` lỗi; `'creditDays','366'` lỗi; `'payments','13'` lỗi.
  - `validateOrder`: đơn rỗng → có `ten_kh`, `ma_kh`, `mst`, `am`, `is`, `dong_hang` (không có dòng); giai đoạn thiếu người → `giai_doan.0.nv`; tổng giai đoạn lệch → `giai_doan.tong`.
  - Review Focus #5: `don_moi:false` thiếu `so_hd_truoc` hoặc `doanh_thu_truoc ≤ 0` hoặc `ln_truoc > doanh_thu_truoc` → các lỗi tương ứng; `nguon_kh:'marketing'` hợp lệ không cần `nguon_kh_nguoi`; `nguon_kh:'nguoi'` thiếu `nguon_kh_nguoi` → lỗi; `don_moi:false` mà `nguon_kh ≠ 'khong'` → lỗi.
  - Dòng: TB thiếu `sku` → `dong_1.sku`; TB `co_cq:''` → `dong_1.co_cq`; `loai` `lic_dk` thiếu ngày → `dong_1.ngay_bat_dau`; `cloud_server` `so_thang:0` → `dong_1.so_thang`; `ngay_ket_thuc` trước `ngay_bat_dau` → `dong_1.ngay_ket_thuc`; thiếu `ncc_id` → `dong_1.ncc_id`; tổng tỷ lệ tạm ứng không thuộc phạm vi Phase 2.
  - Một đơn đầy đủ hợp lệ (đơn mẫu dựng trong test) → `[]`.
- [ ] **Step 2:** `pnpm vitest run test/domain/validate.test.ts` → FAIL (module chưa có).
- [ ] **Step 3:** Viết `form.ts` (kiểu + `emptyOrder(am)`, `emptyLine()`), `validate.ts` theo bảng §12.1 (chép nguyên quy tắc: di động 10 số bắt đầu 03/05/07/08/09, cố định 11 số bắt đầu 02; ngày thật năm 2000–2100; MST 10 số hoặc `10-3`; TK 6–19 số; mã KH 2–20 ký tự in hoa; số HĐ 2–40; SKU 1–40; họ tên 2–80 không số/`@`; văn bản 2–300; ĐVT 1–20; số tiền ≥ 0; SL nguyên > 0; số tháng nguyên 0–120; % 0–100; công nợ nguyên 0–365; số ngày 0–365; số lần thanh toán 1–12; đếm ≥ 0). `validateOrder` gom lỗi trường bắt buộc (§12.2) + định dạng + ràng buộc chéo (ngày kết thúc sau ngày bắt đầu, hiệu lực sau ngày báo giá, LN năm trước ≤ DT năm trước).
- [ ] **Step 4:** test PASS; `pnpm typecheck`; commit `feat(domain): kiểu đơn và kiểm định dạng`.

### Task 2: Giai đoạn deal và người được chia

**Files:** Create `src/domain/stages.ts`, `test/domain/stages.test.ts`.

**Interfaces (Produces):** (dùng `StageCode`, `StageForm` của Task 1)

```ts
export type StageSet = 'new_tm' | 'new_dv' | 'tmdk' | 'dv_renew';
export const STAGE_SETS: Record<StageSet, { lead: number } & Record<StageCode, number>>;   // §5.1 (Lead: 0.3, 0.3, 0, 0)
export function stageSetFor(kind: ContractKind, donMoi: boolean): StageSet;     // DV 1 lần / DV định kỳ → new_dv | dv_renew; còn lại → new_tm | tmdk
export function defaultStages(set: StageSet, am: string, is: string): StageForm[];  // AM cho 5 giai đoạn đầu, IS giai đoạn cuối
export function stagesIssue(stages: StageForm[], set: StageSet): string | null;   // null hợp lệ; sai số thực ≤ 1e-6 được bỏ qua
export function recipientsOf(stages: StageForm[], nguon: { kind: 'khong'|'nguoi'|'marketing'|'other'; nguoi: string }): string[];  // người phụ trách các giai đoạn + người mang KH về; không trùng, không rỗng
```

- [ ] **Step 1: Test thất bại:** bảng hệ số khớp §5.1 (`new_tm`: Lead 0,3, 0,2, 0,3, 0,1, 0,1, 0,2, 0,1; `new_dv`: 0,3, 0,2, 0,3, 0,05, 0,1, 0,2, 0,15; `tmdk`: 0, 0, 0, 0,1, 0,1, 0,2, 0,1; `dv_renew`: 0, 0, 0, 0,05, 0,1, 0,2, 0,15); `stageSetFor('Thương Mại', true)='new_tm'`, `('License/Runrate', false)='tmdk'`, `('Dịch vụ Loại I', true)='new_dv'`, `('Fulfillment', false)='tmdk'`; `defaultStages` gán IS giai đoạn cuối; `stagesIssue` bỏ qua sai số `0.1+0.2+…` (Review Focus #4) và báo lỗi khi tổng lệch 1%; `recipientsOf` với `marketing` không thêm ai, với `nguoi` thêm người đó, loại trùng.
- [ ] **Step 2:** FAIL → **Step 3:** viết `stages.ts` (tổng hợp lệ = tổng 6 giai đoạn của bộ, không tính Lead) → **Step 4:** PASS; typecheck; commit `feat(domain): giai đoạn deal và người được chia`.

### Task 3: Ánh xạ bản ghi ↔ đơn

**Files:** Create `src/domain/records.ts`, `test/domain/records.test.ts`; Modify `src/module/model.ts` (tái dùng kiểu `OrderForm`/`LineForm`, giữ `toPlInput`, `onlyMine`).

**Interfaces (Produces):**

```ts
export type Rec = Record<string, unknown> & { id: string };
export function flat(r: unknown): Rec;                       // body hoặc phẳng (đã có trong dieu-phoi.ts: chuyển sang đây)
export function formFromRecords(src: { don: unknown; finance?: unknown; dong: unknown; gia_ban: unknown }): { order: OrderForm; lines: LineForm[] };
export function orderPayload(o: OrderForm): Record<string, unknown>;     // trường của don_hang
export function financePayload(o: OrderForm): Record<string, unknown>;   // cpbh + số liệu năm trước
export function linePayload(donId: string, l: LineForm, stt: number): Record<string, unknown>;   // dong_hang (ngày đổi dd/mm/yyyy → ISO)
```

- [ ] **Step 1: Test thất bại:** bản ghi dạng `{ id, body: {...} }` và dạng phẳng cho cùng một `OrderForm`; ngày lưu `2026-11-05` ↔ form `05/11/2026`; `cpbh_truoc` rỗng → `null` (không 0); `giai_doan` list → `StageForm[]` đủ 6 phần tử theo thứ tự `StageCode` ngay cả khi bản ghi thiếu; `payload` → `form` khứ hồi bằng nhau (round-trip).
- [ ] **Step 2:** FAIL → **Step 3:** viết `records.ts`, chuyển `flat`/`n`/`str`/`idOf` từ `src/code/dieu-phoi.ts` sang đây; `dieu-phoi.ts` import lại → **Step 4:** `pnpm vitest run test/domain test/code` PASS; typecheck; commit `refactor(domain): ánh xạ bản ghi và đơn`.

### Task 4: Entity, trường và quyền

**Files:** Modify `config/entities/{don_hang,dong_hang,tai_chinh_don,task}.json` (nếu cần), Create `config/entities/{khach_hang,nha_cung_cap,de_xuat_mua_hang,tom_tat_don,lich_su}.json`, Modify `config/package-manifest.json` (changelog, version `0.2.0`), `sandbox.json` (không đổi người), `src/generated/app.ts`.

**Trường mới** (khóa ASCII không dấu, kiểu theo `entities.md`; `*` bắt buộc ở máy chủ chỉ qua Code step, **không** `required` ở entity để người dùng lưu nháp):
- `don_hang`: `ma_loai` enum `tm|dv` (module đặt lúc tạo theo dòng hàng, không đổi), `ma_don` auto_number scope `don_hang:{{ ma_loai }}` format `{{ ma_loai | upper }}-{{ value | pad(4) }}` **(chưa chắc nền tảng nhận scope/format đọc trường: nếu bị từ chối khi cài, quay về `DH-{{ value | pad(4) }}`, ghi F-xx, và lưu `ma_loai` để hiển thị tiền tố ở module)**; `khach_hang` ref; `dien_thoai`, `email`, `dia_chi`, `nguoi_dai_dien`, `chuc_vu`, `so_tk`, `ngan_hang`; `so_hd_po`, `ngay_ky` date, `ngay_bao_gia` date, `hieu_luc_den` date, `ty_gia` number mặc định 26000; giao nhận `nguoi_nhan`, `sdt_nhan`, `dia_chi_nhan`, `email_nhan_license`, `ghi_chu_giao`; `so_lan_tt` number; `don_moi` bool mặc định true; `kh_moi` bool; `nguon_kh` enum `khong|nguoi|marketing|other`, `nguon_kh_nguoi` user; `hinh_thuc` enum `hop_dong|don_hang|thau`; `giai_doan_deal` list (`ma` enum 6 giai đoạn, `nv` text mã người dùng, `pct` number); `nguoi_duoc_chia` reference_list Users (Code step ghi); `ly_do_gui` text (lý do máy chủ trả t11). **Bỏ** `nhom ky_thuat/mua_hang` không đổi.
- `tai_chinh_don`: `so_hd_truoc`, `cpbh_truoc`, `doanh_thu_truoc`, `ln_truoc` (số liệu năm trước: tiền, nên ở đây).
- `dong_hang`: `gia_mua_usd`, `vat` enum (`kct|0|5|8|10`, mặc định `8`), `ncc_id` ref `nha_cung_cap`, `co_cq` enum `co|khong`, `ngay_bat_dau`, `ngay_ket_thuc` date; trường `ncc` text cũ **bỏ**.
- `khach_hang`: `ma_kh` (natural key duy nhất), `ten`, `mst`, `dia_chi`, `nguoi_dai_dien`, `chuc_vu`, `so_tk`, `ngan_hang`, `hang_kh`, `nguoi_lien_he`, `email`, `dien_thoai`. Quyền: `nhom_sales` create/read/list/update `organization`; SD, ACC, Admin read/list; automation read.
- `nha_cung_cap`: `ten` (natural key), `nguoi_lien_he`, `sdt`, `email`, `cong_no_ngay`, `dot_thanh_toan` list (`ten`, `ty_le`, `ngay`). Quyền: `nhom_sales` và `nhom_proc` create/read/list/update; SD, ACC, Admin, TM read/list.
- `de_xuat_mua_hang` (1–1 với dòng TB/License): `dong_hang` ref, `don_hang` ref, `gia_mua_de_xuat` number, `ncc_id` ref, `ly_do` text. Quyền: **chỉ** `nhom_proc` create/read/list/update; `nhom_sd`, `nhom_acc`, `nhom_admin` read/list; automation read. Không AM/IS/TM.
- `tom_tat_don` (Code step ghi): `don_hang` ref, `phan` enum `dich_vu|hang_hoa`, `du_lieu` text (JSON), `nhom_xem` reference_list Groups. Quyền: `everyone` read/list với record scope `field nhom_xem`; `nhom_tu_dong` create/read/list/update; SD, ACC, Admin read/list. Không ai khác create/update (người dùng không ghi được).
- `lich_su`: `don_hang` ref, `thoi_gian` datetime, `nguoi` user, `hanh_dong` text, `task` text, `ghi_chu` text, `truoc` text, `sau` text. Quyền: `nhom_sales` read/list (record scope parent `am`/`is`), SD, ACC, Admin read/list; `nhom_tu_dong` create; **không ai update/delete**.
- `don_hang` quyền thêm record scope `field nguoi_duoc_chia` cho `read`/`list` của `nhom_sales`; `dong_hang`, `gia_ban_dong`, `tai_chinh_don`, `lich_su` cho `read`/`list`: `parent_field don_hang → nguoi_duoc_chia`. `nhom_sales` `delete` trên `don_hang` scope `am`/`is` (xóa đơn nháp); rule `chi_xoa_don_nhap`: xóa chỉ khi `trang_thai ∈ {nhap}`; Admin `delete` `organization`.

- [ ] **Step 1:** Viết/sửa JSON (script scratch như Phase 1 được, JSON là nguồn); `pnpm build` đến khi `wrote N package files`.
- [ ] **Step 2:** `pnpm af sandbox check`, `pnpm check`, `pnpm exec agentflow-app types`, `pnpm typecheck`.
- [ ] **Step 3:** commit `feat(config): dữ liệu đơn đầy đủ, danh bạ, tóm tắt, lịch sử`.

### Task 5: Điều phối: cổng kiểm t11, tóm tắt, lịch sử, người được chia

**Files:** Modify `src/code/dieu-phoi.ts`, `config/build/dieu-phoi.mjs`, `test/code/dieu-phoi.test.ts`; Create `src/domain/summary.ts`, `test/domain/summary.test.ts`.

**Interfaces:**
- `summary.ts`: `summaryFor(part: 'dich_vu'|'hang_hoa', lines: Line[], cfg: PlConfig, pl: PlResult): Record<string, number>` — dịch vụ: doanh thu và giá vốn theo từng loại dịch vụ, `hotro_kt`, `thuong_trien_khai`, `thuong_tu_van`; hàng hóa: tổng giá vốn TB/LIC, tổng giá bán và giá Mua hàng đề xuất bên PROC xem (Phase 3 điền giá Mua hàng; Phase 2 chỉ giá Sale).
- Output Code step thêm: `lich_su: {hanh_dong, task, ghi_chu}[]`, `tom_tat: {phan, du_lieu, nhom_xem}[]`, `don.nguoi_duoc_chia: string[]`, `don.ly_do_gui: string` (rỗng khi hợp lệ), `don.loai_hd` không đổi.
- Input Code step thêm: `khach`-liên quan không cần; `dong` đã có `gia_mua`, nay thêm `ncc_id`, ngày, `vat`...; dùng `formFromRecords` + `validateOrder`.

- [ ] **Step 1: Test thất bại** (`test/code/dieu-phoi.test.ts`, `summary.test.ts`):
  - t11 `xong` mà `validateOrder` có lỗi (thiếu `mst`) → `tao` chỉ có t11 mới, `don.trang_thai='tra_lai'`, `don.ly_do_gui` liệt kê `mst`, `lich_su` có `tra_lai`; đơn hợp lệ → `ly_do_gui=''`.
  - đơn hỗn hợp hợp lệ, t11 `xong` → `tom_tat` có đúng hai bản (`dich_vu` với `nhom_xem=[nhom_tm]`, `hang_hoa` với `[nhom_proc]`), `summary` dịch vụ **không** có LN thuần/CPBH (Review Focus: số nhạy cảm), `don.nguoi_duoc_chia` = người phụ trách giai đoạn + nguồn KH không trùng; `lich_su` có `gui_duyet` và `chot_pl`.
  - đơn chỉ dịch vụ → chỉ bản `dich_vu`.
- [ ] **Step 2:** FAIL → **Step 3:** cài đặt; trong `dieu-phoi.mjs` thêm For Each ghi `lich_su` (create), For Each upsert `tom_tat_don` (tìm theo đơn + `phan` rồi update/create trong body: dùng `search` + decision hoặc xóa-tạo lại; chọn cách ít bước nhất), update đơn ghi `nguoi_duoc_chia`, `ly_do_gui`; thêm input `nhom_tm`... đã có → **Step 4:** `pnpm build` + `pnpm vitest run test/code test/domain` PASS; commit `feat(flow): cổng kiểm t11, tóm tắt, lịch sử, người được chia`.

### Task 6: Module

**Files:** Modify `src/module/{api.ts,model.ts,text.ts,styles.css}`, `src/module/screens/{DonHang,LinesTable,DanhSachDon}.tsx`; Create `src/module/screens/{KhachHang,Giao,GiaiDoan}.tsx`, `src/module/customerBook.ts`; Test `test/module/{customer-book,don-hang}.test.ts(x)`.

**Interfaces (Produces):** `customerBook.ts`:

```ts
export interface CustomerRec { id: string; ma_kh: string; ten: string; mst: string; dia_chi: string; nguoi_dai_dien: string; chuc_vu: string;
  so_tk: string; ngan_hang: string; nguoi_lien_he: string; email: string; dien_thoai: string; hang_kh: string }
export function suggest(book: CustomerRec[], query: string): CustomerRec[];          // từ 2 ký tự; theo tên, mã KH, MST; không phân biệt dấu
export function fillEmpty(order: OrderForm, c: CustomerRec): { order: OrderForm; conflicts: { field: keyof OrderForm; current: string; fromBook: string }[] };  // chỉ điền ô trống; khác thì vào conflicts
export function suggestCode(name: string, taken: string[]): string;                  // viết tắt, bỏ loại hình DN, không trùng
export function quickFill(order: OrderForm, how: 'contact' | 'address'): OrderForm;  // điền nhanh giao nhận: = người liên hệ / = địa chỉ KH
```

- [ ] **Step 1: Test thất bại:** `suggest(book,'so g')` tìm `SOGTVTLD` không phân biệt dấu (`'Sở Giao thông'`), `'a'` (1 ký tự) → `[]`; `fillEmpty` không ghi đè ô đã nhập, đưa khác biệt vào `conflicts` (Review Focus #2: không tạo mã KH trùng: `suggestCode('CÔNG TY TNHH ABC', ['ABC'])` → `ABC2`); `quickFill`; `DonHang` hiện viền lỗi/`aria-invalid` ở ô sai và banner đếm lỗi sau khi nhập `0109123456` vào SĐT; nút Xóa chỉ hiện khi đơn `nhap`.
- [ ] **Step 2:** FAIL → **Step 3:** cài đặt: màn đơn chia khối (Khách hàng, Giao nhận, Phiếu khảo sát, Giai đoạn deal, Dòng hàng, P&L); ô tự chuẩn hóa khi rời ô (`normalize`); `api.ts` đọc/ghi các trường mới, tìm-hoặc-tạo `khach_hang` theo `ma_kh`, danh bạ NCC (chọn theo tên), sao chép danh mục từ đơn trước cùng KH, xóa đơn; `ma_loai` đặt lúc tạo theo dòng hàng; hiện `ly_do_gui` khi đơn bị trả lại; bản tóm tắt thay P&L cho TM/PROC → **Step 4:** `pnpm vitest run test/module` PASS; `pnpm typecheck`, `pnpm build`, `pnpm check`; commit `feat(module): đơn đủ trường, danh bạ, sao chép danh mục, xóa đơn`.

### Task 7: Sandbox, quyền chéo, tài liệu

**Files:** Create `e2e/helpers.ts` (chuyển `create/query/get/patch/tasksOf/live/finish/newOrder/submitT11` từ `p01`, `newOrder` tạo **đơn hợp lệ đủ trường** theo `validateOrder`), `e2e/p02-quyen.sandbox.test.ts`; Modify `e2e/p01-lat-mong.sandbox.test.ts` (dùng helpers), `README.md`, `AGENTS.md`, `docs/sdk-feedback.md` (nếu có F-xx).

- [ ] **Step 1: Test sandbox** `p02-quyen`:
  - AM lập đơn đầy đủ → t11 xong → t22/t23 mở (cổng kiểm cho qua); đơn **thiếu `mst`** → t11 xong → đơn `tra_lai`, `ly_do_gui` có `mst`.
  - Đọc chéo theo bảng: `tm1` đọc `tom_tat_don` phần `dich_vu` (không thấy `hang_hoa`), `proc1` ngược lại; `tm1`/`proc1` bị từ chối trên `de_xuat_mua_hang`, `gia_ban_dong`, `tai_chinh_don`, `lich_su` (dùng GET theo id đã biết, không `.catch(() => [])`); `proc1` ghi được `de_xuat_mua_hang`, `am1` không đọc được; `is1`/`am1` đọc đơn của mình; người **được chia** (đặt `is1` là người phụ trách giai đoạn cuối, `am2` không thuộc đơn) đọc được, người không liên quan không đọc được (cần thêm người `am2` vào `sandbox.json`).
  - Review Focus #1: sau khi gửi duyệt, `am1` sửa `dong_hang`, `gia_ban_dong`, `tai_chinh_don`, `don_hang.ten_kh` → bị từ chối; `tm1` sửa dòng → bị từ chối; `lich_su` không sửa/xóa được.
  - Review Focus #2: tạo `khach_hang` hai lần cùng `ma_kh` → lần hai 409.
  - Xóa đơn: `am1` xóa đơn `nhap` được, đơn `dang_xu_ly` bị từ chối; `admin` xóa được.
- [ ] **Step 2:** `pnpm af deploy --sandbox` (không `--upgrade`), `pnpm test:sandbox e2e/p02-quyen.sandbox.test.ts e2e/p01-lat-mong.sandbox.test.ts`.
- [ ] **Step 3:** Cập nhật README, AGENTS.md ("Where things are"), bảng tiến độ lộ trình; `pnpm typecheck`, `pnpm build`, `pnpm check`; commit `test(e2e): phase 2 trên sandbox; docs`.

### Kết thúc phase

- [ ] Review cuối bằng reviewer độc lập (mô hình mạnh nhất): đọc code, chạy các test của mục "Kiểm tra"; **một** lượt sửa, mỗi lỗi có test đỏ trước.
- [ ] Cập nhật bảng "Sổ tiến độ" của lộ trình; merge vào `rebuild` khi người dùng bảo.

## Kiểm tra (cả phase)

`pnpm vitest run test/domain test/code test/module` · `pnpm typecheck` · `pnpm build` · `pnpm check` ·
`pnpm test:sandbox e2e/p02-quyen.sandbox.test.ts e2e/p01-lat-mong.sandbox.test.ts` (một lần, sau một lần deploy).
