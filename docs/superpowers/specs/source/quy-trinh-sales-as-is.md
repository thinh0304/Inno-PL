# Quy trình đơn hàng Sales — Đặc tả nghiệp vụ hiện trạng (as-is)

**Nguồn:** solution Power Automate `SalesWorkflowUpdateNextBucketwhenBucketisCompleted_1_0_0_2`. Đặc tả được rút từ 4 flow:

- `[Sales] New Sales Process`: tạo plan, bucket và task.
- `[Sales-Update-Task-Parent] Check Every Plans for Completed Tasks v2`: quét plan định kỳ.
- `[Sales-Update-Task-Child] Update Next Bucket`: chuyển stage.
- `[PL] Move file PL`: chuyển file sang thư mục "Đã duyệt".

**Mục đích:** làm đầu vào để phát triển phần **Quy trình đơn hàng** (`FLOW` / `TASKS` / `TASK_REQ`) trong mockup *TeraBox · Hiệu quả đơn hàng (P&L)*.

**Phạm vi:** chỉ nghiệp vụ Sales. Bỏ qua adaptive card Teams, token và các thao tác HTTP.

---

## 0. Quy ước

### 0.1 Mã vai trò

Mã vai trò dùng thống nhất với `RL` trong file HTML. Riêng **SM** chưa có trong `RL`.

| Mã | Vai trò | Người phụ trách hiện tại (hardcode trong flow) |
|---|---|---|
| AM | Account Manager / Deal Owner | Lấy theo Owner của deal trên HubSpot (xem 1.1) |
| SA | Sales Admin | nhily, thudth |
| SM | Sales Manager | chiendn, thuanng |
| SD | Sales Director | chiendn |
| DIR | Director | chiendn. Có nhãn trên Planner nhưng không gán task nào |
| FIN | Finance | chiendn |
| TM | Technical Manager | nhadt, hoangdt |
| PROC | Procurement | thanhnt |
| ACC | Sales Accountant | tannp, thaoptp |

### 0.2 Thuật ngữ

- **Stage (giai đoạn)**: tương ứng 1 Bucket trên Planner.
- Một stage được coi là **hoàn thành** khi **mọi task** trong bucket đạt 100%.
- Khi stage hoàn thành, hệ thống gắn nhãn `STAGE DONE` cho các task của stage đó.
- **Kích hoạt task** gồm các thao tác sau:
  - đặt `Start = hôm nay`;
  - chuyển trạng thái sang *In progress*;
  - gán người theo vai trò;
  - đặt hạn chót theo SLA.
- **SLA**: tính theo **ngày làm việc từ thời điểm kích hoạt**, chỉ trừ Thứ 7 và Chủ nhật (không trừ ngày lễ). Ví dụ: `+1` = ngày làm việc kế tiếp, `+3` = ngày làm việc thứ 3 kể từ hôm nay.
- **Task tồn tại có điều kiện**: một số task chỉ được tạo khi thỏa điều kiện về loại deal hoặc giá trị deal. Nếu task không được tạo thì mọi bước xử lý liên quan tới nó được bỏ qua.

### 0.3 Cơ chế chạy chung

1. **Khởi tạo**: HubSpot post một message vào kênh Teams, có dạng `DealId: …; DealName: …; Amount: …; OwnerId: …; …; DealType: …`. Hệ thống đọc message này rồi:
   - tạo Plan có tên trùng `DealName`;
   - tạo toàn bộ bucket và task một lần ngay từ đầu;
   - chỉ kích hoạt task của stage 1. Các task còn lại để trống người phụ trách và hạn chót.
2. **Theo dõi**: cứ 30 phút, hệ thống quét các plan chưa có tiền tố `[Completed]`. Một bucket được chuyển sang xử lý stage khi thỏa cả hai điều kiện:
   - có task hoàn thành **trong ngày hiện tại (UTC)** mà chưa có nhãn `STAGE DONE`;
   - **toàn bộ** task trong bucket đó đã hoàn thành.
3. **Chuyển stage** (theo tên bucket vừa xong): gắn `STAGE DONE` cho task stage cũ, kích hoạt task stage mới và thực hiện các thao tác hệ thống đi kèm (chuyển file, cập nhật CRM).
4. **Phân nhánh**: flow chuyển stage không đọc lại loại deal. Nó đếm số bucket của plan:
   - **> 6 bucket** → nhánh **Thương mại** (7 stage);
   - **≤ 6 bucket** → nhánh **Dịch vụ** (6 stage).

---

## 1. Phân loại deal

### 1.1 Dữ liệu đầu vào từ HubSpot

| Trường | Vị trí trong message | Dùng để |
|---|---|---|
| DealId | phần tử 0 | Tạo link HubSpot và cập nhật deal stage khi đóng deal |
| DealName | phần tử 1 | Đặt tên Plan. Plan được tìm lại theo tên này |
| Amount (VND) | phần tử 2 | Phân cấp duyệt (mục 4) và quyết định task Duyệt tài chính |
| OwnerId | phần tử 3 | Map sang email AM |
| DealType | phần tử 5 | Chọn nhánh quy trình |

Bảng map OwnerId → AM đang được hardcode cho 7 người: thuanng, chiendn, thanhnt, huyng, hung.nguyen, nhily, thudth. OwnerId nằm ngoài danh sách này thì task stage 1 sẽ không được gán AM.

### 1.2 Loại deal và nhánh quy trình

| DealType | Tên hiển thị | Nhánh | Đặc điểm |
|---|---|---|---|
| `one-trading` | One-off Trading | Thương mại | Mua bán thiết bị / license một lần |
| `rec-trading` | Recurring Trading | Thương mại | Mua bán định kỳ |
| `trading-service` | Trading Service | Thương mại | Có cả hàng hóa và dịch vụ, nên thêm task **Duyệt kỹ thuật** và **Triển khai kỹ thuật** |
| `one-service` | One-off Service | Dịch vụ | Dịch vụ một lần |
| `rec-service` | Recurring Service | Dịch vụ | Dịch vụ định kỳ |

Recurring (`rec-*`) và One-off (`one-*`, `trading-service`) chỉ khác nhau ở **checklist đóng deal** (xem mục 5).

### 1.3 Nhãn tự động gắn khi tạo đơn

| Nhãn | Điều kiện | Gắn vào task |
|---|---|---|
| `Dưới 100tr` | Amount < 100.000.000 | Tạo & kiểm tra PL-CRM, Duyệt chi phí |
| `100-300tr` | 100.000.000 ≤ Amount ≤ 300.000.000 | như trên |
| `Trên 300tr` | Amount > 300.000.000 | như trên |
| `NoTechFinReq` | DealType ∈ {`one-trading`, `rec-trading`} **và** Amount < 500.000.000 | Tạo & kiểm tra PL-CRM |

Các nhãn này được lưu trên task stage 1. Flow chuyển stage đọc lại chúng để quyết định có bỏ qua stage 2 hay không và chọn ai duyệt chi phí.

---

## 2. Quy trình Thương mại (7 stage)

Áp dụng cho `one-trading`, `rec-trading`, `trading-service`.

### Tổng quan

| # | Stage (tên Bucket) | Task | Vai trò chính |
|---|---|---|---|
| 1 | Khởi tạo Đơn hàng | Tạo và Kiểm tra thông tin PL - CRM | SA, AM |
| 2 | Duyệt Tài chính - Kỹ thuật | Duyệt kỹ thuật *(có điều kiện)*, Duyệt tài chính *(có điều kiện)* | TM, FIN |
| 3 | Duyệt Đơn hàng - Đề xuất Mua hàng | Duyệt chi phí, Đề xuất mua hàng | SM/SD, PROC |
| 4 | Hợp đồng KH - Duyệt mua hàng | Hợp đồng Khách hàng, Duyệt Mua hàng | SA, SD, ACC |
| 5 | Hợp đồng NCC - Tạm ứng | Khách hàng tạm ứng, Ký hợp đồng - Tạm ứng NCC | ACC, PROC, SD |
| 6 | Hàng hóa và Triển khai | Nhận hàng - Giao hàng, Triển khai Kỹ thuật *(có điều kiện)* | PROC, TM |
| 7 | Hoàn thiện hồ sơ - thông tin | Xuất hóa đơn - Lưu trữ hồ sơ, Cập nhật thông tin CRM | ACC, SA |

**Điều kiện tồn tại task trong stage 2:**

| DealType | Duyệt kỹ thuật | Duyệt tài chính | Stage 2 |
|---|---|---|---|
| `one-trading`, `rec-trading`, Amount < 500tr | — | — | Rỗng, có nhãn `NoTechFinReq` → **bỏ qua** |
| `one-trading`, `rec-trading`, Amount > 500tr | — | ✓ | Duyệt tài chính |
| `trading-service`, Amount ≤ 500tr | ✓ | — | Duyệt kỹ thuật |
| `trading-service`, Amount > 500tr | ✓ | ✓ | Cả hai, chạy song song |
| `one-trading`, `rec-trading`, Amount **= 500tr** | — | — | ⚠ Rỗng nhưng **không** có `NoTechFinReq` → quy trình bị kẹt |

### Stage 1 — Khởi tạo Đơn hàng

**Task 1.1 · Tạo và Kiểm tra thông tin PL - CRM**

- **Kích hoạt:** ngay khi tạo plan.
- **Người phụ trách:** SA + AM. **Hạn:** +1.
- **Nhãn:** Sales Admin, nhãn theo giá trị deal, `NoTechFinReq` (nếu thỏa).
- **Mô tả:** link deal HubSpot và tên Owner.
- **Checklist:**
  1. [AM] Upload link file PL
  2. [SA] Kiểm tra thông tin CRM và file PL
  3. [SA] Copy file PL vào PL Online

**Khi Stage 1 hoàn thành:**

- Gắn `STAGE DONE` cho task 1.1.
- Kích hoạt ngay **3.2 Đề xuất mua hàng** (PROC, *In progress*, chưa có hạn). Procurement bắt đầu tìm NCC song song với stage 2.
- Kích hoạt 2.1 Duyệt kỹ thuật nếu task tồn tại (TM, +1).
- Kích hoạt 2.2 Duyệt tài chính nếu task tồn tại (FIN, +1).
- Nếu deal có `NoTechFinReq`, bỏ qua stage 2:
  - kích hoạt **3.1 Duyệt chi phí** theo ma trận ở mục 4 (+1);
  - đặt hạn **3.2 Đề xuất mua hàng** = +3.

### Stage 2 — Duyệt Tài chính - Kỹ thuật

**Task 2.1 · Duyệt kỹ thuật** (chỉ có ở `trading-service`)

- **Người phụ trách:** TM. **Hạn:** +1. **Tài liệu:** `[PL - MH&DV]`.
- **Mô tả:**
  - Người quản lý công việc gán người đang tư vấn cho đơn hàng.
  - Người thực hiện kiểm tra giải pháp kỹ thuật (nếu có) và danh sách dịch vụ nội bộ cung cấp.
- **Checklist:**
  1. Duyệt kỹ thuật
  2. Duyệt chi phí kỹ thuật

**Task 2.2 · Duyệt tài chính** (chỉ khi Amount > 500tr)

- **Người phụ trách:** FIN. **Hạn:** +1. **Tài liệu:** `[PL - PL]`, `[PL - ThanhToan]`.
- **Nội dung Finance duyệt:**
  - Tỷ lệ thanh toán và thời điểm thanh toán.
  - Chi phí bán hàng.
- **Yêu cầu:**
  - Các thông tin phải đúng Quy định công nợ của từng khách hàng. Nếu thay đổi thì cần BoD duyệt.
  - Đảm bảo dòng tiền vào và ra.

**Khi Stage 2 hoàn thành:**

- Gắn `STAGE DONE` cho 2.1 và 2.2 (task nào tồn tại).
- Đặt hạn **3.2 Đề xuất mua hàng** = +3 (PROC).
- Kích hoạt **3.1 Duyệt chi phí** theo ma trận ở mục 4 (+1).

### Stage 3 — Duyệt Đơn hàng - Đề xuất Mua hàng

**Task 3.1 · Duyệt chi phí**

- **Người phụ trách:** theo ma trận ở mục 4. **Hạn:** +1. **Tài liệu:** `[PL - PL]`.
- **Nội dung duyệt:**
  - Chi phí đầu vào hợp lý.
  - Các chi phí kinh doanh đúng quy định: chi phí đầu vào, discount, commission, chi phí dự phòng, lợi nhuận thuần (P3).
- **Dữ liệu ngầm:** phần sau `###` trong mô tả task phải chứa **tên file PL**. Hệ thống dùng tên này để chuyển file khi stage hoàn thành. Lúc tạo task phần này để trống, nên phải có người điền tay.

**Task 3.2 · Đề xuất mua hàng**

- **Người phụ trách:** PROC. **Hạn:** +3. **Tài liệu:** `[PL - MuaHang]`.
- **Mô tả:** tìm NCC theo danh sách thiết bị trong file `[PL - MuaHang]`. Tiêu chí ưu tiên theo thứ tự:
  1. chất lượng hàng hóa / chứng nhận được yêu cầu;
  2. giá;
  3. công nợ.

**Khi Stage 3 hoàn thành:**

- Gắn `STAGE DONE` cho 3.1 và 3.2.
- Chuyển file PL trên SharePoint từ `PL Online/2025/PL/Dự kiến` sang `PL Online/2025/PL/Đã duyệt`.
- Kích hoạt **4.2 Duyệt Mua hàng** (SD, +1).
- Kích hoạt **4.1 Hợp đồng Khách hàng** (SD + ACC + SA, +3).

### Stage 4 — Hợp đồng KH - Duyệt mua hàng

**Task 4.1 · Hợp đồng Khách hàng**

- **Người phụ trách:** SA, SD, ACC. **Hạn:** +3.
- **Mô tả:** chuẩn bị hợp đồng, thương thảo với KH, trình ký, gửi giấy tờ thủ tục tạm ứng (nếu có).
- **Checklist:**
  1. [SA] Lưu trữ file PL đã được duyệt
  2. [SA] Chuẩn bị hợp đồng với KH
  3. [ACC] Hồ sơ tạm ứng (nếu có)
  4. [SD] Ký hợp đồng với KH

**Task 4.2 · Duyệt Mua hàng**

- **Người phụ trách:** SD. **Hạn:** +1. **Tài liệu:** `[PL - MuaHang]`.
- **Mô tả:** Procurement đề xuất NCC bằng file `[PL - MuaHang]` để Director duyệt (cùng tiêu chí với task 3.2).
- **Dữ liệu ngầm:** phần sau `###` trong mô tả phải chứa **tên file đề xuất mua hàng**.

**Khi Stage 4 hoàn thành:**

- Gắn `STAGE DONE` cho 4.1 và 4.2.
- Chuyển file đề xuất từ `PL Online/2025/Purchase Request/Dự kiến` sang `…/Đã duyệt`, sau đó chạy Office Script trên file đã duyệt.
- Kích hoạt **5.1 Khách hàng tạm ứng** (SA + ACC, +3).
- Kích hoạt **5.2 Ký hợp đồng - Tạm ứng NCC** (PROC + SD + ACC, +3).

### Stage 5 — Hợp đồng NCC - Tạm ứng

**Task 5.1 · Khách hàng tạm ứng**

- **Người phụ trách:** SA, ACC. **Hạn:** +3.
- **Quy tắc:** nếu hợp đồng KH **không có điều khoản tạm ứng**, SA complete task ngay để không chặn các bộ phận khác.
- **Checklist:**
  1. [ACC] Xác nhận KH đã tạm ứng

**Task 5.2 · Ký hợp đồng - Tạm ứng NCC**

- **Người phụ trách:** PROC, SD, ACC. **Hạn:** +3.
- **Mô tả:** Procurement chuẩn bị hợp đồng NCC rồi gửi SD trình ký.
- **Quy tắc:** nếu hợp đồng NCC không có điều khoản tạm ứng, PROC complete các mục tạm ứng ngay.
- **Checklist:**
  1. [PROC] Chuẩn bị hợp đồng với NCC
  2. [SD] Ký hợp đồng với NCC
  3. [ACC] Thanh toán tạm ứng cho NCC (nếu có)
  4. [SD] Duyệt thanh toán tạm ứng cho NCC (nếu có)

**Khi Stage 5 hoàn thành:**

- Gắn `STAGE DONE` cho 5.1 và 5.2.
- Kích hoạt **6.1 Nhận hàng - Giao hàng** (PROC + ACC, +3).
- Kích hoạt **6.2 Triển khai Kỹ thuật** nếu task tồn tại (TM, +3).

### Stage 6 — Hàng hóa và Triển khai

**Task 6.1 · Nhận hàng - Giao hàng**

- **Người phụ trách:** PROC, ACC. **Hạn:** +3.
- **Điều kiện hoàn thành:** KH xác nhận bằng một trong các hình thức sau:
  - `[DVTK]` Biên bản nghiệm thu triển khai dịch vụ;
  - `[DVDK]` Biên bản bàn giao tài khoản;
  - email xác nhận của KH (áp dụng cho HĐ dưới 200tr).
- **Checklist:**
  1. Nhận hàng từ NCC
  2. Giao hàng cho KH
  3. Chuyển chứng từ cho Kế toán
  4. [ACC] Xác nhận nội dung hóa đơn

**Task 6.2 · Triển khai Kỹ thuật** (chỉ có ở `trading-service`)

- **Người phụ trách:** TM. **Hạn:** +3.
- **Yêu cầu:**
  - TM gán nhân sự triển khai và cập nhật lại hạn chót theo thực tế.
  - Điều kiện hoàn thành giống task 6.1.
  - Chuyển hồ sơ cho Kế toán sau khi triển khai xong.
- **Checklist:**
  1. Triển khai kỹ thuật
  2. Chuyển chứng từ cho kế toán

**Khi Stage 6 hoàn thành:**

- Gắn `STAGE DONE` cho 6.1 và 6.2.
- Kích hoạt **7.1 Xuất hóa đơn - Lưu trữ hồ sơ** (ACC, +1).
- Kích hoạt **7.2 Cập nhật thông tin CRM** (SA, +1).

### Stage 7 — Hoàn thiện hồ sơ - thông tin

**Task 7.1 · Xuất hóa đơn - Lưu trữ hồ sơ**

- **Người phụ trách:** ACC. **Hạn:** +1.
- **Hồ sơ cần lưu:**
  - PL, hợp đồng và hóa đơn đầu ra;
  - biên bản bàn giao và biên bản nghiệm thu;
  - hợp đồng và hóa đơn đầu vào;
  - tài liệu kỹ thuật, CO-CQ, e-license.
- **Checklist:**
  1. Xuất hóa đơn và hồ sơ thanh toán KH
  2. Kiểm tra và lưu trữ hồ sơ bản cứng
  3. Scan và lưu trữ bản mềm
  4. Cập nhật chi phí phát sinh trên PL (nếu có)

**Task 7.2 · Cập nhật thông tin CRM**

- **Người phụ trách:** SA. **Hạn:** +1.
- **Nội dung cập nhật:**
  - Deal Stage.
  - Expired date: với dịch vụ, tính đến ngày hết hợp đồng; với đơn có thiết bị, tính đến ngày hết hạn bảo hành dài nhất trong các thiết bị.
  - Next activity (với hợp đồng định kỳ).
- **Checklist:** dùng để đóng deal, xem mục 5.
- **Dữ liệu ngầm:** phần sau `###` trong mô tả lưu `DealId;DealName;Ngày tạo;DealType;Amount;Owner;PlanId;…`. Hệ thống đọc lại chuỗi này khi đóng deal.

**Khi Stage 7 hoàn thành:** đóng deal theo mục 5.

---

## 3. Quy trình Dịch vụ (6 stage)

Áp dụng cho `one-service`, `rec-service`. Nhánh này không có mua hàng, không có hợp đồng NCC và không có tạm ứng.

### Tổng quan

| # | Stage (tên Bucket) | Task | Vai trò chính |
|---|---|---|---|
| 1 | Khởi tạo Đơn hàng | Tạo và Kiểm tra thông tin PL - CRM | SA, AM |
| 2 | Duyệt Tài chính - Kỹ thuật | Duyệt kỹ thuật | TM |
| 3 | Duyệt Đơn hàng | Duyệt chi phí | SM/SD |
| 4 | Hợp đồng KH | Hợp đồng Khách hàng | SA, SD, ACC |
| 5 | Triển khai | Triển khai Kỹ thuật | TM |
| 6 | Hoàn thiện hồ sơ - thông tin | Xuất hóa đơn - Lưu trữ hồ sơ, Cập nhật thông tin CRM | ACC, SA |

Nội dung task (mô tả, checklist) giống bên Thương mại, trừ những điểm ghi riêng dưới đây.

### Stage 1 — Khởi tạo Đơn hàng

- **Task:** giống task 1.1 bên Thương mại.
- **Khi hoàn thành:** kích hoạt **2.1 Duyệt kỹ thuật** (TM, +1). Nhánh Dịch vụ không bao giờ có `NoTechFinReq`.

### Stage 2 — Duyệt Tài chính - Kỹ thuật

- **Task:** chỉ có **2.1 Duyệt kỹ thuật**. Nhánh Dịch vụ không có Duyệt tài chính.
- **Khi hoàn thành:** kích hoạt **3.1 Duyệt chi phí** theo ma trận ở mục 4 (+1).

### Stage 3 — Duyệt Đơn hàng

- **Task:** chỉ có **3.1 Duyệt chi phí**, nội dung giống bên Thương mại.
- **Khi hoàn thành:**
  - Chuyển file PL từ `Dự kiến` sang `Đã duyệt`.
  - Kích hoạt **4.1 Hợp đồng Khách hàng** (SD + ACC + SA, +3).

### Stage 4 — Hợp đồng KH

**Task 4.1 · Hợp đồng Khách hàng.** Checklist khác bên Thương mại:

1. [SA] Chuẩn bị hợp đồng với KH
2. [ACC] Hồ sơ tạm ứng (nếu có)
3. [SD] Ký hợp đồng với KH
4. [SA] Scan và lưu trữ hợp đồng

**Khi hoàn thành:** kích hoạt **5.1 Triển khai Kỹ thuật** (TM, +3).

### Stage 5 — Triển khai

- **Task:** **5.1 Triển khai Kỹ thuật**, giống task 6.2 bên Thương mại.
- **Khi hoàn thành:** kích hoạt **6.1 Xuất hóa đơn - Lưu trữ hồ sơ** (ACC, +1) và **6.2 Cập nhật thông tin CRM** (SA, +1).

### Stage 6 — Hoàn thiện hồ sơ - thông tin

- **Task:** giống stage 7 bên Thương mại.
- **Khi hoàn thành:** đóng deal theo mục 5. Nhánh Dịch vụ **chỉ xử lý Won**.

---

## 4. Ma trận phân cấp duyệt chi phí

Ma trận này áp dụng cho task **Duyệt chi phí** ở cả hai nhánh. Người duyệt được chọn theo nhãn giá trị gắn từ lúc tạo đơn.

| Giá trị deal | Nhãn | Người duyệt | Ghi chú |
|---|---|---|---|
| < 100.000.000 | `Dưới 100tr` | **SM + SA** | Task được gắn nhãn Sales Admin và Sales Manager |
| 100.000.000 – 300.000.000 | `100-300tr` | **SM** | Gắn nhãn Sales Manager |
| > 300.000.000 | `Trên 300tr` | **SD** | Gắn nhãn Sales Director |

**Các bước duyệt khác có điều kiện:**

| Bước duyệt | Điều kiện | Người duyệt |
|---|---|---|
| Duyệt tài chính (stage 2) | Nhánh Thương mại **và** Amount > 500.000.000 | FIN |
| Duyệt kỹ thuật (stage 2) | Nhánh Dịch vụ, hoặc `trading-service` | TM |
| Bỏ qua stage 2 | `one-trading` / `rec-trading` **và** Amount < 500.000.000 | — |
| Duyệt mua hàng (stage 4) | Mọi deal nhánh Thương mại | SD |
| Ký hợp đồng KH / NCC, duyệt tạm ứng NCC | Mọi deal (checklist) | SD |

**Ngưỡng nghiệp vụ khác (ghi trong mô tả task):**

- Được dùng **email xác nhận của KH** thay biên bản nghiệm thu / bàn giao khi HĐ dưới 200tr.
- Thay đổi điều khoản công nợ so với quy định của khách hàng cần **BoD** duyệt.

---

## 5. Đóng deal

Việc đóng deal diễn ra khi stage cuối (*Hoàn thiện hồ sơ - thông tin*) hoàn thành. Hệ thống đọc checklist của task **Cập nhật thông tin CRM**.

### 5.1 Checklist đóng deal theo loại

| DealType | Mục 1 (Won) | Mục 2 (Lost) |
|---|---|---|
| `rec-trading`, `rec-service` | `Close - won and follow` | Không được tạo sẵn, phải thêm tay |
| `one-trading`, `trading-service`, `one-service` | `Close - won` | Không được tạo sẵn, phải thêm tay |

### 5.2 Hành động hệ thống

| Kết quả | Điều kiện | Cập nhật HubSpot `dealstage` | Áp dụng nhánh |
|---|---|---|---|
| Won & follow | Mục 1 được tick, tiêu đề = `Close - won and follow` | `1648710` (stage theo dõi tái ký) | Thương mại, Dịch vụ |
| Won | Mục 1 được tick, tiêu đề = `Close - won` | `closedwon` | Thương mại, Dịch vụ |
| Lost | Mục 2 được tick | `closedlost` | **Chỉ Thương mại** |

Sau khi cập nhật HubSpot (cả Won lẫn Lost), hệ thống còn:

- đổi tên task thành `[Complete] Cập nhật thông tin CRM`;
- đổi tên plan thành `[Completed] <DealName>`, nhờ đó plan ra khỏi danh sách được quét định kỳ;
- cập nhật thẻ thông báo trên Teams.

### 5.3 Hạn chế hiện trạng

- **Chỉ có thể đóng Lost ở cuối quy trình.** Muốn đóng Lost, mọi task của 6–7 stage phải đã hoàn thành. Không có lối thoát khi deal thua giữa chừng.
- **Mục Lost không được tạo sẵn.** Flow đọc mục thứ 2 của checklist, nhưng checklist khi tạo chỉ có 1 mục, nên dễ phát sinh lỗi.
- **Không có cơ chế trả lại.** Người duyệt không thể trả đơn về cho AM. Họ chỉ có thể không complete task.

---

## 6. Ánh xạ sang `FLOW` trong file HTML

Bảng dưới đối chiếu task hiện trạng với task trong `FLOW` v2 của mockup, giúp xác định phần nào đã có và phần nào cần bổ sung.

| Task hiện trạng (Planner) | Task tương ứng trong HTML | Khác biệt cần quyết định |
|---|---|---|
| 1.1 Tạo và Kiểm tra PL - CRM (SA + AM) | `t11` Lập đơn hàng & gửi duyệt (AM, alt SA) | HTML gộp phần kiểm tra của SA vào `t11`. As-is có bước SA kiểm tra CRM và copy PL vào PL Online |
| 2.1 Duyệt kỹ thuật (TM) | `t22` (TM, `need:'svc'`) | Tương đương |
| 2.2 Duyệt tài chính (FIN, nhánh Thương mại > 500tr) | **Chưa có** | `RL.finance` đã có nhưng chưa có task. Cần thêm task `approve` cho FIN với điều kiện > 500tr và có hàng hóa |
| 3.2 Đề xuất mua hàng (PROC) | `t23` (PROC, `need:'goods'`) | As-is mở ngay sau stage 1, song song với duyệt; HTML cũng dùng `TASK_REQ t23:['t11']`, tức tương đương |
| 3.1 Duyệt chi phí (SM/SA/SD theo giá trị) | `t31` (SD, `need:'sdApprove'`) | HTML: SD duyệt khi > 300tr hoặc có mua hàng; còn lại tự duyệt nếu đạt ngưỡng LN. **As-is có cấp SM** (≤ 300tr) mà HTML chưa có vai trò SM |
| 4.2 Duyệt Mua hàng (SD) | Gộp vào `t31` | HTML gộp duyệt chi phí và duyệt phương án mua hàng thành 1 task |
| 4.1 Hợp đồng KH (SA, ACC, SD) | `t40` Dự thảo HĐ KH (SA) → `t42` SD duyệt dự thảo → `t41` Ký HĐ KH (SA) | HTML tách checklist thành các task riêng, mỗi task 1 vai trò |
| 5.2 Ký HĐ - Tạm ứng NCC (PROC, SD, ACC) | `t44` Dự thảo HĐ NCC → `t42` → `t45` Ký HĐ NCC → `t53` Thanh toán tạm ứng NCC | HTML coi việc SD ký HĐ NCC là duyệt tạm ứng; as-is có mục *[SD] Duyệt thanh toán tạm ứng* riêng |
| 5.1 Khách hàng tạm ứng (SA, ACC) | `t51` (ACC, `opt`) | Tương đương. As-is để SA complete khi không có tạm ứng; HTML dùng nút "Không áp dụng" |
| 6.1 Nhận hàng - Giao hàng (PROC, ACC) | `t61` (PROC, `need:'goods'`) | As-is có thêm mục *[ACC] Xác nhận nội dung hóa đơn* |
| 6.2 / DV 5.1 Triển khai Kỹ thuật (TM) | `t62` (TM, `need:'svc'`) | Tương đương. As-is: SLA +3, HTML: 7 ngày |
| 7.1 Xuất hóa đơn - Lưu trữ hồ sơ (ACC) | `t71` + `t72` (ACC) | HTML tách thành 2 task |
| 7.2 Cập nhật thông tin CRM (SA) + đóng Won/Lost | **Chưa có task**. Close-lost là nút của SA | Cần thêm task SA cập nhật CRM ở stage cuối, với kết quả Won / Won & follow (recurring) và các trường Expired date, Next activity |

### Các quy tắc as-is cần mang sang `FLOW`

1. **Phân nhánh theo loại deal.** As-is phân nhánh theo DealType, HTML phân nhánh theo dòng hàng (`hasGoods` / `hasSvc`). Cần chốt quy tắc tương đương cho:
   - `trading-service`: có cả hàng hóa lẫn dịch vụ;
   - nhánh Dịch vụ: không có hàng hóa.
2. **Ngưỡng 500tr cho Duyệt tài chính.** Nên dùng `≥ 500tr` để tránh lỗi kẹt đúng mốc 500tr của hiện trạng.
3. **Cấp duyệt SM.** Đề xuất thêm vai trò `SM` vào `RL`, rồi tách `t31` theo ma trận ở mục 4:
   - < 100tr: SM + SA;
   - 100–300tr: SM;
   - > 300tr: SD.
4. **Đề xuất mua hàng chạy song song với Thẩm định.** HTML đã đúng.
5. **Tạm ứng không áp dụng thì được bỏ qua ngay.** HTML đã đúng (`opt:true`).
6. **Recurring cần follow tái ký.** Thêm kết quả `Close - won and follow` cho deal định kỳ, kèm Expired date và Next activity.
7. **Ghi nhận phê duyệt bằng thao tác hệ thống.** As-is chuyển file PL / Purchase Request sang thư mục "Đã duyệt" khi duyệt xong. Trong HTML, có thể thay bằng trạng thái "Đã duyệt" trên đơn và log.
8. **SLA.** As-is chỉ đặt hạn chót (due date) trên Planner lúc kích hoạt task, tính theo ngày làm việc T2–T6. Không có nhắc việc, không có escalation và không có SLA cho cả stage. Bảng dưới đối chiếu với `days` trong HTML (Admin có thể ghi đè qua `CONFIG.sla`):

| Task as-is | SLA as-is | Task HTML | `days` HTML |
|---|---|---|---|
| Tạo và Kiểm tra PL - CRM | +1 (đặt ngay lúc tạo plan) | `t11` | 1 |
| Duyệt kỹ thuật | +1 | `t22` | 1 |
| Duyệt tài chính | +1 | *(chưa có)* | — |
| Đề xuất mua hàng | Mở ngay sau stage 1 nhưng **chưa có hạn**; +3 khi stage 2 xong (hoặc ngay nếu `NoTechFinReq`) | `t23` | 1 |
| Duyệt chi phí | +1 | `t31` | 1 |
| Duyệt Mua hàng | +1 | gộp vào `t31` | — |
| Hợp đồng Khách hàng | +3 | `t40` → `t42` → `t41` | 2 + 1 + 3 |
| Khách hàng tạm ứng | +3 | `t51` | 3 |
| Ký HĐ - Tạm ứng NCC | +3 | `t44` → `t45` → `t53` | 1 + 2 + 2 |
| Nhận hàng - Giao hàng | +3 | `t61` | 7 |
| Triển khai Kỹ thuật | +3 (TM tự cập nhật lại theo thực tế) | `t62` | 7 |
| Xuất hóa đơn - Lưu trữ hồ sơ | +1 | `t71` + `t72` | 2 + 1 |
| Cập nhật thông tin CRM | +1 | *(chưa có)* | — |
