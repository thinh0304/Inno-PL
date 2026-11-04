# Góp ý cho đội phát triển AgentFlow SDK

Dự án: `inno/pl` (TeraBox · Hiệu quả đơn hàng P&L) · SDK `sdk-v0.7.0` (builder + `@reflexify/agentflow-sdk`) · AgentFlow `https://agentflow.innomation.vn` · Bắt đầu: 02/11/2026

Mỗi mục ghi: **Vướng** (việc cần làm), **Cách tái hiện** (lệnh hoặc thao tác tối thiểu để thấy đúng vấn đề), **Bằng chứng** (tài liệu hoặc kết quả chạy thật), **Làm tạm** (cách dự án đang làm) và **Đề xuất** (sửa SDK / nền tảng / tài liệu).
Mức độ: **Chặn** (không làm được trong package), **Lớn** (phải đi đường vòng tốn công), **Nhỏ** (bất tiện).
Nhãn độ chắc ở mục "Cách tái hiện": **Tái hiện được** (làm lại là thấy), **Thiếu tính năng** (không có gì để chạy, chỉ có tài liệu), **Chưa chắc** (đã quan sát nhưng chưa xác định nguyên nhân; nói rõ trong mục).

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
| F-09 | Nhỏ | Công cụ | `build --check` hỏng trên Windows khi git đổi xuống dòng |
| F-10 | Nhỏ | Workflow | Output `lit(...)` của bước End qua được build nhưng bị từ chối lúc cài |
| F-11 | Lớn | Rule | Rule không gắn được trường với người đang ghi khi tạo; không đi nhiều bước tham chiếu |
| F-12 | Nhỏ | Entity | Builder không kiểm màu của tùy chọn enum; lúc cài mới bị từ chối |
| F-13 | Nhỏ | Work | `when` của luật giao việc phải là một toán tử json-logic; builder không kiểm |
| F-14 | Nhỏ | Stage model | Ghi lại đúng trạng thái đang có có thể bị từ chối `STAGE_TRANSITION_NOT_ALLOWED` |
| F-15 | Lớn | Rule | Rule không chặn được xóa bản ghi |
| F-16 | Lớn | Code step | Code step hỏng không để lại thông báo lỗi nào |
| F-17 | Lớn | Form tạo | Tạo bản ghi qua API âm thầm bỏ trường không có trong form (kể cả trường danh sách) |
| F-18 | Nhỏ | UI module | `host.navigate` không có chế độ thay thế: chuyển hướng làm kẹt nút Back |
| F-19 | Nhỏ | Dữ liệu | Thời gian trong bản ghi có 9 chữ số thập phân và `+07:00`; cách bộ chạy Code đọc nó chưa rõ |
| F-20 | Nhỏ | Sandbox | Sau `deploy --sandbox` ("armed 7 triggers") trigger có thể chưa chạy trong vài phút đầu |
| F-21 | Nhỏ | Workflow | Mỗi lượt chạy mất 7–18 giây và các lượt xếp hàng; không có số liệu về hàng đợi |
| F-22 | Nhỏ | Test | `GET /app/objects` chỉ trả lời người gọi của chính ứng dụng: không dựng được `OrdersApi` từ người của sandbox |
| F-23 | Nhỏ | Workflow | `expect` của bước Update: cách so giá trị số / boolean khi giá trị là template chưa rõ |
| F-24 | Nhỏ | Tài liệu | Trả lời của `GET /work?view=` không được mô tả |
| F-25 | Chặn | UI module | Ứng dụng đã cài không tải file lên được (`POST /attachments` → `APP_CEILING_DENIED`); host không có cách nào khác để người dùng tải file |
| F-26 | Nhỏ | Dữ liệu | Trường `file` chỉ trả mảng id: tên file cần thêm một lần đọc `GET /attachments/{id}` mỗi file |
| F-27 | Chặn | UI module | File do workflow sinh ra (bước `document`) trả `404` qua ứng dụng, kể cả khi đã gắn vào bản ghi ứng dụng đọc được |
| F-28 | Nhỏ | Builder | `display_field` là trường `reference` qua được `build` và `sandbox check`, bị từ chối lúc cài |
| F-29 | Nhỏ | Rule | `changed_any` / `changed` coi giá trị mặc định lúc tạo là thay đổi: rule "chỉ hệ thống ghi trường X" chặn luôn việc tạo bản ghi |
| F-30 | Nhỏ | Form tạo | Danh sách Nhóm (`reference_list` tới Groups) trong create form qua được `build`, bị từ chối lúc cài; form tạo cũng từ chối `null` cho ngày, enum, người dùng |
| F-31 | Nhỏ | Quyền | Xóa một bản ghi kéo theo bản ghi con (`on_target_delete: cascade`) đòi người xóa có quyền `delete` trên từng entity con |

---

## F-01 · Package không mang được fork/join

- **Vướng:** quy trình đơn hàng có 15 task chạy song song theo tiền đề (ví dụ t22 Kỹ thuật và t23 Mua hàng cùng mở sau t11; t31 chờ cả hai).
- **Cách tái hiện** (tái hiện được): trong một file `config/build/*.mjs`, cho một bước hai cạnh đi ra, ví dụ `edges(["a","step","x"], ["b","step","y"])`, rồi chạy `pnpm build`: `merge` từ chối bước có nhiều hơn một cạnh ra.
- **Bằng chứng:** `agentflow-app-authoring/reference/steps.md`, "Steps a package cannot carry": *"`fork` and `join`: merge refuses a plain step with more than one outbound edge … the builder cannot make a parallel branch yet."* Nền tảng (designer) thì có fork/join.
- **Làm tạm:** mỗi task là một bản ghi entity có `work`; một workflow do trigger chạy, dùng Code step tính task nào được mở.
- **Đề xuất:** helper `fork(id, name, [edges])` / `join(id, name, { wait: "all" | "any" })` trong builder, và `merge` kiểm tra các nhánh hội tụ đúng.

## F-02 · Package không cho graph có vòng lặp

- **Vướng:** "Trả lại" (t22, t31) đưa đơn về GĐ1 rồi đi lại; "Yêu cầu sửa dự thảo" (t42) mở lại t40/t44.
- **Cách tái hiện** (tái hiện được): thêm một cạnh quay từ bước sau về bước trước trong cùng graph (`["back","step2","step1"]`) rồi `pnpm build`: lỗi `loop through step2 -> step1`.
- **Bằng chứng:** builder README, mục `merge`: *"… everything is reachable from `start`; no loops"*; `dist/workflow.js`, hàm `checkGraph`.
- **Làm tạm:** như F-01: quay lại bằng cách ghi dữ liệu, không phải cạnh graph.
- **Đề xuất:** cho phép cạnh quay lui tới một Human step (có giới hạn số vòng), hoặc một bước "go to" có điều kiện.

## F-03 · Không có quyền theo trường

- **Vướng:** Kỹ thuật (TM) được xem thông số dòng hàng nhưng không được xem giá; giá mua đề xuất của Mua hàng chỉ PROC / SD / ACC xem.
- **Cách tái hiện** (thiếu tính năng): thêm `"sensitive": true` vào một trường trong `config/entities/*.json` và `pnpm build`: bị từ chối. Thêm `"fields": [...]` vào một `operations` của grant: bị từ chối (grant chỉ nhận `operation`, `scope`, `record_scopes`).
- **Bằng chứng:** `access.md`: grant chỉ có `operations` theo bản ghi; `entities.md`: `sensitive` bị builder từ chối (*"not a member the package's entity_field lists"*); `lint-problems.md`: `field_secured`.
- **Làm tạm:** tách entity: `order_line` (không giá), `goods_line_price`, `service_line_price`, `purchase_proposal`, `order_pl` — thêm vài entity 1–1, nhiều lần đọc/ghi hơn, và quy tắc đúng-entity-đúng-nhóm chỉ kiểm bằng code (xem F-11).
- **Đề xuất:** grant có `fields` (cho phép / loại trừ trường theo nhóm), hoặc cho package khai báo trường nhạy cảm kèm nhóm được xem, để Admin xác nhận khi cài.

## F-04 · Record scope không lọc theo giá trị trường

- **Vướng:** TM chỉ nên thấy "đơn có dịch vụ", PROC chỉ "đơn có TB / license".
- **Cách tái hiện** (thiếu tính năng): khai báo `record_scopes: [{ "kind": "condition", "where": [...] }]` rồi `pnpm build`: `kind` không thuộc `field`, `parent_field`, `work`.
- **Bằng chứng:** `access.md`, "Record scopes": chỉ `field` (người), `parent_field`, `work`.
- **Làm tạm:** TM / PROC đọc mọi đơn (phần không có tiền); module tự lọc hiển thị.
- **Đề xuất:** scope `{ "kind": "condition", "where": [{ field, op, value }] }`.

## F-05 · SLA theo từng loại task

- **Vướng:** mỗi task có SLA riêng (1, 2, 3, 7 ngày làm việc), Admin sửa được.
- **Cách tái hiện** (thiếu tính năng): đọc `work.md`, mục `deadline`: không có cách khai báo mục tiêu lấy từ một trường của bản ghi; `clocks[].sla_policy` chỉ nhận một `sla_policy_ref`, và chính sách chọn mục tiêu theo `work_surface.priority`.
- **Bằng chứng:** `work.md`, `deadline`.
- **Làm tạm:** tự tính `due_at` bằng code (ngày làm việc T2–T6, giờ Việt Nam; `src/flow/calendar.ts`), workflow theo lịch quét quá hạn (`sla_sweep`); không dùng đồng hồ của nền tảng.
- **Đề xuất:** clock nhận mục tiêu từ một trường số / thời lượng của bản ghi (`target_field`), vẫn tính theo lịch làm việc của tổ chức.

## F-06 · Formula không đọc tham số

- **Vướng:** P&L cần ngưỡng / tỷ lệ theo loại hợp đồng và bậc r theo hạng KH (Admin cấu hình).
- **Cách tái hiện** (thiếu tính năng): viết formula tham chiếu trường của bản ghi khác hoặc của một bản ghi cấu hình: formula chỉ đọc trường của chính bản ghi; rollup chỉ count/sum bản ghi con.
- **Bằng chứng:** `entities.md`, "Formulas and rollups".
- **Làm tạm:** toàn bộ P&L bằng TypeScript (module) + Code step (workflow), một bản nguồn `src/pl/`.
- **Đề xuất:** formula đọc được trường của bản ghi tham chiếu (`customer.tier`) và một bản ghi cấu hình đơn (singleton); hàm `lookup_tier(value, [thresholds], [rates])`.

## F-07 · Thiếu ví dụ cho các bước dùng dịch vụ ngoài

- **Vướng:** cần `webhook` (tra MST), `extract_text` (đọc báo giá / hợp đồng). (`document` thì đã có hướng dẫn trong `steps.md`.)
- **Cách tái hiện** (thiếu tính năng): tìm ví dụ `webhook`, `integration`, `signature`, `extract_text` trong tài liệu và `examples/`: không có; thử dựng bước với tham số sai: builder không báo lỗi.
- **Bằng chứng:** `steps.md`: *"There is no shipped example of a `webhook`, `integration`, `signature`, `extract_text` … and the builder does not check their parameters."*
- **Làm tạm:** dựng thử trong designer, Pack, đọc bước đã chuyển đổi.
- **Đề xuất:** helper có kiểu cho từng bước + một ví dụ trong `examples/`; builder kiểm tham số bắt buộc.

## F-08 · UI module không cộng được số

- **Vướng:** màn hình KPI / Dashboard cần tổng doanh thu, LN thuần… theo kỳ, theo người, theo loại; Kỹ thuật và Mua hàng chỉ được thấy tổng phần dịch vụ / hàng hóa.
- **Cách tái hiện** (thiếu tính năng): trong module, `POST /entities/{id}/records/query` chỉ có lọc, sắp xếp, `cursor`: không có `aggregate` hay `group_by`; chỉ đếm được.
- **Bằng chứng:** `agentflow-ui-module/reference/records-api.md`, "Counting, and figures over many records": phép cộng chỉ có ở `/dashboards/{id}/compute`, trong phạm vi quyền người xem.
- **Làm tạm:** khai báo dashboard trong package cho từng phép tổng; tách các con số theo vai trò ra entity riêng (`order_pl_service`, `order_pl_goods`) để mỗi vai trò cộng trên phần mình được đọc.
- **Đề xuất:** API aggregate (`sum` / `avg` / `group_by`) cho module, cùng quy tắc quyền như list.

## F-09 · `build --check` hỏng trên Windows khi git đổi xuống dòng

- **Vướng:** clone dự án trên Windows với `core.autocrlf=true` (mặc định của Git for Windows) thì `pnpm test` báo `PACKAGE_STALE` ngay trên bản sạch: git ghi `package/` ra CRLF, builder sinh LF, `--check` so từng byte.
- **Cách tái hiện** (tái hiện được): trên Windows, `git config --global core.autocrlf true`, `git clone https://github.com/thinh0304/Inno-PL`, `pnpm install`, `pnpm test`: lỗi `PACKAGE_STALE: package/ does not match the config (stale: manifest.json, …)` khi chưa sửa gì.
- **Bằng chứng:** ngày 03/11/2026; hết lỗi sau khi checkout lại với `core.autocrlf=false`.
- **Làm tạm:** `git config --local core.autocrlf false && git config --local core.eol lf`, rồi checkout lại.
- **Đề xuất:** starter kèm `.gitattributes` (`* text=auto eol=lf`), hoặc `--check` so sánh không phân biệt CRLF / LF.

## F-10 · Output `lit(...)` của bước End qua được build nhưng bị từ chối lúc cài

- **Vướng:** `end("locked", …, { skipped: lit(true) })` build và test xanh, nhưng khi cài: `APP_CONTRACT_UNDERIVABLE on workflow:compute_pl at INVALID_DEFINITION:/nodes/21/parameters`.
- **Cách tái hiện** (tái hiện được): thêm `{ skipped: lit(true) }` làm output của một bước `end(...)`, `pnpm build` (xanh), `pnpm af deploy --sandbox`: lỗi như trên; bỏ output thì cài được.
- **Bằng chứng:** `steps.md` ghi `end(id, name, outcome?, outputs?)` với `outputs` là `{ name: ref(...) | lit(...) }`.
- **Làm tạm:** chỉ dùng `ref(...)` trong output của End.
- **Đề xuất:** builder từ chối `lit` trong output của End (hoặc nền tảng nhận nó), và tài liệu nói rõ.

## F-11 · Rule không gắn được một trường với người đang ghi khi tạo bản ghi; không chặn được giá nằm sai entity

- **Vướng:**
  - Muốn chặn AM tạo đơn với `am` là người khác, và bắt Sales Admin là `sa` của đơn mình tạo.
  - Muốn chặn một giá nằm sai entity so với nhóm của mã loại (giá → dòng → mã loại): TM / PROC sẽ đọc được tiền không thuộc phần mình (Thiết kế C2 / C3).
- **Cách tái hiện** (tái hiện được):
  - Thêm rule `{ "field": "am", "op": "ne", "value": { "$bind": "viewer.id" } }` vào `config/entities/order.json`, `pnpm build` xanh, `deploy --sandbox`: `ENTITY_VALIDATION_RULE_INVALID: 'am' compares against a binding, which a write cannot resolve`.
  - Thay bằng phép thử người ghi `in_field` (`am`): cài được nhưng khi AM tạo đơn cho chính mình, rule vẫn chặn, vì `in_field` không thấy giá trị mới.
  - Rule đi hai bước tham chiếu (`order_line.item_type_code` rồi tra `item_type`): không có cú pháp.
- **Bằng chứng:** `e2e/orders.sandbox.test.ts`, sandbox 03/11/2026.
- **Làm tạm:** `order.am` bắt buộc, không mặc định là người tạo, và khóa sau khi tạo (`am_is_fixed`); màn hình đặt `am` / `sa` đúng người; `compute_pl` liệt kê giá nằm sai entity trong `order_pl.detail.misplacedPrices` để màn hình chuyển lại.
- **Đề xuất:** cho rule so một trường người với người đang ghi khi tạo (`$bind: viewer.id` trên write, hoặc `in_field` đọc giá trị mới); cho rule đi nhiều bước tham chiếu, hoặc tra cứu theo khóa tự nhiên.

## F-12 · Builder không kiểm màu của tùy chọn enum

- **Vướng:** màu tùy chọn sai chỉ bị phát hiện lúc cài, sau vài phút chờ.
- **Cách tái hiện** (tái hiện được): trong `config/entities/*.json`, một tùy chọn `{ "value": "x", "label": "X", "color": "slate" }`; `pnpm build` xanh; `pnpm af deploy --sandbox`: `APP_STEP_FAILED on entity:order_task at VALIDATION_ERROR: unknown option color: slate` (và hàng chục dòng `APP_DEPENDS_ON_FAILED` che mất nguyên nhân thật).
- **Bằng chứng:** `entities.md` liệt kê màu enum hợp lệ (gray, sky, teal, amber, emerald, violet, indigo, rose, fuchsia, `#RRGGBB`); `slate` chỉ hợp lệ làm `accent` của entity. Kế hoạch 03.
- **Làm tạm:** `test/flow/entities.test.ts` kiểm mọi file entity.
- **Đề xuất:** builder kiểm màu theo danh sách đó; khi cài, in nguyên nhân gốc trước các dòng `APP_DEPENDS_ON_FAILED`.

## F-13 · `when` của luật giao việc là một toán tử json-logic

- **Vướng:** `work.assignable.rules[].when` viết theo hình dạng của `condition` ở rule (`{ join, leaves }`) bị từ chối lúc cài.
- **Cách tái hiện** (tái hiện được): `when: { "join": "and", "leaves": [{ "kind": "field", "rule": { "field": "role", "op": "eq", "value": "tm" } }] }`; `pnpm build` xanh; `deploy --sandbox`: `WORK_ASSIGNMENT_RULE_INVALID: routing rule 1: when is not a valid condition: a condition applies exactly one operator, but this one lists 2 (join, leaves)`.
- **Bằng chứng:** builder README chỉ nói `when` là "an object" (`dist/invariants.js` kiểm `isObject`). Viết như filter của trigger thì cài được: `{ "==": [{ "var": "role" }, "tm"] }`.
- **Làm tạm:** dạng json-logic một toán tử.
- **Đề xuất:** builder kiểm hình dạng `when`, và `work.md` có ví dụ.

## F-14 · Ghi lại đúng trạng thái đang có có thể bị từ chối

- **Vướng:** workflow cập nhật đơn với `status` bằng đúng giá trị hiện có thì hai lần bị từ chối: `STAGE_TRANSITION_NOT_ALLOWED on write_order`.
- **Cách tái hiện** (chưa chắc): sandbox 03/11/2026, hai đơn tạo bằng `POST /entities/{order}/records` với `form_payload` có khóa ngoài form (`approved: true`); workflow `init_order_tasks` ghi lại `status: "draft"` bằng bước Update thì hỏng; các đơn tạo bình thường thì không. Chưa xác định vì sao trạng thái lưu của hai đơn đó không phải điểm bắt đầu hợp lệ.
- **Bằng chứng:** `GET /instances/{id}`, `node_runs[].error_code`.
- **Làm tạm:** trạng thái được ghi riêng và chỉ khi nó đổi (`write_status` sau một bước rẽ nhánh).
- **Đề xuất:** coi việc ghi trạng thái không đổi là không phải chuyển trạng thái; thông báo lỗi nêu `from` và `to`.

## F-15 · Rule không chặn được xóa bản ghi

- **Vướng:** muốn "không xóa dòng hay giá của đơn đã gửi duyệt".
- **Cách tái hiện** (thiếu tính năng): các phép thử ghi của rule là `is_new`, `is_update`, `changed`, `changed_any`, `was`, `actor`: không có `is_delete`. Với một grant `delete` cho AM trên `order_line`, AM xóa được dòng của đơn đã gửi duyệt qua `DELETE /entities/{id}/records/{id}` dù đã có rule khóa sửa.
- **Bằng chứng:** builder README, mục Rules.
- **Làm tạm:** màn hình khóa nút xóa; grant `delete` vẫn còn.
- **Đề xuất:** thêm phép thử ghi `is_delete`, để rule áp dụng cho cả xóa.

## F-16 · Code step hỏng không để lại thông báo lỗi

- **Vướng:** một lượt `advance_order` hỏng `CODE_EXECUTION_FAILED` sau 3,4 giây (1 trong 66 lượt); không thấy được lỗi gì. Đơn đứng yên tới lần đổi task kế tiếp hoặc Admin bấm Thử lại.
- **Cách tái hiện** (chưa chắc, không tất định): chạy nhiều lượt `advance_order` (e2e `e2e/flow.sandbox.test.ts`); với lượt hỏng, `GET /instances/{id}` cho `error_code: CODE_EXECUTION_FAILED`, `error_message: null`, `node_runs[].error: null`, `invocations: []`, `input` rỗng. Chạy lại cùng bản ghi trong Node thì đúng.
- **Bằng chứng:** tài liệu `workflows.md` nói *"The author's own message and traceback are recorded on the step"*, nhưng không có.
- **Làm tạm:** ghi nhận là rủi ro đã biết; `reload` và các lần đổi task sau đó chạy lại.
- **Đề xuất:** ghi traceback hoặc stderr vào `node_runs[].error`, và `input` đã nhận của Code step để chạy lại cục bộ.

## F-17 · Tạo bản ghi qua API âm thầm bỏ trường không có trong form

- **Vướng:** dòng nhật ký "Bỏ qua cảnh báo" mất danh sách cảnh báo; một đơn tạo với `approved: true` được 201 mà `approved` không được lưu. Không có lỗi hay cảnh báo nào.
- **Cách tái hiện** (tái hiện được): entity có một trường danh sách `warnings` nhưng `create_form.schema.properties` không có nó; `POST /entities/{id}/records` với `form_payload: { …, warnings: [{ source: "system", level: "warning", text: "x" }] }` trả 201; đọc lại bản ghi: `warnings: []`. Thêm `"warnings": { "x-entityField": "warnings", "type": "array", "items": { "type": "object" } }` vào form thì lưu được.
- **Bằng chứng:** `records-api.md` ("only the keys the entity's create form binds are kept"); `e2e/module-flow.sandbox.test.ts`, test `module_logs_ignored_warnings_with_the_action` hỏng trước khi sửa; `entities.md` không nói danh sách có gắn được vào form không.
- **Làm tạm:** `test/flow/entities.test.ts` kiểm form có đủ mọi trường module ghi.
- **Đề xuất:** trả 422 (hoặc một danh sách `ignored_fields` trong phản hồi) cho khóa không có trong form; `entities.md` nói rõ trường danh sách gắn thế nào.

## F-18 · `host.navigate` không có chế độ thay thế

- **Vướng:** trang `/tasks/<id>` (đích của `module_page`) muốn chuyển tới đơn; vì chỉ có thể thêm mục vào lịch sử, nút Back quay về `/tasks/<id>` rồi chuyển tiếp lần nữa.
- **Cách tái hiện** (tái hiện được): một route gọi `host.navigate("/orders/o1")` trong effect khi vừa mở; mở route đó, rồi bấm Back: quay về route, effect chạy lại và chuyển tiếp lần nữa.
- **Bằng chứng:** `@reflexify/agentflow-sdk/dist/modules/contract.d.ts`: `navigate(path)` không có tham số thứ hai.
- **Làm tạm:** hiện đơn ngay tại `/tasks/<id>` thay vì chuyển hướng.
- **Đề xuất:** `navigate(path, { replace: true })`.

## F-19 · Định dạng thời gian của bản ghi

- **Vướng:** bản ghi trả thời gian dạng `2026-11-03T18:54:44.945958101+07:00` (9 chữ số thập phân, múi giờ +07:00). Chưa biết bộ chạy Code đọc nó bằng `Date.parse` có chắc chắn đúng không. Một lần, sau phê duyệt, bước "bỏ qua nếu đã tính" so `computed_at` với `approved_at` không bỏ qua mà tính lại.
- **Cách tái hiện** (chưa chắc): sandbox 03/11/2026: duyệt một đơn, đợi P&L chính thức, đặt lại `pl_requested_at` bằng tay: `computed_at` đổi. Chưa xác định nguyên nhân (có thể là hai lượt điều phối chạy chồng cùng xin tính P&L, có thể là cách đọc thời gian); dự án đọc thời gian bằng tay (`src/pl/time.ts`) cho chắc.
- **Bằng chứng:** giá trị `computed_at` nêu trên.
- **Làm tạm:** `parseTime` thay cho mọi `Date.parse` trong code chạy ở Code step.
- **Đề xuất:** tài liệu định dạng thời gian của `datetime` trong bản ghi và cách đọc trong Code step; ưu tiên UTC có độ chính xác mili giây.

## F-20 · Trigger có thể chưa chạy trong vài phút sau khi cài sandbox

- **Vướng:** lần chạy e2e đầu tiên ngay sau `deploy --sandbox` có lúc không có lượt workflow nào (không `init_order_tasks`, không `compute_pl`) dù đã in `armed 7 triggers`; chạy lại sau vài phút thì bình thường.
- **Cách tái hiện** (chưa chắc, không tất định): `pnpm af deploy --sandbox`, rồi ngay lập tức `pnpm test:sandbox`; một lần `GET /instances` chỉ có một lượt (`pl_selftest`) trong sandbox đã tồn tại hơn 10 phút.
- **Bằng chứng:** ngày 03/11/2026, lần chạy sau lần cài thứ năm.
- **Làm tạm:** chờ 4 phút sau khi cài rồi mới chạy test.
- **Đề xuất:** `deploy --sandbox` chỉ báo xong khi trigger đã sẵn sàng nhận sự kiện, hoặc có lệnh `sandbox status` cho biết.

## F-21 · Mỗi lượt chạy mất 7–18 giây, các lượt xếp hàng

- **Vướng:** một lượt `advance_order` (đọc 15 danh sách, một Code step, vài bước ghi) mất trung vị 7,3 giây, tối đa 18 giây; Code step một mình thường 3–4 giây. Chạy nhiều bộ test cùng lúc làm các lượt xếp hàng quá 150 giây.
- **Cách tái hiện** (tái hiện được): `GET /instances/{id}/trace` của một lượt `advance_order` rồi trừ `completed_at - started_at` của từng bước; chạy 5 bộ test sandbox song song thì quá thời gian chờ 150 giây.
- **Bằng chứng:** 66 lượt `advance_order` đo ngày 03/11/2026.
- **Làm tạm:** bộ test sandbox chạy từng tệp một; màn hình đợi tới 52 giây rồi báo "Chưa cập nhật".
- **Đề xuất:** tài liệu độ trễ và độ song song của bộ chạy; thời gian xếp hàng nằm trong `trace`.

## F-22 · `GET /app/objects` chỉ trả lời người gọi của chính ứng dụng

- **Vướng:** muốn chạy `OrdersApi` của module trên sandbox bằng từng người (`as('am')`); `getAppObjects` cần `GET /app/objects` mà người của sandbox gọi không được trả lời.
- **Cách tái hiện** (tái hiện được): `as('am').GET('/app/objects')` trong `e2e/`: không có danh sách đối tượng của ứng dụng; `createHttpOrdersApi({ api: as('am'), … })` ném `NOT_INSTALLED`.
- **Bằng chứng:** `e2e/module-flow.sandbox.test.ts`.
- **Làm tạm:** bọc client, trả danh sách đối tượng dựng từ `idsByKey()`.
- **Đề xuất:** để `@reflexify/agentflow-sdk/testing` có `hostFor(handle)` trả host đầy đủ, hoặc cho người của sandbox đọc `/app/objects`.

## F-23 · `expect` của bước Update với giá trị là template

- **Vướng:** `update(…, { expect: { fields: { stage: "{{ … }}", approved: "{{ … }}" } } })` (số và boolean) dường như không khớp: các lượt ghi đơn bị bỏ qua. Với chuỗi (`status`) thì chạy đúng.
- **Cách tái hiện** (chưa chắc): thêm `expect` trên `stage` và `approved` của bước ghi đơn trong `config/build/flow.mjs`; sau khi cài, một đơn bị trả lại không về nháp (bước ghi bị bỏ qua, không có lỗi); bỏ `expect` thì chạy lại. Chưa xác định là so chuỗi với số hay so khác.
- **Bằng chứng:** các lượt e2e ngày 03/11/2026 trước và sau khi bỏ `expect`.
- **Làm tạm:** `expect` chỉ dùng trên `status` (chuỗi) của task.
- **Đề xuất:** tài liệu cách so (chuỗi hay có kiểu), và `trace` ghi `skipped` kèm lý do (`changed`) ở từng bước.

## F-24 · Trả lời của `GET /work?view=mine|claimable` không được mô tả

- **Vướng:** module cần liệt kê việc của người dùng; tài liệu chỉ nhắc `GET /work?view=claimable` trong một dòng của bảng, không có hình dạng của trả lời.
- **Cách tái hiện** (thiếu tính năng): đọc `records-api.md`: không có mô tả phần tử. Dự án đoán `{ items: [{ entity_id, id | record_id }] }` và e2e xác nhận trên sandbox.
- **Bằng chứng:** `e2e/flow.sandbox.test.ts` (test `submit_walks_to_t23_and_locks_the_order`, phần đọc `/work`).
- **Làm tạm:** đọc chịu lỗi: nhận cả mảng lẫn `{ items }`, `record_id ?? id`.
- **Đề xuất:** mô tả trả lời trong `records-api.md` và có kiểu trong `operations.d.ts`.

## F-25 · Ứng dụng đã cài không tải file lên được

- **Vướng:** ở giai đoạn Hợp đồng (Đặc tả FR-7.1, FR-7.6), SA và Mua hàng tải file hợp đồng (PDF, Word, ảnh) ngay trên trang đơn của module; file nằm ở trường `file` của entity `contract`.
- **Cách tái hiện** (thiếu tính năng — theo tài liệu, chưa chạy qua module thật): `operations.upload_attachment` trong `@reflexify/agentflow-sdk/dist/generated/public.d.ts`: *"403: An installed app does not upload files (`APP_CEILING_DENIED`)"*. Cùng lời gọi bằng người của sandbox (`as('sa').POST('/attachments', multipart)`) trả `201`. `AppHost` (`dist/modules/contract.d.ts`) chỉ có `api`, `apiUrl` và `navigate` trong module: không mở được form tạo bản ghi hay trang bản ghi gốc của AgentFlow để người dùng tải file ở đó. Ứng dụng thì vẫn khởi chạy được workflow (`start_instance`).
- **Bằng chứng:** `e2e/contract-files.sandbox.test.ts` (03/11/2026): người dùng tải lên được, tạo `contract` với `file: [id]` được, AM tải về được qua `GET /attachments/{id}/download`; tài liệu nói ứng dụng tải về được file của bản ghi mà nó đọc được.
- **Làm tạm:** chờ quyết định của người dùng (lộ trình, mục "Kiểm trên sandbox: hợp đồng").
- **Đề xuất:** cho ứng dụng tải file khi ceiling có quyền tạo trên một entity có trường `file` (file chưa gắn chỉ gắn được vào entity đó); hoặc `host.uploadFile(file): Promise<AttachmentMetadata>` do host gọi bằng chính người dùng; hoặc `host.openRecordForm(entityKey, prefill)` mở form gốc của nền tảng.

## F-26 · Trường `file` chỉ trả mảng id

- **Vướng:** khung Hợp đồng (FR-7.9) hiện tên file, người tải, thời gian.
- **Cách tái hiện** (tái hiện được): đọc một bản ghi `contract` có file: `file` là `["43add103-…"]`, không có tên; tên chỉ có ở `GET /attachments/{id}` (`original_filename`).
- **Bằng chứng:** `e2e/contract-files.sandbox.test.ts`, test `sa_uploads_a_pdf_and_attaches_it_to_a_contract`.
- **Làm tạm:** đọc siêu dữ liệu từng file khi mở tab Hợp đồng.
- **Đề xuất:** bản ghi trả kèm `{ id, original_filename, content_type, byte_size }` cho trường `file`, hoặc một lần đọc nhiều id.

## F-27 · File do workflow sinh ra không tải về được qua ứng dụng

- **Vướng:** dự thảo hợp đồng dựng từ mẫu (Thiết kế 9, FR-7.2): một workflow do người dùng khởi chạy từ module render `document_template` ra .docx (bước `document`), gắn file vào bản ghi `contract`, rồi người dùng xem / tải từ tab Hợp đồng của module.
- **Cách tái hiện** (thiếu tính năng — theo tài liệu): `get_attachment` và `download_attachment` trong `@reflexify/agentflow-sdk/dist/generated/public.d.ts`: *"Through an installed app, a file is told of only when the app may read every owner it has and it has one. A file a run produced or holds, and a file nobody owns, answer `404`."*; chi tiết lượt chạy cũng ghi *"Files a run produced answer `404`"*. Ứng dụng khởi chạy được workflow (`start_instance`) nhưng không lấy được file nó sinh ra.
- **Bằng chứng:** tài liệu trên; cùng với F-25 (ứng dụng không tải file lên), module không có đường nào đưa một file vào hay ra ngoài cách người dùng tải lên trực tiếp.
- **Làm tạm:** kế hoạch 04 không dựng mẫu văn bản; để cho kế hoạch 05 (AI soạn dự thảo dùng cùng mẫu), khi nền tảng trả lời F-25 / F-27.
- **Đề xuất:** khi file do lượt chạy sinh ra được gắn vào trường `file` của một bản ghi, coi bản ghi đó là chủ của file (ứng dụng đọc được bản ghi thì tải được file); hoặc cho bước `document` ghi thẳng vào trường `file` với chủ là bản ghi.

## F-28 · `display_field` là trường `reference` qua được build, bị từ chối lúc cài

- **Vướng:** entity `tai_chinh_don` có `"display_field": "don_hang"` (một `reference` tới đơn).
- **Cách tái hiện** (tái hiện được): đặt `display_field` của một entity bằng khóa một trường `reference`, `pnpm build` (`wrote N package files`), `pnpm af sandbox check` (`sandbox.json is valid`), `pnpm af deploy --sandbox`: `APP_PLAN_CHANGED: … VALIDATION_ERROR: display field 'don_hang' must be a scalar field (a reference or file field cannot serve as the display label)`.
- **Bằng chứng:** lần deploy sandbox đầu của Phase 1 (04/11/2026), SDK `sdk-v0.9.0`; `reference/entities.md` ("The display field") không nói điều này ở chỗ khai báo trường.
- **Làm tạm:** dùng một trường vô hướng (`cpbh`) làm `display_field`.
- **Đề xuất:** `build` từ chối `display_field` trỏ tới trường `reference` / `file` và nêu khóa trường, như đã từ chối các lỗi khác trước lúc cài.

## F-29 · `changed_any` coi giá trị mặc định lúc tạo là thay đổi

- **Vướng:** rule "chỉ hệ thống ghi `trang_thai`, `giai_doan`…" (condition: `changed_any` các trường đó và người ghi không thuộc nhóm tự động) chặn luôn việc người dùng tạo đơn, vì `trang_thai` có giá trị mặc định `nhap`.
- **Cách tái hiện** (tái hiện được): entity có trường `status` mặc định `draft`, rule `{ changed_any: [status] }` + actor không thuộc nhóm tự động; người dùng tạo bản ghi không đặt `status`: `422 ENTITY_VALIDATION_RULE_FAILED: 1 record rule(s) refused the write`.
- **Bằng chứng:** `e2e/p01-lat-mong.sandbox.test.ts` lần chạy đầu (2 test hỏng ở bước tạo đơn); `reference/rules-and-stages.md` ghi "On a create it holds for every field the create sets" nhưng không nói giá trị mặc định cũng tính.
- **Làm tạm:** thêm leaf `is_update` vào các rule loại này.
- **Đề xuất:** ghi ví dụ này vào `rules-and-stages.md`; hoặc `changed` không tính giá trị mặc định mà người ghi không gửi.

## F-30 · Create form: `reference_list` tới Groups bị từ chối lúc cài; `null` bị từ chối ở mọi kiểu

- **Vướng:** (a) entity `tom_tat_don` có trường `nhom_xem` (`reference_list` tới Groups) và create form có thuộc tính cho nó; (b) module/workflow gửi `null` cho trường ngày, enum, người dùng còn trống khi tạo đơn.
- **Cách tái hiện** (tái hiện được): (a) `config/entities/x.json` có `create_form` bind một `reference_list` tới `ffffffff-0000-0000-0000-000000000002` kiểu `{ type: 'array', 'x-entityField': 'k' }`: `pnpm build` ổn, `deploy --sandbox` báo `APP_PLAN_CHANGED … form:x at VALIDATION_ERROR: reference binding 'k' must use the entity-reference format`. (b) `POST /entities/{id}/records` với `form_payload: { hieu_luc_den: null }` (trường `date`) trả `VALIDATION_ERROR … /hieu_luc_den: null is not of type "string"`; tương tự enum và người dùng (AGENTS.md mới ghi số).
- **Bằng chứng:** lần deploy sandbox đầu của Phase 2 (05/11/2026) và `e2e/p02-quyen.sandbox.test.ts` lần chạy đầu (10 lỗi trường).
- **Làm tạm:** bỏ thuộc tính khỏi create form (workflow ghi trực tiếp, không qua form); `forCreate()` trong `src/domain/records.ts` bỏ trường rỗng khi tạo (khi sửa vẫn gửi `null` để xóa).
- **Đề xuất:** `build` từ chối thuộc tính Groups sai dạng và nêu dạng đúng; tài liệu `entities.md` ("The create form") ghi rõ form tạo không nhận `null` cho kiểu nào, hoặc cho phép `null` như "không có giá trị".

## F-31 · Xóa bản ghi cha đòi quyền xóa trên mọi bản ghi con

- **Vướng:** Admin xóa một đơn (`don_hang`) có dòng hàng, giá bán, task, lịch sử… trỏ tới nó bằng `on_target_delete: cascade`.
- **Cách tái hiện** (tái hiện được): người có `delete` trên cha nhưng chỉ `read`/`list` trên entity con xóa cha: `ENTITY_RECORD_CASCADE_FORBIDDEN: deleting this record would change records you cannot edit`.
- **Bằng chứng:** `e2e/p02-quyen.sandbox.test.ts` ca "xóa đơn chỉ Admin" lần chạy đầu; `access.md` không nhắc.
- **Làm tạm:** cấp `delete` `organization` cho nhóm Admin trên các entity con (kể cả `lich_su`, nên Admin xóa được cả lịch sử).
- **Đề xuất:** ghi vào `access.md`; hoặc cho phép cascade qua quyền xóa của cha khi người xóa đã có `delete` trên cha.
