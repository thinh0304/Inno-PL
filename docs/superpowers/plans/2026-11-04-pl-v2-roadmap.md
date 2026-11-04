# Lộ trình xây P&L v2

> **Cho người thực hiện:** đây là lộ trình cấp phase, không phải kế hoạch cấp task. Mỗi phase có **một kế hoạch riêng**
> (`docs/superpowers/plans/YYYY-MM-DD-pNN-<tên>.md`) viết bằng superpowers:writing-plans khi bắt đầu phase đó, rồi thực hiện bằng
> superpowers:executing-plans (trong session, TDD, ghi sổ, một lượt review cuối bằng reviewer độc lập, rồi một lượt sửa).

**Spec:** `docs/superpowers/specs/2026-11-04-pl-v2-design.md` (đã duyệt 2026-11-04). Lộ trình trích dẫn spec theo số mục (§).

**Mục tiêu:** đưa app từ khung rỗng đến bản phát hành thay được file PL Excel và Power Automate + Planner, theo hướng A (§11): task là
bản ghi `work` + workflow điều phối, P&L do server chốt bằng cùng bộ công thức với module.

## Nguyên tắc chia phase

- **Phase 1 là lát mỏng xuyên suốt, chạy trên sandbox**: người dùng lập được một đơn thật, thấy P&L, gửi duyệt, task đến đúng người,
  SD duyệt, số được chốt. Mục đích là **phát hiện sai đặc tả sớm** ở chỗ quan trọng nhất: công thức P&L và cách task chạy.
- Mỗi phase sau **làm dày** một mảng của lát mỏng, và kết thúc bằng một thứ người dùng thử được trên sandbox.
- Thứ tự theo **rủi ro đặc tả và rủi ro nền tảng giảm dần**: P&L và điều phối task trước; dữ liệu và quyền; quy trình đủ 15 task; hợp đồng
  và file (phụ thuộc nền tảng 2026.11, F-27); AI; quỹ, KPI, thưởng; dashboard và xuất; phát hành.
- **Kiểm tra** theo `AGENTS.md`, mục "Testing": mỗi phase chỉ chạy test của phase (liệt kê trong kế hoạch phase), cộng `pnpm typecheck`,
  `pnpm build`, `pnpm check`; trên sandbox **deploy một lần mỗi phase** (`pnpm af deploy --sandbox`) và chỉ chạy file e2e của phase.
  `pnpm test` và toàn bộ `pnpm test:sandbox` chỉ chạy ở Phase 8. **Unit test mỗi phase chỉ gồm những test cần thiết** để chứng minh
  phần của phase; bộ unit test toàn diện viết ở Phase 8, khi đã xong mọi phase **[Quyết định 2026-11-04]**.
- Mỗi vướng mắc SDK mới: một mục F-xx trong `docs/sdk-feedback.md` (có "Cách tái hiện", "Đề xuất").
- Không push, không merge `main` khi người dùng chưa bảo. Không đọc `docs/archive/` (nội dung cần đã chép vào §12 của spec).

## Bố cục mã (chốt ở Phase 1, các phase sau theo)

| Thư mục | Nội dung |
|---|---|
| `src/domain/` | **Hàm thuần dùng chung** cho module và Code step: `pl.ts` (công thức §4), `lines.ts` (loại dòng, nhóm, VAT §4.1–4.2), `flow.ts` (bảng tiền đề, điều kiện bỏ qua, trạng thái GĐ §7), `validate.ts` (định dạng, trường bắt buộc §12.1–12.2), sau này `kpi.ts`, `fund.ts`, `bonus.ts` |
| `src/code/` | Điểm vào của Code step (bọc `src/domain/`), bundle qua `scripts/build-code.mjs` → `config/code/*.js` |
| `config/entities/`, `config/build/` | entity, quyền, rule, workflow |
| `src/module/` | màn hình |
| `test/domain/`, `test/module/` | test đơn vị |
| `e2e/pNN-*.sandbox.test.ts` | test sandbox của từng phase |

Các thư mục rỗng `test/contract`, `test/flow`, `test/order`, `test/pl` (thừa từ v1, không có trong git) được xóa ở Phase 1.

---

## Phase 1: Lát mỏng xuyên suốt

**Mục tiêu:** một đơn hỗn hợp (có dịch vụ + thiết bị) đi từ lập đơn đến "đã phê duyệt" trên sandbox, với P&L đúng công thức.

**Phạm vi:**
- Nâng SDK lên **`sdk-v0.9.0`** (`package.json` 3 package), `pnpm install`, sửa chỗ build đổi; giữ `minPlatformVersion` theo yêu cầu
  của tính năng dùng ở phase này. Xóa thư mục test rỗng thừa.
- **Bộ công thức P&L đầy đủ** `src/domain/pl.ts` (§4.1–4.5, §4.8; bước 13 "bù quỹ" nhận số từ ngoài, Phase 1 truyền 0), test bằng **ví
  dụ số** dựng từ đơn mẫu artifact (TM-1036, TM-1041, DV-0207, DV-0210) tính tay đối chiếu.
- **Cấu hình** (§8): một bản ghi cấu hình với giá trị mặc định; chưa có màn hình sửa.
- **Entity tối thiểu:** Đơn (KH, phiếu khảo sát cơ bản, AM, IS), Dòng hàng, **Giá bán dòng**, **Tài chính đơn** (số đang tính + số chốt +
  phiên bản cấu hình), **Task** (`work`). Tách số nhạy cảm **ngay từ đầu** (§11.4) để mô hình quyền được thử sớm.
- **Vai trò:** tham số nhóm chức danh TM, PROC, SD, ACC, Admin, Sales (§3); `sandbox.json` viết lại với người cho từng vai trò.
- **Điều phối:** workflow chạy khi Task/Đơn đổi trạng thái, Code step áp `src/domain/flow.ts` cho **t11 → t22 (có DV) ∥ t23 (có TB/LIC)
  → t31** (gồm **tự duyệt** §7.2) và **Trả lại** từ t22/t31 về t11 (§7.4). Chốt P&L ở t11 và t31. Hạn task = `add_business_days` theo
  cấu hình (§11.2).
- **Module:** danh sách đơn; tạo/sửa đơn (thông tin KH tối thiểu, phiếu khảo sát phần tiền, dòng hàng); màn P&L tính ngay khi gõ (thẻ tóm
  tắt + bảng); khung "Việc của bạn" với nút Gửi duyệt / Duyệt / Trả lại / Hoàn thành; thanh 7 giai đoạn.

**Kiểm chứng nền tảng sớm (ghi kết quả vào sổ, F-xx nếu vướng):** Task `work` giao theo trường người và theo nhóm hiện trong My Work;
trigger trên đổi trạng thái Task chạy điều phối (và không bắn khi tạo, §AGENTS); một nhóm trong trường người mở record scope `field`;
`add_business_days` trong template; quyền: TM/PROC **không** đọc được Tài chính đơn, Giá bán dòng.

**Người dùng thử trên sandbox:** AM lập đơn hỗn hợp, thấy P&L; gửi; TM và PROC thấy task của mình; PROC xong t23, TM duyệt t22; SD thấy
t31, duyệt; đơn "đã phê duyệt", số P&L chốt. Thử Trả lại. Thử đơn chỉ dịch vụ ≤ 300 triệu đạt ngưỡng: tự duyệt.

**Kiểm tra (định hướng, kế hoạch phase chốt tên):** `test/domain/pl.test.ts`, `test/domain/flow.test.ts`, `test/module/*` của các màn
mới, `e2e/p01-lat-mong.sandbox.test.ts`.

---

## Phase 2: Dữ liệu đơn đầy đủ và quyền

**Phạm vi:** §6, §12.1–12.3, §12.4, §12.7, §11.4, §5.1 (phần người được chia đọc đơn).
- Đủ trường đơn, KH, giao nhận, phiếu khảo sát (gồm 6 giai đoạn deal với 4 bộ hệ số, nguồn KH kể cả Team Marketing / Other, đơn tái ký
  và lấy số năm trước), dòng hàng (P/N, CO/CQ, ngày bắt đầu/kết thúc, VAT, tỷ giá và giá USD).
- `src/domain/validate.ts`: **quy tắc định dạng và trường bắt buộc** §12.1–12.2, dùng ở module và chặn ở Code step t11.
- **Danh bạ KH** (gợi ý, tự điền ô trống, bảng chọn khi khác, mã KH không trùng), **danh bạ NCC** (đợt thanh toán, công nợ); sao chép danh
  mục; điền nhanh giao nhận; mã đơn TM-/DV-; xóa đơn.
- **Quyền đầy đủ** §11.4: record scope AM, IS, `nguoi_duoc_chia`, `ky_thuat`/`mua_hang`;
  entity **Đề xuất mua hàng** (chỉ PROC, SD, ACC, Admin); **bản tóm tắt** cho TM và PROC.
- Entity **Lịch sử** (§12.7) ghi thao tác, tự điền, thay đổi số P&L.

**Người dùng thử:** lập đơn đầy đủ như thật; mỗi vai trò đăng nhập và chỉ thấy đúng đơn và đúng số của mình.

**Kiểm tra:** `test/domain/validate.test.ts`, test gợi ý KH, `e2e/p02-quyen.sandbox.test.ts` (đọc chéo giữa vai trò phải bị từ chối).

---

## Phase 3: Quy trình đủ 15 task

**Phạm vi:** §7 toàn bộ, §12.6, §12.8 (Đơn mua hàng).
- Bảng tiền đề đầy đủ t11–t72, điều kiện bỏ qua, cổng chỉ chờ nhánh đã bật, tiền đề có điều kiện t51 → t61/t62, "Không áp dụng"
  (t51, t53), **Close-lost** (IS, trước t41), **Yêu cầu sửa dự thảo** (t42), **Xin duyệt lại** (§12.6), hoàn tất ở t72.
- Tab **Đơn mua hàng** (t23: giá Mua hàng, NCC, lý do khi cao hơn giá Sale); t53 cảnh báo dòng tiền và tiền tạm ứng NCC theo giá Mua hàng.
- **Nhật ký cảnh báo** (§7.5, §12.7): khung cảnh báo trước nút, lý do bắt buộc với mức nghiêm trọng.
- **SLA và thông báo** (§7.6): hạn theo cấu hình, trạng thái Còn hạn / Sắp / Quá hạn; workflow **theo lịch** nhắc qua email (chỉ kiểm được
  trên AgentFlow thật, ghi rõ trong sổ); thông báo task mới, bị trả lại; huy hiệu số task.
- Trong phase này các task hợp đồng **chỉ có nút Hoàn thành** (chưa có file), để quy trình chạy hết được.

**Người dùng thử:** một đơn đi hết 7 giai đoạn đến Hoàn tất; thử Close-lost, Xin duyệt lại, KH tạm ứng trước = Có.

**Kiểm tra:** `test/domain/flow.test.ts` (mở rộng: mọi dạng đơn, đường găng), `e2e/p03-quy-trinh.sandbox.test.ts`.

---

## Phase 4: Hợp đồng và file

**Điều kiện vào phase:** AgentFlow `agentflow.innomation.vn` đã lên **2026.11** (upload từ module); có câu trả lời về **F-27** (§14).

**Phạm vi:** §12.5, §11.5, §7.2 (t40–t45).
- Entity **Hợp đồng** (HĐ KH + từng NCC, mỗi HĐ hai bản), upload file từ module, file > 20 triệu bắt buộc, giới hạn 25 MB và loại file.
- **Sinh dự thảo HĐ KH** từ mẫu gộp (`source/hd-mau-gop-thiet-bi-license-dich-vu.docx`) bằng bước Document; tải về. Nếu F-27 còn: dự phòng
  dựng .docx trong module (§11.5).
- t41: ghi trường bóc tách lên đơn (ngoại lệ khóa sửa) với bảng "Hiện tại / Từ hợp đồng"; "SD cho đặt hàng sớm".
- Phần bóc tách và kiểm tra ở phase này **nhập tay**; AI vào ở Phase 5.

**Người dùng thử:** soạn dự thảo HĐ KH từ đơn, tải về, upload bản ký; upload HĐ NCC.

**Kiểm tra:** test sinh dữ liệu điền mẫu HĐ (tiền bằng chữ, nhóm A/B/C), `e2e/p04-hop-dong.sandbox.test.ts`.

---

## Phase 5: AI

**Phạm vi:** §9, §12.10, §12.13.
- Bước **Agent** cho từng điểm chạm: tạo đơn từ nhiều file (xem trước, đánh dấu thiếu, hủy được); tự phân loại dòng; kiểm P&L trước gửi;
  tóm tắt và chấm rủi ro t31; man-day t22; gợi ý NCC t23; kiểm và rà soát dự thảo HĐ KH (kết luận 3 mức, bắt buộc trước t40), kiểm HĐ NCC;
  so khớp bản chính thức (lỗi chặn); bóc tách t41/t45; đọc biên bản t61/t62; đối soát t51/t53; dữ liệu hóa đơn t71; chi phí phát sinh t72.
- **Mọi kết quả AI phải được người xác nhận trước khi ghi**; "Bỏ qua gợi ý AI" vào nhật ký.

**Người dùng thử:** thả file báo giá thật để tạo đơn; xem khuyến nghị ở t31; rà soát một HĐ thật.

**Kiểm tra:** test hợp đồng dữ liệu vào/ra của từng Agent step (đầu ra được kiểm schema), `e2e/p05-ai.sandbox.test.ts` (một hai điểm
chạm tiêu biểu; AI chậm nên ít ca).

---

## Phase 6: Quỹ dự phòng, chia chỉ tiêu, KPI, thưởng quý

**Phạm vi:** §4.6, §5, §12.9 (KPI của tôi).
- Sổ quỹ (góp / giữ chỗ / hoàn / điều chỉnh), **bù ngưỡng vừa đủ** ở t11/t31 (kiểm số dư ở server), kết chuyển quý, về 0 đầu năm.
- Bản ghi **chia chỉ tiêu** chốt ở t72, kỳ theo **ngày xuất hóa đơn t71**; KPI giao theo năm; **KPI Mua hàng**.
- **Thưởng quý** (`src/domain/bonus.ts`): bậc lũy tiến, new logo, cộng dồn phần thiếu, +5% quý sau.
- Ai xem KPI (§5.2): AM/IS của mình, SD tất cả (SM tạm thời bỏ qua).

**Người dùng thử:** đơn không đạt dùng quỹ để đạt; AM xem KPI và thưởng quý của mình; SD xem tất cả.

**Kiểm tra:** `test/domain/fund.test.ts`, `kpi.test.ts`, `bonus.test.ts` (ví dụ số), `e2e/p06-kpi.sandbox.test.ts`.

---

## Phase 7: Dashboard, cấu hình, xuất, đơn lịch sử

**Phạm vi:** §12.9, §8, §12.11, §12.12, §10, §12.14 (hiệu năng).
- Dashboard ①②③, bộ lọc kỳ và phạm vi, bấm để xem đơn; `compute_tiles` hoặc Code step.
- **Màn Cấu hình** đầy đủ (phiên bản, khôi phục mặc định, bậc r, VAT, SLA từng task, KPI, kế hoạch, tỷ giá).
- **Xuất Excel/PDF** P&L đơn và báo cáo dashboard.
- **Đơn lịch sử:** tài liệu định dạng dữ liệu để người dùng đổ vào; cờ đơn lịch sử, P&L giữ số Excel; dùng cho tái ký và KPI.
- Đo hiệu năng với 5.000 đơn (§12.14).

**Người dùng thử:** xem dashboard với dữ liệu mẫu + đơn lịch sử; đổi cấu hình và thấy đơn chưa duyệt tính lại, đơn đã duyệt giữ số; xuất
Excel.

**Kiểm tra:** test tổng hợp số dashboard, test xuất file, `e2e/p07-dashboard.sandbox.test.ts`.

---

## Phase 8: Hoàn thiện và phát hành

- `pnpm test` đầy đủ và **toàn bộ** `pnpm test:sandbox`.
- README, AGENTS.md cập nhật theo app (đối tượng, tham số, trigger, ghi chú cài đặt).
- `pnpm lint` với AgentFlow thật; nâng `version`; `pnpm seal`; deploy khi người dùng bảo; admin bật trigger (kể cả trigger theo lịch) và
  kiểm nhắc SLA trên AgentFlow thật.
- Rà các mục còn mở §14 (MST, pháp chế mẫu HĐ).

---

## Phụ thuộc và rủi ro

| Rủi ro | Ảnh hưởng | Cách xử lý |
|---|---|---|
| Nền tảng chưa lên 2026.11 | Phase 4 không upload được | người dùng xác nhận với dev AgentFlow (nền tảng 2026.11 và F-27) **trước Phase 4**: ổn thì giữ thứ tự 4 → 5 → 6 → 7; chưa ổn thì làm 5 (phần không cần file), 6, 7 trước rồi mới 4 **[Quyết định 2026-11-04]** |
| F-27 còn | không tải được HĐ do workflow sinh | dựng .docx trong module (§11.5) |
| Điều phối task bị đua (hai thao tác cùng lúc) | task mở trùng / thiếu | Code step idempotent: luôn tính lại toàn bộ trạng thái từ dữ liệu, không dựa vào sự kiện; test ở Phase 1 và 3 |
| Workflow sandbox chậm (7 s – 2 phút / lượt) | e2e lâu | e2e chờ theo điều kiện, mỗi phase ít ca, chạy từng file |
| Trigger theo lịch không chạy trên sandbox | không e2e được nhắc SLA | test đơn vị phần chọn task cần nhắc; kiểm thật ở Phase 8 |

## Sổ tiến độ

| Phase | Kế hoạch | Trạng thái | Ghi chú |
|---|---|---|---|
| 1 | `2026-11-04-p01-lat-mong.md` | xong (nhánh `p01-lat-mong`, chưa merge) | e2e 4/4 trên sandbox; nền tảng sandbox đã nhận `minPlatformVersion` 2026.11; F-28, F-29 |
| 2 | `2026-11-05-p02-du-lieu-quyen.md` | xong (nhánh `p02-du-lieu-quyen`, chưa merge) | e2e p02 4/4 và p01 4/4; F-30, F-31; bộ chọn người, số năm trước tự lấy, nút xóa của AM để sau |
| 3 | `2026-11-05-p03-quy-trinh.md` | đang làm (nhánh `p03`) | F-32: một workflow chỉ có một trigger, nên có `dieu_phoi_yeu_cau`; email nhắc hạn để sau (cần kết nối gửi thư) |
| 4 | — | chưa bắt đầu | chờ 2026.11, F-27 |
| 5 | — | chưa bắt đầu | |
| 6 | — | chưa bắt đầu | |
| 7 | — | chưa bắt đầu | |
| 8 | — | chưa bắt đầu | |
