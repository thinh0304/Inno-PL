# Góp ý cho đội phát triển AgentFlow SDK

Dự án: `inno/pl` (TeraBox · Hiệu quả đơn hàng P&L) · SDK `sdk-v0.7.0` · Bắt đầu: 02/11/2026

Mỗi mục ghi: chỗ vướng, bằng chứng trong SDK, cách dự án đang làm tạm, và đề xuất. Mức độ: **Chặn** (không làm được trong package), **Lớn** (phải đi đường vòng tốn công), **Nhỏ** (bất tiện).

| # | Mức | Chủ đề | Tóm tắt |
|---|---|---|---|
| F-01 | Lớn | Workflow | Package không mang được fork/join |
| F-02 | Lớn | Workflow | Package không cho graph có vòng lặp |
| F-03 | Lớn | Quyền | Grant không có quyền theo trường; package không đánh dấu được trường nhạy cảm |
| F-04 | Nhỏ | Quyền | Record scope không lọc theo giá trị trường |
| F-05 | Lớn | SLA | Mục tiêu SLA theo độ ưu tiên, không theo từng bản ghi / loại task |
| F-06 | Nhỏ | Formula | Formula không đọc được bản ghi cấu hình / tham số; không có hàm tra bậc |
| F-07 | Nhỏ | Bước workflow | Không có ví dụ cho `webhook`, `extract_text`, `integration`; builder không kiểm tham số |
| F-08 | Lớn | UI module | Module chỉ đếm được bản ghi; phép cộng số chỉ qua dashboard |

---

## F-01 · Package không mang được fork/join

- **Vướng:** quy trình đơn hàng có 15 task chạy song song theo tiền đề (ví dụ t22 Kỹ thuật và t23 Mua hàng cùng mở sau t11; t31 chờ cả hai).
- **Bằng chứng:** `agentflow-app-authoring/reference/steps.md`, "Steps a package cannot carry": *"`fork` and `join`: merge refuses a plain step with more than one outbound edge … the builder cannot make a parallel branch yet."* Nền tảng (designer) thì có fork/join.
- **Làm tạm:** mỗi task là một bản ghi entity có `work`; một workflow do trigger chạy, dùng Code step tính task nào được mở.
- **Đề xuất:** helper `fork(id, name, [edges])` / `join(id, name, { wait: "all" | "any" })` trong builder, và `merge` kiểm tra các nhánh hội tụ đúng.

## F-02 · Package không cho graph có vòng lặp

- **Vướng:** "Trả lại" (t22, t31) đưa đơn về GĐ1 rồi đi lại; "Yêu cầu sửa dự thảo" (t42) mở lại t40/t44.
- **Bằng chứng:** builder README, mục `merge`: *"… everything is reachable from `start`; no loops"*.
- **Làm tạm:** như F-01, quay lại bằng cách ghi dữ liệu, không phải cạnh graph.
- **Đề xuất:** cho phép cạnh quay lui tới một Human step (có giới hạn số vòng), hoặc một bước "go to" có điều kiện.

## F-03 · Không có quyền theo trường

- **Vướng:** Kỹ thuật (TM) được xem thông số dòng hàng nhưng không được xem giá; giá mua đề xuất của Mua hàng chỉ PROC / SD / ACC xem.
- **Bằng chứng:** `access.md`: grant chỉ có `operations` theo bản ghi; `entities.md`: `sensitive` bị builder từ chối (*"not a member the package's entity_field lists"*); `lint-problems.md`: `field_secured`.
- **Làm tạm:** tách entity: `order_line` (không giá), `order_line_price`, `purchase_proposal`, `order_pl` — thêm 3 entity 1–1, nhiều lần đọc/ghi hơn.
- **Đề xuất:** grant có `fields` (cho phép / loại trừ trường theo nhóm), hoặc cho package khai báo trường nhạy cảm kèm nhóm được xem, để Admin xác nhận khi cài.

## F-04 · Record scope không lọc theo giá trị trường

- **Vướng:** TM chỉ nên thấy "đơn có dịch vụ", PROC chỉ "đơn có TB / license".
- **Bằng chứng:** `access.md`, "Record scopes": chỉ `field` (người), `parent_field`, `work`.
- **Làm tạm:** TM / PROC đọc mọi đơn (phần không có tiền); module tự lọc hiển thị.
- **Đề xuất:** scope `{ "kind": "condition", "where": [{ field, op, value }] }`.

## F-05 · SLA theo từng loại task

- **Vướng:** mỗi task có SLA riêng (1, 2, 3, 7 ngày làm việc), Admin sửa được.
- **Bằng chứng:** `work.md`, `deadline`: mục tiêu lấy từ `sla_policy` theo `work_surface.priority`.
- **Làm tạm:** tự tính `due_at` bằng code (ngày làm việc T2–T6), workflow theo lịch quét quá hạn; không dùng đồng hồ của nền tảng.
- **Đề xuất:** clock nhận mục tiêu từ một trường số / thời lượng của bản ghi (`target_field`), vẫn tính theo lịch làm việc của tổ chức.

## F-06 · Formula không đọc tham số

- **Vướng:** P&L cần ngưỡng / tỷ lệ theo loại hợp đồng và bậc r theo hạng KH (Admin cấu hình).
- **Bằng chứng:** `entities.md`, "Formulas and rollups": formula đọc trường của chính bản ghi; rollup chỉ count/sum bản ghi con.
- **Làm tạm:** toàn bộ P&L bằng TypeScript (module) + Code step (workflow).
- **Đề xuất:** formula đọc được trường của bản ghi tham chiếu (`customer.tier`) và một bản ghi cấu hình đơn (singleton); hàm `lookup_tier(value, [thresholds], [rates])`.

## F-07 · Thiếu ví dụ cho các bước dùng dịch vụ ngoài

- **Vướng:** cần `webhook` (tra MST), `extract_text` (đọc báo giá / hợp đồng). (`document` thì đã có hướng dẫn trong `steps.md`.)
- **Bằng chứng:** `steps.md`: *"There is no shipped example of a `webhook`, `integration`, `signature`, `extract_text` … and the builder does not check their parameters."*
- **Làm tạm:** dựng thử trong designer, Pack, đọc bước đã chuyển đổi.
- **Đề xuất:** helper có kiểu cho từng bước + một ví dụ trong `examples/`.

## F-08 · UI module không cộng được số

- **Vướng:** màn hình KPI / Dashboard cần tổng doanh thu, LN thuần… theo kỳ, theo người, theo loại; Kỹ thuật và Mua hàng chỉ được thấy tổng phần dịch vụ / hàng hóa.
- **Bằng chứng:** `agentflow-ui-module/reference/records-api.md`, "Counting, and figures over many records": module đếm được bản ghi; phép cộng chỉ có ở `/dashboards/{id}/compute`, trong phạm vi quyền người xem.
- **Làm tạm:** khai báo dashboard trong package cho từng phép tổng; tách các con số theo vai trò ra entity riêng (`order_pl_service`, `order_pl_goods`) để mỗi vai trò cộng trên phần mình được đọc.
- **Đề xuất:** API aggregate (`sum` / `avg` / `group_by`) cho module, cùng quy tắc quyền như list.

## F-09 · `build --check` hỏng trên Windows khi git đổi xuống dòng

- **Vướng:** clone dự án trên Windows với `core.autocrlf=true` (mặc định của Git for Windows) thì `pnpm test` báo `PACKAGE_STALE` ngay trên bản sạch: git ghi `package/` ra CRLF, builder sinh LF, `--check` so từng byte.
- **Bằng chứng:** clone `thinh0304/inno-pl` ngày 03/11/2026: `PACKAGE_STALE: package/ does not match the config (stale: manifest.json, …)` khi chưa sửa gì; hết lỗi sau khi checkout lại với `core.autocrlf=false`.
- **Làm tạm:** `git config --local core.autocrlf false && git config --local core.eol lf`, rồi checkout lại.
- **Đề xuất:** starter kèm `.gitattributes` (`* text=auto eol=lf`), hoặc `--check` so sánh không phân biệt CRLF / LF.

## F-10 · Output `lit(...)` của bước End qua được build nhưng bị từ chối lúc cài

- **Vướng:** `end("locked", …, { skipped: lit(true) })` build và test xanh, nhưng khi cài: `APP_CONTRACT_UNDERIVABLE on workflow:compute_pl at INVALID_DEFINITION:/nodes/21/parameters`.
- **Bằng chứng:** `steps.md` ghi `end(id, name, outcome?, outputs?)` với `outputs` là `{ name: ref(...) | lit(...) }`; deploy sandbox 03/11/2026 từ chối như trên; bỏ output thì cài được.
- **Làm tạm:** chỉ dùng `ref(...)` trong output của End.
- **Đề xuất:** builder từ chối `lit` trong output của End (hoặc nền tảng nhận nó), và tài liệu nói rõ.

## F-11 · Rule không gắn được một trường với người đang ghi khi tạo bản ghi; không chặn được giá nằm sai entity

- **Vướng:**
  - Muốn chặn AM tạo đơn với `am` là người khác, và bắt Sales Admin là `sa` của đơn mình tạo.
  - Hai cách theo tài liệu đều không dùng được:
    - `{ "field": "am", "op": "ne", "value": { "$bind": "viewer.id" } }` bị từ chối lúc cài: `ENTITY_VALIDATION_RULE_INVALID: 'am' compares against a binding, which a write cannot resolve`.
    - Phép thử người ghi `in_field` không thấy giá trị mới khi tạo, nên rule chặn cả AM tạo đơn cho chính mình.
  - Cũng không viết được rule "giá dòng phải nằm ở entity đúng nhóm của mã loại", vì cần hai bước tham chiếu (giá → dòng → `item_type` theo mã chữ). Một giá nằm sai entity khiến TM / PROC đọc được tiền không thuộc phần mình (Thiết kế C2 / C3).
- **Bằng chứng:** deploy sandbox 03/11/2026, `e2e/orders.sandbox.test.ts`.
- **Làm tạm:**
  - `order.am` bắt buộc, không mặc định là người tạo, và khóa sau khi tạo (`am_is_fixed`).
  - Màn hình đặt `am` / `sa` đúng người.
  - `compute_pl` liệt kê giá nằm sai entity trong `order_pl.detail.misplacedPrices` để màn hình chuyển lại.
- **Đề xuất:**
  - Cho rule so một trường người với người đang ghi khi tạo (`$bind: viewer.id` trên write, hoặc `in_field` đọc giá trị mới).
  - Cho rule đi nhiều bước tham chiếu, hoặc tra cứu theo khóa tự nhiên.
