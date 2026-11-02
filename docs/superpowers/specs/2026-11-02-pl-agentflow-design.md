# Thiết kế: TeraBox · Hiệu quả đơn hàng (P&L) trên AgentFlow

Ngày: 02/11/2026 · Package: `inno/pl` · SDK: `sdk-v0.7.0`

Nguồn yêu cầu (theo thứ tự ưu tiên khi mâu thuẫn — xem mục 13 về các điểm còn chờ xác nhận):

1. Đặc tả chức năng "TeraBox – Hiệu quả đơn hàng (P&L)" (Claude Doc, rev 27, theo mockup v44) — gọi tắt **Đặc tả**. Bản chép: `docs/source/spec.md`.
2. Mockup tương tác (artifact HTML, ~440 KB) — tham chiếu bố cục màn hình. Bản lưu: `docs/source/mockup.html`.
3. File Excel P&L thật `TM.1040_TeraBox_Quotation_NAS_Trelleborg.xlsx` — tham chiếu công thức gốc và dữ liệu kiểm thử. Bản lưu: `docs/source/TM-1040.xlsx`.

Mã FR-x.y / BR-xx / NFR-xx trong tài liệu này là mã của Đặc tả.

## 1. Mục đích và lý do

TeraBox đang lập P&L từng đơn bằng file Excel, duyệt qua email, theo dõi tiến độ rời rạc giữa các phòng. Hệ thống mới đưa toàn bộ vòng đời đơn bán ra lên AgentFlow: lập đơn, tự tính P&L và kết luận Đạt / Không đạt ngưỡng, điều phối 15 task giữa 7 vai trò có SLA, nhúng AI vào từng task (tạo đơn từ báo giá, tra MST, soạn / kiểm tra / bóc tách hợp đồng), và tổng hợp KPI, dashboard cho lãnh đạo.

Song song, dự án ghi lại mọi chỗ SDK AgentFlow còn thiếu hoặc vướng vào `docs/sdk-feedback.md` để gửi đội phát triển AgentFlow.

## 2. Mục tiêu, không mục tiêu, phản mục tiêu

**Mục tiêu**
- Phủ đủ 10 module của Đặc tả trong một bản phát hành; chia thành các phần code tuần tự (mục 12), không phát hành dần từng phase.
- Một bộ công thức P&L duy nhất, dùng chung cho màn hình (tính tức thời khi sửa) và cho workflow (tính chính thức, chốt số liệu khi phê duyệt).
- Phân quyền kiểm tra ở máy chủ theo ma trận 2.5 (NFR-04), không chỉ ẩn trên giao diện.
- Mọi kết quả AI chỉ là gợi ý; người phụ trách xác nhận trước khi ghi vào đơn (NFR-06). Mọi cảnh báo bị bỏ qua được ghi lịch sử (BR-4C).

**Không mục tiêu (giai đoạn này)** — theo Đặc tả 1.2: kế toán tổng hợp, hóa đơn điện tử thật, kết nối ngân hàng, quản lý kho / serial, đồng bộ hai chiều CRM. Xuất Excel / PDF (NFR-14) để phần cuối, làm nếu còn thời gian.

**Phản mục tiêu** (chạy được nhưng vẫn là thất bại)
- P&L trên hệ thống lệch với cách tính đã thống nhất, dù chỉ một dòng.
- Kỹ thuật (TM) đọc được giá mua / P&L qua API dù màn hình có ẩn.
- AI tự ghi dữ liệu vào đơn mà người dùng chưa xác nhận.
- Người dùng phải quay lại Excel cho một bước nào đó trong luồng.

## 3. Ràng buộc

**Từ SDK `sdk-v0.7.0`** (đã kiểm chứng trong tài liệu SDK; mỗi mục cũng là một dòng trong `docs/sdk-feedback.md`):
- C1. Workflow trong package **không có fork/join** (builder từ chối bước có >1 cạnh ra) và **không có vòng lặp** (graph phải không chu trình). Nền tảng có fork/join nhưng package chưa mang được.
- C2. Grant của package **không có quyền theo trường**; package không được đánh dấu trường nhạy cảm (`sensitive` bị từ chối — việc bảo mật trường là quyết định của tổ chức). ⇒ dữ liệu cần ẩn với một vai trò phải nằm ở **entity riêng**.
- C3. Record scope chỉ theo trường người (Users/Units), cha, hoặc `work`. Không lọc theo nội dung bản ghi (ví dụ "đơn có dịch vụ").
- C4. Formula của entity chỉ đọc trường của chính bản ghi; rollup chỉ count/sum bản ghi con; formula không gọi `today()`. ⇒ P&L (cần tham số cấu hình, bậc tra cứu, nhiều bước) phải tính bằng code.
- C5. Đồng hồ SLA của `work.deadline` lấy mục tiêu từ một SLA policy của tổ chức theo **độ ưu tiên**, không theo từng bản ghi. Đặc tả cần SLA khác nhau cho từng task (1/2/3/7 ngày, Admin sửa được — FR-10.6).
- C6. Trigger luôn ship ở trạng thái tắt; Admin phải bật sau khi cài.
- C7. Bước `webhook` / `integration` / `extract_text` / `document` không có ví dụ trong SDK; builder không kiểm tham số. Phải lấy mẫu bằng cách dựng trong designer rồi Pack, hoặc hỏi đội AgentFlow.

**Từ nền tảng / môi trường**
- Agent cần nhà cung cấp AI trên deployment; Code step cần code runner JS; document / extract_text cần dịch vụ render / parse của deployment.
- Tra MST: người dùng có sẵn một service API riêng. Cần host, cách xác thực, định dạng request / response (mục 13).
- Tiền tệ VNĐ, P&L chưa VAT; giao diện tiếng Việt, sáng / tối, dùng được từ 360 px (NFR-10).

## 4. Các hướng đã cân nhắc

| Hướng | Mô tả | Đánh đổi |
|---|---|---|
| **A. UI module + workflow của AgentFlow** *(đã chọn)* | UI module dựng lại màn hình mockup; dữ liệu trong entity; mỗi task là bản ghi có `work`; workflow điều phối và chạy AI | Code giao diện nhiều nhất; là hướng duy nhất đáp ứng P&L tính tức thời, ẩn giá với Kỹ thuật, dashboard KPI như mockup |
| B. Màn hình mặc định của AgentFlow | Form / view / dashboard / Human step sẵn có, module tối thiểu | Nhanh hơn nhiều; P&L chỉ tính sau khi lưu, nhập dòng hàng kém, không có dashboard KPI theo giai đoạn deal |
| C. Site độc lập gọi API | Tự host, tự đăng nhập | Bị ceiling chặn form; không hơn A ở điểm nào |

Người dùng chọn **A** (02/11/2026). Trong A, cách điều phối 15 task:

| Cách | Đánh đổi |
|---|---|
| **Task là bản ghi + workflow điều phối** *(đã chọn, do C1)* | Song song và "Trả lại" làm được trong một lần chạy không vòng lặp; có "Việc của tôi", giao việc theo nhóm; SLA tự tính (C5) |
| Một workflow dài với Human step | Không làm được nhánh song song và quay lại GĐ1 với SDK hiện tại |
| Workflow designer rồi `init --from` | Bản chuyển đổi cũng phải qua `merge`, nên vẫn bị C1 |

## 5. Kiến trúc tổng thể

```
UI module (React, @reflexify/agentflow-elements/kit)
  ├─ Danh sách đơn · Trang đơn (KH, Phiếu khảo sát, Danh mục, NCC/Đơn mua, P&L, Quy trình, Hợp đồng, Lịch sử)
  ├─ Việc của tôi · KPI của tôi · Dashboard · Cấu hình (Admin)
  └─ src/pl/engine.ts  ← bộ tính P&L thuần (pure), dùng chung
        │ đọc/ghi bản ghi, upload file, khởi chạy workflow (host.api, quyền của người dùng)
        ▼
Entities (mục 6) ──trigger khi task đổi trạng thái──▶ Workflow `advance_order`
                                                       └─ Code step `advance.js` (DAG + điều kiện áp dụng + SLA)
Workflow AI (mục 9): tạo đơn từ file · tra MST · kiểm tra P&L · tóm tắt rủi ro · soạn / kiểm tra / rà soát / so khớp / bóc tách HĐ
Workflow `compute_pl` — Code step `compute_pl.js` (bundle từ engine.ts) — tính chính thức, chốt khi duyệt
Workflow theo lịch `sla_sweep` — cập nhật trạng thái hạn, nhắc quá hạn
```

Nguyên tắc:
- **engine.ts là nguồn sự thật của công thức.** Một script build bundle nó thành `config/code/compute_pl.js` (và phần DAG thành `config/code/advance.js`); file sinh ra được commit, test kiểm tra chúng không lệch với nguồn TS.
- Màn hình tính để hiển thị; **số được ghi chính thức** do workflow `compute_pl` ghi vào `order_pl` lúc gửi duyệt (t11) và lúc phê duyệt (t31, hoặc tự duyệt). Khi phê duyệt, bộ tham số đang dùng được chụp vào `order_pl.config_snapshot` (NFR-08, BR-51).
- Đơn chốt từ Excel (FR-5.7) có `order_pl.locked = true`; không tính lại.

## 6. Mô hình dữ liệu

Tên entity / trường dưới đây là đề xuất; người dựng được đổi tên trong quy ước khóa của SDK (chữ thường, `_`). "Người" = trường reference/reference_list tới Users.

### 6.1 Dữ liệu dùng chung
| Entity | Nội dung chính | Ghi chú |
|---|---|---|
| `customer` | mã KH (natural key), tên, MST (natural key), địa chỉ, hạng KH (VIP / Tiềm năng / Phổ thông), người đại diện, chức vụ, số TK, ngân hàng, `contacts` (list: tên, SĐT, email), thông tin giao nhận lần trước, kết quả tra cứu thuế gần nhất | Hồ sơ KH dùng lại (FR-1.6a–c). Mỗi đơn vẫn lưu bản sao thông tin KH tại thời điểm lập |
| `supplier` | tên, người liên hệ, SĐT, email, `payment_terms` (list: tên đợt, %, số ngày), công nợ | FR-4.1 |
| `staff` | người (Users), nhóm (Sales Team / SA Team / Technical Team / Procurement Team / Nguồn KH…), mã NV, đang làm | Danh sách AM/SA, người triển khai/tư vấn, nguồn KH (BR-52). "Team Marketing", "Other" là bản ghi nguồn KH không gắn người |

### 6.2 Đơn hàng
| Entity | Nội dung chính | Đọc được bởi |
|---|---|---|
| `order` | mã đơn (TM-/DV-, BR-53), trạng thái (Nháp / Đang xử lý / Hoàn tất / Close-lost), giai đoạn hiện tại (1–7, BR-4B), đã phê duyệt (bool), thông tin KH & giao nhận (bản sao, FR-1.6), phiếu khảo sát (FR-2.1–2.5: số HĐ nội bộ, số HĐ/PO KH, nội dung, ngày ký, đơn mới?, số liệu năm trước, nguồn KH, hạng KH, công nợ, CPBH, dự phòng, số lần thanh toán, KH tạm ứng trước?, nhân sự triển khai / tư vấn + Proposal / POC), loại HĐ áp dụng ngưỡng (FR-2.6), `deal_stages` (list 6 giai đoạn: hệ số %, người), cờ nội dung (có dịch vụ / có TB-LIC, do code đặt), người: `am`, `sa`, `inside_sales`, `pending_roles` (multi_select vai trò đang có task chờ — cho huy hiệu FR-1.4) | Mọi vai trò (theo scope 7.2). **Không chứa số tiền** |
| `order_line` | ref `order`, mã loại, CO/CQ, tên hàng, ĐVT, SL, thời hạn/bảo hành (tháng), SKU, thông số kỹ thuật, ngày bắt đầu/kết thúc, thời gian giao, End User | Mọi vai trò xem được đơn (TM cần thông số, FR-4.5). **Không chứa giá** |
| `order_line_price` | ref `order_line` (1–1) và `order`, đơn giá bán, chiết khấu %, VAT, đơn giá mua dự kiến (của Sale), ref `supplier` | AM, SA, SD, ACC, Admin |
| `purchase_proposal` | ref `order_line` (1–1, chỉ dòng TB/LIC/LIC-DK), giá mua đề xuất, NCC đề xuất, ghi chú | PROC, SD, ACC (FR-4.6) |
| `order_pl` | ref `order` (1–1), các tổng chính (doanh thu, giá vốn, LN gộp, CPBH, CPTC, chi phí khác, LN thuần, tỷ suất, ngưỡng, kết quả Đạt / Không đạt), `detail` (JSON: từng dòng P&L, phân tích theo loại, cơ cấu 1 lần / định kỳ), `kpi_split` (JSON: người → chỉ tiêu KD), `config_snapshot` (JSON), `computed_at`, `locked` | AM, SA, SD, ACC, Admin |

Các trường số trên `order_pl` là `number` thật (không chỉ JSON) để dashboard đếm/cộng được.

### 6.3 Quy trình
| Entity | Nội dung chính |
|---|---|
| `order_task` | ref `order`, mã task (t11 … t72), vai trò, trạng thái (`blocked` / `open` / `done` / `skipped` / `not_applicable` / `cancelled`), `opened_at`, `due_at`, `done_at`, `sla_days` (chụp lúc mở), tình trạng hạn (còn hạn / sắp đến hạn / quá hạn / đúng hạn / trễ N ngày), kết quả thao tác (gửi duyệt / duyệt / trả lại / đồng ý trình ký / yêu cầu sửa / hoàn thành / không áp dụng), lý do. Có `work` (lifecycle trên trạng thái, `assignable` giao cho nhóm của vai trò, `module_page` mở trang đơn) |
| `order_event` | ref `order`, ref task (nếu có), thời gian, người, vai trò, hành động, ghi chú, `warnings` (list: nguồn AI / Hệ thống, mức độ, nội dung), lý do. **Chỉ tạo, không sửa / xóa** (BR-4C, NFR-07) — mọi tự điền, bỏ qua gợi ý, bỏ qua cảnh báo, thay đổi số liệu P&L đều ghi ở đây |
| `contract` | ref `order`, bên (KH / NCC) + ref `supplier`, bước (dự thảo / chính thức), file, người upload, nguồn (AI soạn / upload), giá trị, `ai_check` (JSON: lỗi / lưu ý), `clause_review` (JSON: hạng mục → Khớp / Lưu ý / Rủi ro + kết luận), `extracted` (JSON), lý do bỏ qua, phiên bản |

Bảng 15 task (vai trò, tiền đề, điều kiện áp dụng, SLA mặc định, thao tác) lấy nguyên từ Đặc tả Module 6 / BR-40–BR-49.

### 6.4 Cấu hình (Admin sửa — Module 10)
| Entity | Nội dung |
|---|---|
| `contract_type_rate` | 5 bản ghi (TM 1 lần, TMDK, DV 1 lần, DV định kỳ, Fulfillment): ngưỡng, thưởng hỗ trợ KT, triển khai, tư vấn, kinh doanh, dự phòng (FR-10.1) |
| `fin_cost_tier` | bậc r theo hạng KH × mốc tỷ lệ (FR-10.4) |
| `vat_rate` | các mức VAT, mặc định (FR-10.2, BR-50) |
| `item_type` | mã loại, tên, nhóm, quy tắc (theo tháng?, có kỳ hạn?, nước ngoài?, miễn VAT bán / mua, cơ cấu 1 lần / định kỳ) (FR-10.9, BR-01–07) |
| `pl_setting` | 1 bản ghi: tỷ giá, lãi suất, hệ số NTNN, tỷ lệ hỗ trợ license / KT nội bộ / KT thuê ngoài, bảo hành TB, ngưỡng tự duyệt (300 tr), ngưỡng bắt buộc file HĐ (20 tr), hệ số giai đoạn deal mặc định, % cộng nguồn KH (FR-10.3) |
| `task_sla` | 15 bản ghi: mã task → số ngày làm việc (0 = không theo dõi) (FR-10.6) |
| `business_plan` | theo năm: doanh thu, LN thuần kế hoạch (FR-10.7) |
| `kpi_target` | theo năm × người: doanh thu, LN thuần, số đơn, chỉ tiêu KD được chia, new logo (FR-10.8) |

Giá trị mặc định nạp bằng `seed` theo Đặc tả 4.3 / sheet Define. "Khôi phục mặc định" (FR-10.10) là một workflow ghi lại các giá trị seed.

## 7. Phân quyền

### 7.1 Nhóm (tham số `group_ref` khi cài)
`am_group`, `sa_group`, `tm_group`, `sd_group`, `proc_group`, `acc_group`, `admin_group`, và `automation_group` (chứa service principal chạy các workflow trigger/lịch). Một người có thể ở nhiều nhóm (NFR-03).

### 7.2 Grant theo entity (rút gọn ma trận 2.5)
| Entity | AM | SA | TM | SD | PROC | ACC | Admin |
|---|---|---|---|---|---|---|---|
| `order`, `order_line` | đọc/sửa đơn có `am` = mình | đọc/sửa đơn có `sa` = mình | đọc toàn bộ ⚑ | đọc toàn bộ | đọc toàn bộ ⚑ | đọc toàn bộ | đọc, xóa |
| `order_line_price`, `order_pl` | như `order` | như `order` | — | đọc | — | đọc | đọc |
| `purchase_proposal` | — | — | — | đọc | đọc/sửa | đọc | — |
| `order_task` | đọc qua đơn + làm task của mình | như AM | đọc + làm task | như TM | như TM | như TM | đọc |
| `order_event` | tạo + đọc qua đơn | như AM | như AM | như AM | như AM | như AM | đọc |
| `contract` | đọc | đọc/tạo (KH) | — | đọc | đọc/tạo (NCC) | đọc | đọc |
| `customer`, `supplier` | đọc/sửa | đọc/sửa | đọc | đọc | đọc | đọc | đọc/sửa |
| Cấu hình (6.4) | đọc | đọc | đọc | đọc | đọc | đọc | sửa |

"Chỉ sửa ở GĐ1 hoặc khi bị trả lại" (2.5) và "khóa nguồn KH khi không phải đơn mới" (BR-23) viết bằng **rules** trên `order` / `order_line` / `order_line_price`: chặn update khi `order.stage > 1`, trừ automation group.

⚑ **Quyết định của người dựng (do C3):** TM và PROC đọc được phần không có tiền của mọi đơn, thay vì chỉ "đơn có dịch vụ" / "đơn có TB/LIC". Danh sách đơn trong module vẫn lọc theo cờ nội dung. Giá và P&L vẫn khóa ở máy chủ. Ghi vào sdk-feedback (record scope theo điều kiện trường).

Automation group: đọc/ghi mọi entity cần cho workflow.

## 8. Quy trình 15 task

1. **Tạo đơn** (module, AM/SA): tạo `order` + 15 `order_task` (t11 `open`, còn lại `blocked`) + `order_event`.
2. **Thao tác task** (module): người giữ task bấm nút. Module ghi `order_task.status`, kết quả, lý do, và `order_event` kèm các cảnh báo đang hiệu lực (FR-6.10). Chỉ vai trò phụ trách thấy nút (FR-6.2); máy chủ kiểm bằng `work` scope.
3. **Điều phối** — trigger khi `order_task` đổi trạng thái → workflow `advance_order` (chạy bằng service principal):
   - đọc đơn, cờ nội dung, mọi task, `task_sla`;
   - Code step `advance.js` tính: task nào bỏ qua (không áp dụng theo BR-40), task nào mở (mọi tiền đề xong / bỏ qua / không áp dụng — BR-41, BR-47), `due_at` theo ngày làm việc T2–T6 (BR-49), t31 tự duyệt hay không (BR-40), "Trả lại" ở t22/t31 (đặt lại t11 `open`, các task sau về `blocked`, đơn về GĐ1 — BR-43), "Yêu cầu sửa dự thảo" ở t42 (mở lại t40/t44), Close-lost (hủy task còn lại — BR-4A), giai đoạn hiện tại, `pending_roles`, trạng thái đơn;
   - For Each cập nhật task / đơn theo kết quả; gọi `compute_pl` khi cần (sau t11, khi t31 duyệt → chốt).
   - Mỗi lần chạy là một lượt không vòng lặp; "quay lại" là ghi dữ liệu, không phải cạnh graph.
   - Ghi `expect` trên trạng thái để hai lần chạy chồng nhau không ghi đè sai (người dựng thiết kế chống race).
4. **SLA** (do C5): `due_at` tự tính; workflow theo lịch `sla_sweep` (mỗi giờ, giờ làm việc) cập nhật tình trạng hạn và gửi nhắc. `work.deadline` của nền tảng **không dùng** cho mục tiêu theo task; ghi vào sdk-feedback.
5. **Thông báo** (NFR-12): giao task → thông báo `work_assigned` của nền tảng. Sắp/quá hạn, bị trả lại → thông báo trong ứng dụng qua `work`/escalation nếu dùng được, email qua Resend nếu tổ chức có kết nối (tham số `connection_ref` tùy chọn).

Kiểm tra trước khi cho phép thao tác (BR-42, BR-44, BR-45, 4.8) chạy ở module **và** lặp lại trong `advance_order` (task bị đặt lại nếu không đạt điều kiện), để API không vượt được.

## 9. AI

Mỗi tính năng là một workflow do module khởi chạy với đơn làm subject; kết quả ghi vào trường "đề xuất" (JSON) chứ không ghi thẳng vào dữ liệu đơn; module hiện bảng "Hiện tại / Đề xuất" để người dùng chọn, và ghi `order_event`.

| Tính năng | Task / FR | Cách làm |
|---|---|---|
| Tạo đơn từ file báo giá | FR-9.1–9.3 | `extract_text` trên các file upload → agent `quote_extractor` (schema KH + dòng hàng + mã loại theo `item_type`) → module xem trước → tạo đơn nháp |
| Tra MST | FR-1.6b | bước webhook gọi service tra cứu của TeraBox (host trong `egress`, khóa qua `secret_ref`) → agent so khớp tên, chuẩn hóa địa chỉ → đề xuất |
| Gợi ý mã KH mới | FR-1.6c | agent nhỏ hoặc quy tắc trong code (viết tắt, bỏ loại hình DN, kiểm trùng) |
| Kiểm tra P&L trước gửi | t11, FR-6.7 | quy tắc trong engine + agent `pl_reviewer` nhận xét bất thường |
| Tóm tắt & chấm rủi ro | t31 | agent `approval_advisor` → tóm tắt, điểm rủi ro, khuyến nghị Duyệt / Trả lại |
| Soạn dự thảo HĐ | t40 / t44, FR-7.2 | agent điền nội dung từ đơn + P&L + KH/NCC → bước `document` với `document_template` hợp đồng KH / NCC → .docx; chỗ thiếu đánh dấu |
| Kiểm tra dự thảo | FR-7.3 | `extract_text` + agent `contract_checker` (bên ký, MST, giá trị vs doanh thu / giá mua, hạng mục, thanh toán) |
| Rà soát điều khoản | FR-7.4 | agent `clause_reviewer` so với P&L đã duyệt → Khớp / Lưu ý / Rủi ro + kết luận; bắt buộc trước khi xong t40 |
| So khớp bản chính thức | FR-7.6 | agent so bản ký với dự thảo đã duyệt (giá trị, bên ký, thanh toán = lỗi chặn; khác nhỏ = lưu ý); chữ ký / con dấu |
| Bóc tách & tự điền | FR-7.7 | agent `contract_extractor` → đề xuất số HĐ/PO, ngày ký, công nợ, giao nhận… |

Mỗi agent có một skill (`config/skills/*.SKILL.md`) mô tả nghiệp vụ, và `read_limit` chỉ gồm entity nó cần (không cho agent đọc `purchase_proposal` trừ khi cần). Tham số model của agent do Admin chọn khi cài.

## 10. Giao diện (UI module)

Bám bố cục mockup; dùng kit `@reflexify/agentflow-elements`, theo `DESIGN.md` của kit.

- **Danh sách đơn** (FR-1.1–1.5): bộ lọc kỳ / AM / trạng thái / "Đơn của tôi"; cột số tiền chỉ hiện với vai trò được xem; TM/PROC thấy "Dòng thuộc bạn"; khối KPI của tôi; huy hiệu việc chờ.
- **Trang đơn**: khối KH & giao nhận thu gọn; thanh 7 giai đoạn; tab Phiếu khảo sát, Danh mục (bảng nhập nhanh, mở rộng dòng ▸, nhóm theo NCC), NCC / Đơn mua hàng (TB-LIC cho PROC, Dịch vụ cho TM), Kết quả P&L (thẻ tóm tắt, bảng P&L, "Xem công thức", phân tích theo loại, chia KPI, so năm trước), Quy trình (thẻ task, nút thao tác, khung cảnh báo), Hợp đồng, Lịch sử (lọc "chỉ cảnh báo bị bỏ qua").
- **Kiểm tra trường** theo 4.8: viền đỏ, hướng dẫn, tự chuẩn hóa, banner đếm trường thiếu.
- **Việc của tôi**: các task đang mở của vai trò, nhiều giai đoạn (FR-6.4). (Song song với My Work của nền tảng qua `module_page`.)
- **KPI & Dashboard** (Module 8): KPI của tôi, Tổng quan & KPI, Cơ cấu, Chi tiết; bộ lọc kỳ / phạm vi; drill-down ra danh sách đơn. Số liệu lấy bằng API đếm/cộng trên `order_pl` + `order`; phần chia KPI theo người đọc `order_pl.kpi_split`.
- **Cấu hình** (Admin): các bảng ở 6.4.
- Tiếng Việt; số tiền dấu chấm hàng nghìn; ngày dd/mm/yyyy; sáng / tối; ≥ 360 px; điều khiển bằng bàn phím; biểu đồ không dùng màu là tín hiệu duy nhất (NFR-10, NFR-11).

## 11. Kiểm thử

- **Engine P&L (Vitest)**: bộ ca kiểm thử theo từng bước công thức 4.2, từng loại HĐ, từng bậc r, đơn tái ký, nước ngoài, dịch vụ định kỳ. **Ca vàng:** đơn TM-1040 từ file Excel (mỗi con số trên sheet PL thành một assert), sau khi chốt các điểm lệch ở mục 13.
- **advance.js (Vitest)**: bảng tiền đề, điều kiện áp dụng, trả lại, yêu cầu sửa, close-lost, tự duyệt, ngày làm việc.
- **Kiểm định dạng 4.8 (Vitest)**: mỗi quy tắc, mỗi kiểu tự chuẩn hóa.
- **Module (Vitest + Testing Library)**: theo test sẵn có của starter (stylesheet, build).
- **Sandbox** (`deploy --sandbox`, `sandbox.json` có đủ 7 vai trò): một đơn TB+DV đi hết 15 task; trả lại ở t22 và t31; close-lost; kiểm quyền: TM gọi API đọc `order_pl` / `order_line_price` phải bị từ chối. AI chỉ kiểm cấu trúc kết quả, không kiểm câu chữ.

## 12. Thứ tự code (cùng một bản phát hành)

1. **Nền tảng**: dọn starter; manifest, tham số nhóm; entity cấu hình + seed; `customer`, `supplier`, `staff`; quyền; README / AGENTS.
2. **Engine P&L** + test ca vàng; script bundle sang Code step.
3. **Đơn hàng**: entity đơn / dòng / giá / đề xuất mua / P&L; màn hình danh sách và trang đơn (KH, phiếu khảo sát, danh mục, NCC, P&L); kiểm định dạng; workflow `compute_pl`.
4. **Quy trình**: `order_task`, `order_event`, `advance_order`, `sla_sweep`; tab Quy trình, Lịch sử, Việc của tôi; rules khóa sửa.
5. **Hợp đồng**: `contract`, upload, t40–t45, template văn bản.
6. **AI**: các agent / skill / workflow mục 9; khung cảnh báo bỏ qua.
7. **KPI & Dashboard**.
8. **Cấu hình (Admin)** màn hình, khôi phục mặc định; sandbox test đầy đủ; tài liệu cài đặt cho Admin.

Mỗi phần kết thúc bằng `pnpm build`, `pnpm test`, và (khi có deployment) `lint`. Mỗi vướng mắc SDK gặp được ghi ngay vào `docs/sdk-feedback.md`.

## 13. Điểm cần xác nhận trước khi code

*(được điền sau vòng review)*

## 14. Để lại cho người dựng

- Tên khóa entity / trường cụ thể, bố cục view của nền tảng.
- Cách sinh mã đơn TM-/DV- (auto_number hay code), miễn đúng BR-53 và không trùng.
- Chi tiết chống chạy chồng trong `advance_order`.
- Bố cục chi tiết màn hình trong phạm vi mockup.
