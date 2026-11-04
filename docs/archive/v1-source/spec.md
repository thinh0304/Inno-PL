
# Đặc tả chức năng hệ thống – TeraBox Hiệu quả đơn hàng (P&L)
2026-10-31 · @Chien Dang
## PHẦN 1: GIỚI THIỆU CHUNG
### 1.1. Mục đích tài liệu (Document Purpose)
Tài liệu này đặc tả chức năng của phần mềm TeraBox – Hiệu quả đơn hàng (P&L) theo đúng bản mockup hiện tại (phiên bản 44, cập nhật 01/11/2026). Đây là căn cứ để đội phát triển xây dựng phần mềm thật, để kiểm thử viết kịch bản test và để các phòng ban nghiệp vụ xác nhận yêu cầu.
Đối tượng đọc:
Ban điều hành, Sales Director: xác nhận phạm vi và quy tắc nghiệp vụ.
Phòng Kinh doanh, Sales Admin, Kế toán, Mua hàng, Kỹ thuật: xác nhận quy trình và quyền thao tác của mình.
Đội phát triển và kiểm thử (BA, Dev, QC): làm căn cứ thiết kế, lập trình, kiểm thử.
### 1.2. Phạm vi hệ thống (System Scope)
Hệ thống quản lý vòng đời một đơn hàng bán ra, từ lúc lập đơn đến lúc đóng hồ sơ, và tính hiệu quả tài chính (P&L) của từng đơn.
Trong phạm vi:
Lập đơn hàng: thông tin khách hàng, phiếu khảo sát, danh mục hàng hóa / dịch vụ, nhà cung cấp. Có thể tạo đơn tự động từ file báo giá bằng AI.
Tự động tính P&L đơn hàng và so với ngưỡng lợi nhuận tối thiểu theo loại hợp đồng.
Quy trình xử lý 7 giai đoạn, 15 task; mỗi task mở ngay khi các task tiền đề xong nên nhiều bộ phận làm song song; có phân vai, duyệt / trả lại, thời hạn xử lý (SLA) và trợ lý AI ở từng task.
Hợp đồng 2 bước: dự thảo (AI soạn hoặc upload, AI kiểm tra và rà soát điều khoản, SD duyệt) rồi bản chính thức đã ký (AI so khớp với dự thảo, bóc tách và tự điền dữ liệu).
Chia chỉ tiêu kinh doanh (KPI) theo giai đoạn deal; theo dõi KPI cá nhân và KPI đội.
Dashboard kết quả kinh doanh: tổng quan, so với kế hoạch, cơ cấu doanh thu / chi phí, chi tiết.
Cấu hình hệ thống do Admin quản lý.
Ngoài phạm vi (giai đoạn này):
Kế toán tổng hợp, xuất hóa đơn điện tử thật, kết nối ngân hàng. Hệ thống chỉ ghi nhận trạng thái và chứng từ.
Quản lý kho, serial thiết bị chi tiết.
Đồng bộ hai chiều với CRM. Mockup chỉ mô tả việc Sales Admin cập nhật trạng thái Close won / lost.
### 1.3. Bảng thuật ngữ và chữ viết tắt (Glossary & Acronyms)
|
Thuật ngữ / Viết tắt |
Diễn giải |
|
AM |
Account Manager – nhân viên kinh doanh phụ trách khách hàng |
|
SA |
Sales Admin – hỗ trợ kinh doanh, soạn hợp đồng, lập đơn thay AM |
|
SD |
Sales Director – Giám đốc kinh doanh, người phê duyệt |
|
TM |
Technical Manager – quản lý kỹ thuật |
|
PROC |
Procurement – bộ phận Mua hàng |
|
ACC |
Sales Accountant – kế toán bán hàng |
|
P&L |
Bảng hiệu quả đơn hàng (doanh thu, giá vốn, chi phí, lợi nhuận) |
|
LN gộp |
Lợi nhuận gộp = Doanh thu − Giá vốn |
|
LN thuần |
Lợi nhuận thuần = LN gộp − toàn bộ chi phí của đơn |
|
CPBH |
Chi phí bán hàng |
|
CPTC |
Chi phí tài chính |
|
NCC |
Nhà cung cấp |
|
KH |
Khách hàng |
|
HĐ / PO |
Hợp đồng / Đơn đặt hàng (Purchase Order) |
|
TMDK |
Thương mại định kỳ – license thuê bao có kỳ hạn |
|
NTNN |
Nhà thầu nước ngoài – chịu thuế nhà thầu |
|
TB |
Thiết bị (hàng hóa phần cứng) |
|
LIC / LIC-DK / LIC-NTNN |
License 1 lần (vĩnh viễn) / License định kỳ / License mua từ nước ngoài |
|
DVTK-I / DVTK-O |
Dịch vụ triển khai nội bộ / thuê ngoài |
|
DVDK-I / DVDK-O / DVDK-NTNN |
Dịch vụ định kỳ nội bộ / thuê ngoài / nước ngoài |
|
KPI |
Chỉ tiêu kinh doanh được giao |
|
Chỉ tiêu KD được chia |
Phần LN thuần ghi nhận cho từng nhân sự theo giai đoạn deal |
|
SLA |
Thời hạn xử lý task, tính bằng ngày làm việc (T2–T6) |
|
GĐ |
Giai đoạn trong quy trình xử lý đơn |
|
Hoàn tất / Dự kiến |
Đơn đã đi hết quy trình / mọi đơn chưa hoàn tất (trừ Close-lost) |
|
KCT |
Không chịu thuế GTGT |
### 1.4. Tài liệu tham khảo (References)
|
Tài liệu |
Ghi chú |
|
Mockup TeraBox · Hiệu quả đơn hàng (P&L) |
Bản mockup tương tác, phiên bản 31 |
|
File Excel P&L gốc (sheet Define, sheet PL) |
Nguồn công thức và tham số; đơn mẫu TM-1036 dùng số liệu đã ký duyệt từ file này |
|
Các góp ý trên mockup (comment threads) |
Các thay đổi: KPI, Dự kiến / Hoàn tất, LIC-DK, logic đơn tái ký, nguồn khách hàng |
|
Sơ đồ quy trình đơn hàng có ghi thời hạn task |
Bản chú thích của anh Chiến, làm căn cứ SLA |
## PHẦN 2: TỔNG QUAN HỆ THỐNG
### 2.1. Bối cảnh và mục tiêu xây dựng hệ thống
Hiện nay P&L từng đơn hàng được lập bằng file Excel, chuyển qua email để duyệt, và tiến độ đơn được theo dõi rời rạc giữa các phòng ban. Cách làm này khó kiểm soát phiên bản, dễ sai công thức, không biết đơn đang kẹt ở đâu và không tổng hợp được KPI theo thời gian thực.
Mục tiêu:
Chuẩn hóa cách tính P&L: một bộ công thức, tham số do Admin cấu hình, tự đánh giá Đạt / Không đạt ngưỡng LN.
Số hóa quy trình 7 giai đoạn: mỗi task có một người chịu trách nhiệm, thời hạn xử lý và lịch sử thao tác.
Giảm thao tác tay bằng AI: tạo đơn từ file báo giá, bóc tách hợp đồng, rà soát điều khoản trước khi ký.
Minh bạch KPI: mỗi nhân viên thấy chỉ tiêu của mình; lãnh đạo thấy tổng quan, so với kế hoạch, cơ cấu doanh thu và chi phí.
### 2.2. Phạm vi triển khai hệ thống
Đơn vị áp dụng: TeraBox, các phòng Kinh doanh, Sales Admin, Kỹ thuật, Mua hàng, Kế toán bán hàng và Ban giám đốc kinh doanh.
Loại đơn hàng: mọi đơn bán ra gồm thiết bị, license, dịch vụ triển khai và dịch vụ định kỳ (Cloud, Colocation, Backup, Manage Service…), kể cả hàng mua từ nhà cung cấp nước ngoài.
Nền tảng: ứng dụng web, dùng trên máy tính và xem được trên điện thoại, giao diện sáng / tối.
Tiền tệ hạch toán: VNĐ, số liệu P&L chưa gồm VAT. Hàng nước ngoài quy đổi theo tỷ giá cơ sở.
Dữ liệu ban đầu: danh mục nhân sự, nhà cung cấp, loại hàng hóa / dịch vụ và tham số tài chính lấy từ sheet Define của file Excel hiện hành.
### 2.3. Các nhóm người dùng
|
Vai trò |
Mã |
Trách nhiệm chính |
Phạm vi đơn được xem |
|
AM · Nhân viên Sale |
AM |
Lập đơn, phiếu khảo sát, danh mục, giá bán / giá mua dự kiến; gửi duyệt; xem P&L |
Đơn do mình phụ trách |
|
Sales Admin |
SA |
Lập đơn thay AM, soạn và trình ký hợp đồng KH, cập nhật Số HĐ/PO và CRM |
Đơn được giao cho mình |
|
Technical Manager |
TM |
Duyệt giải pháp và chi phí kỹ thuật, triển khai và nghiệm thu |
Đơn có dịch vụ |
|
Sales Director |
SD |
Phê duyệt đơn, ký hợp đồng (ký HĐ NCC = duyệt tạm ứng NCC), theo dõi KPI đội |
Tất cả |
|
Procurement · Mua hàng |
PROC |
Đề xuất giá mua và NCC, ký HĐ NCC, nhận và giao hàng |
Đơn có thiết bị / license |
|
Sales Accountant · Kế toán |
ACC |
Xác nhận tạm ứng, thanh toán tạm ứng NCC, kiểm tra biên bản và xuất hóa đơn, lưu hồ sơ |
Tất cả |
|
Quản trị viên |
Admin |
Cấu hình ngưỡng, tỷ lệ, tham số tài chính, nhân sự, SLA, KPI, danh mục loại; xóa đơn |
Tất cả |
AI không phải một vai trò riêng. AI là trợ lý gắn vào từng task, chỉ gợi ý; người phụ trách task vẫn là người quyết định.
### 2.4. Sơ đồ phân rã chức năng (FDD)
Mỗi module ứng với một nhóm yêu cầu FR ở Phần 3 (Module 1 = FR-1.x, …, Module 10 = FR-10.x).
### 2.5. Ma trận phân quyền tổng thể
Ký hiệu: S = sửa / thực hiện, X = chỉ xem, D = duyệt / trả lại, — = không truy cập. Quyền sửa dữ liệu đơn chỉ mở ở GĐ1 hoặc khi đơn bị trả lại.
|
Chức năng |
AM |
SA |
TM |
SD |
PROC |
ACC |
Admin |
|
Danh sách đơn, KPI của tôi |
X (đơn của mình) |
X (đơn được giao) |
X (đơn DV) |
X |
X (đơn TB/LIC) |
X |
X |
|
Tạo đơn (tay / từ file AI) |
S |
S |
— |
— |
— |
— |
— |
|
Phiếu khảo sát |
S |
S |
— |
X |
— |
— |
X |
|
Danh mục Thiết bị / Dịch vụ |
S |
S |
— |
X |
— |
X |
X |
|
Nhà cung cấp |
S |
S |
— |
X |
— |
X |
X |
|
Đơn mua hàng (đề xuất giá mua, NCC) |
— |
— |
X (phần DV) |
X |
S (phần TB/LIC) |
X |
— |
|
Kết quả P&L |
X |
X |
— |
X |
— |
X |
X |
|
Bảng quy trình, lịch sử |
X + task của mình |
X + task của mình |
X + task của mình |
X + task của mình |
X + task của mình |
X + task của mình |
X |
|
Gửi duyệt đơn (t11) |
S |
S |
— |
— |
— |
— |
— |
|
Duyệt giải pháp kỹ thuật (t22) |
— |
— |
D |
— |
— |
— |
— |
|
Phê duyệt đơn (t31) |
— |
— |
— |
D |
— |
— |
— |
|
Upload / bóc tách HĐ khách hàng |
— |
S |
— |
X + xác nhận khuyến nghị AI |
— |
X |
— |
|
Upload / bóc tách HĐ nhà cung cấp |
— |
— |
— |
X |
S |
X |
— |
|
Dashboard: tổng quan, cơ cấu, chi tiết |
X (số liệu của mình) |
X (số liệu của mình) |
X |
X |
X |
X |
X |
|
Dashboard: KPI theo nhân viên |
— |
— |
— |
X |
— |
X |
X |
|
Cấu hình hệ thống |
— |
— |
— |
— |
— |
— |
S |
|
Xóa đơn |
— |
— |
— |
— |
— |
— |
S |
Phần đề xuất giá mua của Mua hàng chỉ Mua hàng, Sales Director và Kế toán xem được. Bộ phận Kỹ thuật xem thông số TB / LIC để đối chiếu nhưng không thấy giá.
## PHẦN 3: YÊU CẦU CHỨC NĂNG
Hệ thống gồm 10 module. Mỗi yêu cầu có mã FR-<module>.<số> để tham chiếu khi thiết kế và kiểm thử. Công thức và tham số chi tiết nằm ở Phần 4.
### Module 1: Danh sách đơn hàng & Thông tin đơn
Mục đích: điểm vào chính của mọi vai trò; liệt kê đơn theo quyền xem và quản lý thông tin khách hàng, giao nhận của từng đơn.
|
Mã |
Chức năng |
Mô tả |
Vai trò |
|
FR-1.1 |
Xem danh sách đơn |
Bảng: Mã đơn, Khách hàng, Phụ trách, Trạng thái, Doanh thu, Kết quả P&L. Mua hàng / Kỹ thuật thấy cột "Dòng thuộc bạn" thay cho số tiền. Bấm dòng để mở đơn |
Tất cả |
|
FR-1.2 |
Lọc danh sách |
Lọc theo kỳ (năm / quý / tháng / tuần / tất cả), AM, trạng thái (Nháp, Đang xử lý, Hoàn tất, Close-lost); công tắc "Đơn của tôi" |
Tất cả |
|
FR-1.3 |
Khối "KPI của tôi" |
Hiển thị trên đầu danh sách cho AM / SA (chi tiết ở Module 8) |
AM, SA |
|
FR-1.4 |
Cảnh báo việc cần làm |
Huy hiệu số trên menu = số đơn có task đang chờ vai trò hiện tại; cảnh báo task sắp / đã quá hạn |
Tất cả |
|
FR-1.5 |
Tạo đơn mới |
Tạo đơn trống, mã tự sinh (TM- cho đơn có thiết bị, DV- cho đơn dịch vụ), mở Phiếu khảo sát; hoặc tạo từ file (Module 9) |
AM, SA |
|
FR-1.6 |
Thông tin KH & giao nhận |
Khối thu gọn trên mọi tab: tên KH, mã KH, MST, địa chỉ, người liên hệ, email, điện thoại, người đại diện, chức vụ, số TK, ngân hàng, người nhận, SĐT nhận, địa chỉ nhận, ghi chú giao hàng, ngày báo giá, hiệu lực đến, tỷ giá |
AM, SA sửa; còn lại xem |
|
FR-1.6a |
Gợi ý khách hàng cũ |
Gõ từ 2 ký tự ở ô Tên khách hàng (tìm theo tên, mã KH hoặc MST, không phân biệt dấu): danh sách KH đã có kèm MST, địa chỉ, hạng KH, số đơn / số đơn hoàn tất, đơn gần nhất và AM. Chọn bằng chuột hoặc ↑↓ + Enter: điền các trường đang trống theo hồ sơ của đơn gần nhất (thiếu thì lấy từ đơn cũ hơn) và hạng KH; trường đã nhập mà khác hồ sơ cũ hiện bảng để chọn cập nhật. Trường giữ nguyên được ghi vào lịch sử là "Bỏ qua gợi ý" |
AM, SA |
|
FR-1.6b |
AI tra cứu MST |
MST là trường bắt buộc (thiếu hoặc sai định dạng thì không gửi duyệt được). Nhập MST hợp lệ thì tự tra cứu (hoặc bấm "✦ Tra cứu"): tên theo đăng ký thuế, địa chỉ, người đại diện, tình trạng, ngày cấp, cơ quan thuế. Tự điền trường trống; trường khác đăng ký thuế hiện bảng để chọn. MST ngừng hoạt động là cảnh báo nghiêm trọng ở t11; tên KH khác tên đăng ký thuế là lưu ý. Nguồn dữ liệu: dịch vụ tra cứu người nộp thuế do backend gọi; AI so khớp tên và chuẩn hóa địa chỉ |
AM, SA |
|
FR-1.6c |
Trường bắt buộc & dùng lại hồ sơ KH |
Bắt buộc: Tên KH, Mã KH, MST, Người liên hệ (SĐT không bắt buộc). Nhập 1 trong 4 trường là gợi ý / tự điền phần còn lại: Tên, Mã KH, MST có danh sách gợi ý KH cũ; nhập đủ MST hoặc Mã KH trùng KH cũ thì tự điền (MST mới thì AI tra cứu đăng ký thuế); Người liên hệ gợi ý người đã dùng của KH (kèm SĐT, email) hoặc tìm người liên hệ để suy ra KH. KH mới: AI gợi ý Mã KH từ tên (viết tắt, bỏ loại hình DN, không trùng). Dùng lại thêm: hạng KH, người đại diện, tài khoản, thông tin giao nhận của lần trước; nút điền nhanh giao nhận (= người liên hệ / = địa chỉ KH / như lần trước); sao chép danh mục từ đơn trước (mua lặp lại / gia hạn); đơn tái ký tự lấy số liệu năm trước từ đơn gần nhất. Chỉ điền ô trống; ô khác hồ sơ cũ hiện bảng để chọn; mọi lần tự điền ghi vào lịch sử |
AM, SA |
|
FR-1.7 |
Xóa đơn |
Xóa đơn khỏi danh sách, có hộp xác nhận |
Admin |
Các trường lấy được từ hợp đồng (địa chỉ KH, người nhận / SĐT / địa chỉ nhận, ngày ký, số lần thanh toán) không bắt buộc khi lập đơn. Chúng chuyển sang bắt buộc ở bước Ký HĐ khách hàng.
### Module 2: Phiếu khảo sát đơn hàng
Mục đích: thu thập các thông số quyết định cách tính P&L và cách chia chỉ tiêu kinh doanh.
|
Mã |
Chức năng |
Mô tả |
Vai trò |
|
FR-2.1 |
Thông tin đơn hàng |
Số HĐ nội bộ*, Số HĐ/PO ký với KH (trống = lấy theo Số HĐ nội bộ), Nội dung đơn*, Ngày ký, AM phụ trách*, Inside Sales, Có phải đơn hàng mới? |
AM, SA |
|
FR-2.2 |
Đơn tái ký / gia hạn |
Khi "Đơn mới = Không": bắt buộc Số HĐ/PO năm trước, CPBH năm trước, Doanh thu năm trước (> 0), LN thuần năm trước. Có ô "Lấy số liệu từ đơn trước của KH" để tự điền 4 ô từ P&L đơn cũ; vẫn sửa tay được |
AM, SA |
|
FR-2.3 |
Nguồn khách hàng |
Chọn "Không" (KH cũ) hoặc người mang KH về. Nếu không phải đơn mới: tự đặt "Không" và khóa ô |
AM, SA |
|
FR-2.4 |
Thông số tài chính |
Hạng KH* (VIP / Tiềm năng / Phổ thông), Số ngày công nợ*, Chi phí bán hàng*, Chi phí dự phòng (Có / Không + giá trị), Số lần thanh toán |
AM, SA |
|
FR-2.5 |
Thưởng triển khai / tư vấn |
Chọn nhân sự triển khai* và nhân sự tư vấn* (hoặc "Không"); tư vấn có thêm tick Proposal, POC |
AM, SA |
|
FR-2.6 |
Loại hợp đồng |
Hệ thống tự nhận các loại hợp đồng từ danh mục (chip). Sale chọn "Loại áp dụng ngưỡng P&L" trong các loại đó; mặc định là loại có doanh thu lớn nhất |
AM, SA |
|
FR-2.7 |
Phân bổ giai đoạn deal |
6 giai đoạn deal, mỗi giai đoạn có hệ số % và nhân sự phụ trách; tổng phải bằng 100% |
AM, SA |
|
FR-2.8 |
Kiểm tra bắt buộc |
Ô thiếu viền đỏ, banner đếm số trường còn thiếu; chưa đủ thì không gửi duyệt được |
Hệ thống |
(*) = trường bắt buộc.
### Module 3: Danh mục Thiết bị / Dịch vụ
Mục đích: khai báo từng dòng hàng hóa / dịch vụ bán ra, giá bán, giá mua dự kiến và nhà cung cấp. Đây là nguồn số liệu chính của P&L.
|
Mã |
Chức năng |
Mô tả |
Vai trò |
|
FR-3.1 |
Thêm / sửa / xóa dòng |
Cột: Loại, CO/CQ, Hàng hóa / Dịch vụ*, ĐVT*, Số lượng*, Thời hạn / Bảo hành (tháng), Đơn giá bán*, Chiết khấu %, VAT, Đơn giá mua, NCC*, Ghi chú |
AM, SA |
|
FR-3.2 |
Thông tin mở rộng từng dòng |
Bấm ▸ ở STT: SKU (TB / license), thông số kỹ thuật, ngày bắt đầu / kết thúc (loại có kỳ hạn), thời gian giao hàng, ưu tiên NCC, thông tin End User |
AM, SA |
|
FR-3.3 |
Tính tiền tự động |
Thành tiền bán, tiền VAT, giá vốn, lãi từng dòng và tổng; dịch vụ định kỳ nhân số tháng; hàng nước ngoài cộng hệ số thuế NTNN |
Hệ thống |
|
FR-3.4 |
Nhóm theo NCC |
Công tắc sắp xếp và nhóm dòng theo nhà cung cấp |
Tất cả |
|
FR-3.5 |
Kiểm tra dòng |
Bắt buộc: tên, ĐVT, SL > 0, giá bán > 0, NCC; TB bắt buộc CO/CQ; loại có kỳ hạn bắt buộc ngày bắt đầu / kết thúc; dịch vụ định kỳ bắt buộc số tháng > 0 |
Hệ thống |
### Module 4: Nhà cung cấp & Đơn mua hàng
Mục đích: quản lý danh sách NCC dùng chung và phương án mua hàng của từng đơn.
|
Mã |
Chức năng |
Mô tả |
Vai trò |
|
FR-4.1 |
Danh sách NCC dùng chung |
Tên, người liên hệ, SĐT, email, các đợt thanh toán (tên đợt, tỷ lệ %, số ngày), số ngày công nợ. Dòng danh mục chỉ chọn NCC theo tên, không gõ lại |
AM, SA sửa; SD, ACC xem |
|
FR-4.2 |
Đơn mua hàng – TB & License |
Chỉ hiện dòng TB, LIC, LIC-DK. Mua hàng nhập giá mua và NCC đề xuất để so với đề xuất của Sale |
PROC sửa; SD, ACC xem |
|
FR-4.3 |
Đơn mua hàng – Dịch vụ |
Các loại còn lại (DVTK, DVDK, Cloud, LIC-NTNN…): danh sách, NCC, điều khoản thanh toán, giá vốn |
TM xem; SD, ACC xem |
|
FR-4.4 |
Tham khảo P&L khi đàm phán |
Trích các chi phí liên quan từ P&L (bảo hành, hỗ trợ license…) kèm công thức |
PROC |
|
FR-4.5 |
Thông số kỹ thuật để đối chiếu |
Kỹ thuật xem thông số TB / LIC, không hiển thị giá |
TM |
|
FR-4.6 |
Bảo mật giá mua đề xuất |
Phần đề xuất của Mua hàng chỉ PROC, SD, ACC xem được |
Hệ thống |
### Module 5: Kết quả P&L
Mục đích: tự động tính hiệu quả tài chính của đơn và kết luận Đạt / Không đạt ngưỡng LN. Mọi vai trò chỉ xem, không sửa.
|
Mã |
Chức năng |
Mô tả |
|
FR-5.1 |
Thẻ tóm tắt |
Kết quả P&L (Đạt ngưỡng LN / Không đạt), Tỷ suất LN thuần / giá vốn, Ngưỡng LN tối thiểu, Doanh thu chưa VAT, LN thuần |
|
FR-5.2 |
Bảng hiệu quả (P&L) |
Doanh thu → Giá vốn → LN gộp → CPBH, CPTC → LN sau CPBH & CPTC → Chi phí khác (thu gọn được: bảo hành, hỗ trợ license, hỗ trợ KT, thưởng triển khai, dự phòng, thưởng tư vấn) → LN thuần |
|
FR-5.3 |
Xem công thức |
Nút "Xem công thức" hiện thêm cột diễn giải cách tính và tham số áp dụng cho từng dòng |
|
FR-5.4 |
Phân tích theo loại |
Doanh thu, giá vốn, VAT đầu ra / đầu vào theo từng loại hàng hóa / dịch vụ |
|
FR-5.5 |
Chia chỉ tiêu kinh doanh (KPI) |
Bảng: nhân sự, các giai đoạn đảm nhận, chỉ tiêu KD ghi nhận (VNĐ) = LN thuần × hệ số |
|
FR-5.6 |
So sánh PO năm trước / năm nay |
Hiện cho đơn tái ký: Số HĐ/PO, CPBH, Doanh thu, LN thuần hai năm |
|
FR-5.7 |
Đơn chốt số liệu |
Đơn đã ký duyệt từ file Excel gốc (ví dụ TM-1036) giữ số liệu P&L đã chốt, không tính lại theo cấu hình mới |
### Module 6: Quy trình xử lý đơn hàng & SLA
Mục đích: điều phối đơn qua 7 giai đoạn, 15 task. Mỗi task giao cho một vai trò, có thời hạn tính bằng ngày làm việc, và mở ngay khi các task tiền đề xong (không chờ cả giai đoạn). Giai đoạn Hợp đồng tách 2 bước: dự thảo (SD duyệt nội dung trước) rồi mới ký bản chính thức. Thanh 7 giai đoạn chỉ để theo dõi tiến độ.
Mỗi task mở ngay khi các task tiền đề (mũi tên vào) đã xong, không chờ cả giai đoạn: ví dụ Kỹ thuật triển khai ngay khi HĐ khách hàng ký xong, song song với Kế toán thanh toán tạm ứng NCC và Mua hàng nhận hàng, không chờ khách hàng tạm ứng.
|
GĐ |
Task |
Vai trò |
Loại thao tác |
Mở khi (task tiền đề) |
Điều kiện áp dụng |
SLA (ngày) |
Đầu ra |
|
1 Khởi tạo |
t11 Lập đơn hàng & gửi duyệt |
AM (hoặc SA) |
Gửi duyệt |
Tạo đơn / bị trả lại |
Mọi đơn |
1 |
Đơn được gửi duyệt |
|
2 Thẩm định |
t22 Duyệt giải pháp & chi phí kỹ thuật |
TM |
Duyệt / Trả lại |
t11 |
Đơn có dịch vụ |
1 |
Phương án kỹ thuật |
|
2 Thẩm định |
t23 Đề xuất giá mua & NCC |
PROC |
Hoàn thành |
t11 |
Đơn có TB / license |
1 |
Phương án mua hàng |
|
3 Phê duyệt |
t31 Phê duyệt đơn & phương án mua hàng |
SD |
Duyệt / Trả lại |
t22, t23 |
Đơn > 300 tr hoặc có mua hàng hoặc chưa đạt ngưỡng LN; còn lại tự duyệt |
1 |
Đơn được phê duyệt |
|
4 Hợp đồng |
t40 Dự thảo HĐ khách hàng |
SA |
Hoàn thành |
t31 |
Mọi đơn (bắt buộc file khi giá trị > 20 tr) |
2 |
Bản dự thảo HĐ KH đã qua AI kiểm tra và rà soát điều khoản |
|
4 Hợp đồng |
t44 Dự thảo HĐ nhà cung cấp |
PROC |
Hoàn thành |
t31 |
Đơn có TB / license |
1 |
Bản dự thảo HĐ từng NCC (kèm lịch tạm ứng) |
|
4 Hợp đồng |
t42 Duyệt dự thảo hợp đồng |
SD |
Đồng ý trình ký / Yêu cầu sửa dự thảo |
t40, t44 |
Mọi đơn |
1 |
Dự thảo được duyệt để trình ký |
|
4 Hợp đồng |
t41 Ký HĐ khách hàng · bản chính thức |
SA |
Hoàn thành |
t42 |
Mọi đơn |
3 |
HĐ KH đủ chữ ký, khớp dự thảo, có Số HĐ/PO |
|
4 Hợp đồng |
t45 Ký HĐ nhà cung cấp · bản chính thức (SD ký = duyệt tạm ứng) |
PROC |
Hoàn thành |
t42 |
Đơn có TB / license |
2 |
HĐ NCC đủ chữ ký, khớp dự thảo |
|
5 Tạm ứng |
t51 Xác nhận KH tạm ứng |
ACC |
Hoàn thành / Không áp dụng |
t41 |
Mọi đơn |
3 |
Tạm ứng được xác nhận |
|
5 Tạm ứng |
t53 Thanh toán tạm ứng NCC |
ACC |
Hoàn thành / Không áp dụng |
t45 |
Đơn có TB / license |
2 |
Chứng từ thanh toán |
|
6 Giao hàng – Triển khai |
t61 Nhận hàng & giao cho KH |
PROC |
Hoàn thành |
t45, t53 (+ t51 nếu KH phải tạm ứng trước) |
Đơn có TB / license |
7 |
Biên bản giao nhận |
|
6 Giao hàng – Triển khai |
t62 Triển khai & nghiệm thu |
TM |
Hoàn thành |
t41 (+ t51 nếu KH phải tạm ứng trước) |
Đơn có dịch vụ |
7 |
Biên bản nghiệm thu |
|
7 Hóa đơn & Đóng đơn |
t71 Kiểm tra biên bản, xuất hóa đơn & gửi hồ sơ thanh toán |
ACC |
Hoàn thành |
t61, t62 |
Mọi đơn |
2 |
Hóa đơn đã phát hành |
|
7 Hóa đơn & Đóng đơn |
t72 Lưu trữ hồ sơ & cập nhật chi phí phát sinh |
ACC |
Hoàn thành |
t71 |
Mọi đơn |
1 |
Hồ sơ hoàn chỉnh |
Task không áp dụng cho đơn (tự bỏ qua) hoặc được bấm "Không áp dụng" coi như đã xong đối với các task phía sau. Theo SLA mặc định, thời gian tối thiểu của một đơn là 19 ngày làm việc (đơn dịch vụ) và 20 ngày (đơn có TB / license). Bước dự thảo thêm khoảng 2 ngày nhưng giảm việc sửa và ký lại hợp đồng sau khi đã ký.
|
Mã |
Chức năng |
Mô tả |
|
FR-6.1 |
Bảng quy trình |
Thanh 7 giai đoạn trên đầu mọi tab (giai đoạn có task đang chạy trước ghi "Song song"); thẻ task theo giai đoạn với người làm, trạng thái, hạn xử lý, task đang chờ ai |
|
FR-6.2 |
Thao tác task |
Gửi duyệt; Duyệt / Trả lại (bắt buộc lý do); Đồng ý trình ký / Yêu cầu sửa dự thảo (t42); Hoàn thành; Không áp dụng (task tùy chọn). Chỉ vai trò phụ trách thấy nút |
|
FR-6.3 |
Trả lại |
Chỉ t22 và t31: đơn quay về GĐ1, mở lại quyền sửa cho AM / SA, ghi lý do vào lịch sử. Riêng t42 "Yêu cầu sửa dự thảo" mở lại t40 / t44 (ghi "Yêu cầu sửa" vào lịch sử) |
|
FR-6.4 |
Mở task theo tiền đề |
Task tự mở khi mọi task tiền đề đã xong / bỏ qua / không áp dụng; khung "Việc của bạn" liệt kê mọi task đang mở của vai trò, có thể thuộc nhiều giai đoạn |
|
FR-6.5 |
Close-lost |
SA ghi nhận đơn thất bại, được phép trước khi ký HĐ khách hàng bản chính thức (t41); đơn dừng quy trình và bị loại khỏi KPI |
|
FR-6.6 |
Thời hạn (SLA) |
Hạn = thời điểm task mở (task tiền đề cuối cùng xong) + số ngày làm việc. Trạng thái: còn hạn, sắp đến hạn (< 1 ngày), quá hạn; task xong ghi đúng hạn / trễ N ngày |
|
FR-6.7 |
Trợ lý AI theo task |
Mỗi task có gợi ý AI riêng; t11 có AI kiểm tra P&L trước khi gửi; t31 có AI tóm tắt và chấm điểm rủi ro; t40 / t44 có AI soạn và kiểm tra dự thảo; t41 / t45 có AI so khớp bản chính thức với dự thảo |
|
FR-6.8 |
Cảnh báo dòng tiền |
Ở t53: hiện số tiền tạm ứng NCC theo HĐ và trạng thái KH tạm ứng; cảnh báo khi trả NCC trước khi KH tạm ứng |
|
FR-6.9 |
Lịch sử xử lý |
Ghi mọi thao tác: thời gian, người, vai trò, hành động, ghi chú |
|
FR-6.10 |
Nhật ký cảnh báo bị bỏ qua |
Trước nút thao tác, khung "⚠ N cảnh báo sẽ được ghi vào lịch sử" liệt kê cảnh báo của AI / hệ thống còn hiệu lực. Khi người dùng vẫn tiếp tục, hệ thống ghi một dòng "Bỏ qua cảnh báo" (người, vai trò, thời gian, task, từng cảnh báo kèm nguồn AI / Hệ thống và mức độ, lý do). Gợi ý AI bị đóng mà không áp dụng ghi "Bỏ qua gợi ý AI". Lịch sử có bộ lọc "Chỉ cảnh báo bị bỏ qua"; Dashboard có thẻ "Đơn có cảnh báo AI / hệ thống bị bỏ qua" mở danh sách đơn |
### Module 7: Hợp đồng & AI hợp đồng
|
Mã |
Chức năng |
Mô tả |
Vai trò |
|
FR-7.1 |
Hai bước hợp đồng |
Mỗi hợp đồng (KH và từng NCC) có 2 bản: bản dự thảo (t40 / t44) để SD duyệt nội dung trước, và bản chính thức đã ký (t41 / t45). Hợp đồng > 20 triệu bắt buộc có file ở cả hai bước |
SA, PROC |
|
FR-7.2 |
AI soạn dự thảo |
Nút "✦ Soạn bằng AI" tạo dự thảo theo mẫu chuẩn từ dữ liệu đơn, P&L đã duyệt, thông tin KH / NCC và thông tin công ty; các ô còn thiếu được tô vàng. Người dùng xem, sửa, tải .docx, hoặc bấm "Dùng làm bản dự thảo" để gắn thẳng vào t40 / t44. Cũng có thể upload dự thảo tự soạn (PDF, Word, HTML, ảnh) |
SA (t40), PROC (t44) |
|
FR-7.3 |
AI kiểm tra dự thảo |
Tự chạy khi gắn dự thảo: đúng bên ký, MST, giá trị so với doanh thu / giá mua, hạng mục, điều khoản thanh toán. Không yêu cầu chữ ký, số HĐ, ngày ký ở bước này. Lỗi nghiêm trọng chặn hoàn thành t40 / t44 trừ khi ghi lý do bỏ qua |
SA, PROC |
|
FR-7.4 |
AI rà soát điều khoản |
Chạy trên dự thảo HĐ KH: so với P&L đã duyệt theo từng hạng mục (giá trị, thanh toán / công nợ, phạt, bảo lãnh, bảo hành, hóa đơn…), đánh giá Khớp / Lưu ý / Rủi ro kèm gợi ý; kết luận Đồng ý ký / Ký, có lưu ý / Chưa nên ký. Bắt buộc chạy trước khi hoàn thành t40 |
SA chạy |
|
FR-7.5 |
SD duyệt dự thảo (t42) |
SD xem dự thảo HĐ KH, HĐ NCC và khuyến nghị AI; bấm "Đồng ý trình ký" để mở t41 / t45, hoặc "Yêu cầu sửa dự thảo" (bắt buộc ghi chú) để mở lại t40 / t44 |
SD |
|
FR-7.6 |
Upload bản chính thức |
Upload bản đã ký ở t41 / t45. AI kiểm tra chữ ký, con dấu và so khớp với dự thảo SD đã duyệt: khác biệt về giá trị, bên ký, điều khoản thanh toán là lỗi chặn; khác biệt nhỏ là lưu ý. Bỏ qua lỗi phải ghi lý do và được lưu vào lịch sử |
SA, PROC |
|
FR-7.7 |
AI bóc tách & tự điền |
Từ bản chính thức HĐ KH: số HĐ/PO, ngày ký, công nợ, số lần thanh toán, người / SĐT / địa chỉ nhận, MST, địa chỉ, người đại diện, tài khoản. Ô trống được điền tự động; ô đã có giá trị khác hiện bảng "Hiện tại / Từ hợp đồng" để chọn. Từ HĐ NCC: số HĐ, ngày ký, giá trị, điều khoản tạm ứng / công nợ |
SA, PROC |
|
FR-7.8 |
Danh sách NCC |
Bảng NCC điền sẵn từ Đơn mua hàng (kèm giá trị), mỗi NCC một cặp dự thảo / chính thức; thêm / bớt NCC |
PROC |
|
FR-7.9 |
Xem hợp đồng |
Khung "Hợp đồng" trên trang đơn liệt kê dự thảo và bản chính thức: tên file, người upload, thời gian, kết quả kiểm tra |
Tất cả vai trò xem được đơn |
### Module 8: KPI & Dashboard kinh doanh
|
Mã |
Chức năng |
Mô tả |
Vai trò |
|
FR-8.1 |
KPI của tôi |
4 thẻ: Chỉ tiêu KD được chia, Doanh thu, LN thuần, Số đơn. Mỗi thẻ: số hoàn tất, thanh 2 lớp Hoàn tất (đậm) / Dự kiến (nhạt, sọc), vạch KPI, % KPI, "gồm dự kiến X%". Bấm để xem danh sách đơn đóng góp |
AM, SA |
|
FR-8.2 |
Bộ lọc kỳ và phạm vi |
Kỳ: năm / quý / tháng / tuần / tất cả. Phạm vi đơn: Đơn đã phê duyệt (từ GĐ4, mặc định) / Mọi đơn trừ Close-lost / Chỉ đơn hoàn tất |
Tất cả |
|
FR-8.3 |
① Tổng quan & KPI |
5 ô: Doanh thu (% kế hoạch), Giá vốn, LN gộp, LN thuần (% kế hoạch), Chi phí bán hàng; biểu đồ cột theo kỳ (hoàn tất đậm, dự kiến nhạt, vạch kế hoạch); bảng KPI theo nhân viên |
Tất cả; bảng KPI đội: SD, ACC, Admin |
|
FR-8.4 |
② Cơ cấu |
Tab Cơ cấu doanh thu (pie 2 vòng: 1 lần / định kỳ → nhóm → loại) và Cơ cấu chi phí (giá vốn 1 lần, giá vốn định kỳ, CPBH & CPTC, chi phí khác); bảng kèm tỷ trọng, LN gộp, biên; bấm lát cắt để xem đơn. Thêm phân tích theo loại HĐ và hạng KH |
Tất cả |
|
FR-8.5 |
③ Chi tiết |
Pipeline theo giai đoạn + cảnh báo (quá hạn, dưới ngưỡng), Top KH / NCC, P&L chi tiết tổng hợp (thu gọn) |
Tất cả |
|
FR-8.6 |
Tooltip & drill-down |
Rê chuột xem số liệu; bấm để mở danh sách đơn tương ứng |
Tất cả |
### Module 9: Tạo đơn hàng từ file (AI)
|
Mã |
Chức năng |
Mô tả |
|
FR-9.1 |
Chọn file |
Nhiều file cùng lúc: PDF, DOCX, XLSX / XLS, CSV, TXT, EML, HTML, ảnh PNG / JPG / WEBP |
|
FR-9.2 |
AI bóc tách |
Đọc thông tin KH và các dòng hàng; tự gán mã loại (TB, LIC, LIC-DK, LIC-NTNN, DVTK, DVDK…), ĐVT, SL, giá bán, NCC nếu có |
|
FR-9.3 |
Xem trước & tạo đơn |
Hiện kết quả để kiểm tra, bấm tạo đơn nháp; trường thiếu được đánh dấu để Sale bổ sung |
### Module 10: Cấu hình hệ thống (Admin)
|
Mã |
Nhóm cấu hình |
Nội dung |
|
FR-10.1 |
Ngưỡng LN & tỷ lệ theo loại hợp đồng |
Ngưỡng tỷ suất LN thuần / giá vốn, thưởng hỗ trợ KT, thưởng triển khai, thưởng tư vấn, thưởng kinh doanh, dự phòng cho: Thương mại 1 lần, TMDK, Dịch vụ 1 lần, Dịch vụ định kỳ, Fulfillment |
|
FR-10.2 |
Mức thuế VAT |
Thêm / xóa mức (KCT, 0%, 5%, 8%, 10%), chọn mặc định; không xóa mức đang dùng hoặc đang mặc định |
|
FR-10.3 |
Thông số tài chính chung |
Tỷ giá cơ sở, lãi suất năm, hệ số thuế NTNN, tỷ lệ hỗ trợ license, hỗ trợ KT, bảo hành TB |
|
FR-10.4 |
Công thức chi phí tài chính |
Bậc tỷ lệ r theo CPBH / giá vốn, riêng cho VIP, Tiềm năng, Phổ thông; thêm / xóa bậc |
|
FR-10.5 |
Nhân sự theo nhóm |
Thêm / xóa người và nhóm (Sales Team, SA Team, Technical Team, Procurement Team…). Danh sách AM / SA và KPI lấy từ nhóm Sales Team |
|
FR-10.6 |
Thời hạn task (SLA) |
Số ngày làm việc cho từng task; 0 = không theo dõi |
|
FR-10.7 |
Kế hoạch kinh doanh năm |
Doanh thu và LN thuần kế hoạch cả công ty |
|
FR-10.8 |
KPI theo nhân viên |
Doanh thu, LN thuần, số đơn, chỉ tiêu KD được chia / năm cho từng AM / SA |
|
FR-10.9 |
Danh mục loại hàng hóa / dịch vụ |
Thêm loại theo nhóm (Thiết bị, License 1 lần, License định kỳ – TMDK, DV triển khai, DV định kỳ, Nước ngoài); xóa loại chưa dùng; bảng quy tắc phân loại hợp đồng & cơ cấu tài chính |
|
FR-10.10 |
Khôi phục mặc định |
Đưa toàn bộ cấu hình về giá trị ban đầu |
## PHẦN 4: QUY TẮC NGHIỆP VỤ
Mọi số tiền tính bằng VNĐ, chưa gồm VAT. Tham số trong ngoặc là giá trị mặc định; Admin sửa được ở Cấu hình.
### 4.1. Phân loại hàng hóa / dịch vụ và loại hợp đồng
|
BR |
Quy tắc |
|
BR-01 |
Mỗi dòng danh mục thuộc đúng một mã loại. Loại hợp đồng được tự nhận theo thứ tự: loại tính theo tháng → Dịch vụ định kỳ; license có kỳ hạn (LIC-DK, LIC-NTNN) → Thương mại định kỳ (TMDK); dịch vụ còn lại → Dịch vụ 1 lần; TB và LIC vĩnh viễn → Thương mại 1 lần |
|
BR-02 |
Đơn có nhiều loại hợp đồng: ngưỡng LN và tỷ lệ thưởng lấy theo loại có doanh thu lớn nhất, trừ khi Sale chọn loại khác trong các loại đơn đang có |
|
BR-03 |
TMDK (LIC-DK, LIC-NTNN): bắt buộc ngày bắt đầu / kết thúc; giá là giá cả kỳ, không nhân số tháng |
|
BR-04 |
Dịch vụ định kỳ (DVDK-*, Cloud Server, Colocation, Veeam, Manage Service, Other Services): giá theo tháng × số tháng; bắt buộc ngày bắt đầu / kết thúc |
|
BR-05 |
VAT: LIC, LIC-DK, LIC-NTNN miễn VAT cả bán và mua; Cloud Server, Colocation, Veeam, Manage Service, Other Services, DVTK-I miễn VAT đầu vào; còn lại theo mức VAT của dòng (mặc định 8%) |
|
BR-06 |
Hàng nước ngoài (LIC-NTNN, DVDK-NTNN): giá vốn cộng hệ số thuế nhà thầu (12%) |
|
BR-07 |
Cơ cấu doanh thu: 1 lần = Hàng hóa (TB, LIC) + DV triển khai (DVTK-I, DVTK-O); định kỳ = License định kỳ (LIC-DK, LIC-NTNN) + DV định kỳ nội bộ (Cloud Server, Backup/DR, Colocation, Manage Service, Khác) + DV định kỳ thuê ngoài + DV định kỳ NTNN |
### 4.2. Công thức P&L
|
Bước |
Khoản mục |
Cách tính |
|
1 |
Doanh thu dòng |
SL × đơn giá bán × (1 − chiết khấu %) × số tháng (nếu DV định kỳ) |
|
2 |
Giá vốn dòng |
SL × đơn giá mua × số tháng (nếu DV định kỳ) × (1 + 12% nếu nước ngoài) |
|
3 |
Lợi nhuận gộp |
Doanh thu − Giá vốn |
|
4 |
Chi phí bán hàng |
Sale nhập ở phiếu khảo sát |
|
5 |
Chi phí tài chính |
CPBH × r / (1 − r); r tra theo tỷ lệ CPBH / giá vốn và hạng KH (bảng 4.3). CPBH = 0 thì CPTC = 0 |
|
6 |
LN sau CPBH & CPTC |
LN gộp − CPBH − CPTC |
|
7 |
Chi phí bảo hành |
Σ (giá vốn TB có bảo hành × số kỳ 12 tháng, làm tròn lên) × 0,2% |
|
8 |
Chi phí hỗ trợ license |
Giá vốn (LIC + LIC-DK + LIC-NTNN + DVDK-NTNN) × 0,5% |
|
9 |
Chi phí hỗ trợ kỹ thuật |
Giá vốn DVDK-I × 5% + giá vốn DVTK-O × 2% |
|
10 |
Thưởng triển khai |
Doanh thu DVTK-I × tỷ lệ theo loại HĐ (5%), chỉ khi có nhân sự triển khai |
|
11 |
Chi phí dự phòng |
Giá vốn × tỷ lệ dự phòng theo loại HĐ, chỉ khi chọn "Có" |
|
12 |
Thưởng tư vấn |
max(0, LN sau bước 6–11) × (tỷ lệ tư vấn theo loại HĐ + 2% nếu có Proposal + 2% nếu có POC), chỉ khi có nhân sự tư vấn |
|
13 |
Lợi nhuận thuần |
LN sau CPBH & CPTC − (7) − (8) − (9) − (10) − (11) − (12) |
|
14 |
Ngưỡng LN tối thiểu |
Ngưỡng theo loại HĐ + 0,5% cho mỗi 15 ngày công nợ vượt 30 ngày (làm tròn xuống) |
|
15 |
Kết quả |
Đạt ngưỡng LN khi LN thuần / Giá vốn ≥ Ngưỡng; ngược lại Không đạt |
Tổng chi phí trên Dashboard = Doanh thu − LN thuần, bao gồm giá vốn và mọi khoản ở bước 4–12.
### 4.3. Tham số mặc định
|
Chỉ tiêu |
TM 1 lần |
TMDK |
DV 1 lần |
DV định kỳ |
Fulfillment |
|
Ngưỡng LN thuần / giá vốn |
8% |
5% |
40% |
10% |
3% |
|
Thưởng hỗ trợ KT định kỳ |
3% |
3% |
3% |
3% |
3% |
|
Thưởng triển khai |
5% |
5% |
5% |
5% |
5% |
|
Thưởng tư vấn (cơ sở) |
3% |
1% |
3% |
3% |
1% |
|
Thưởng kinh doanh |
10% |
8% |
10% |
10% |
0% |
|
Chi phí dự phòng |
1% |
0,5% |
5% |
5% |
0% |
Bậc tỷ lệ r của chi phí tài chính theo CPBH / giá vốn:
|
Hạng KH |
Dưới 10% |
≥ 10% |
≥ 20% |
≥ 30% |
≥ 40% |
≥ 50% |
≥ 60% |
≥ 70% |
|
VIP |
15% |
20% |
25% |
30% |
35% |
40% |
45% |
50% |
|
Tiềm năng |
20% |
25% |
30% |
35% |
40% |
45% |
50% |
55% |
|
Phổ thông |
25% |
30% |
35% |
40% |
45% |
50% |
55% |
60% |
Tham số chung: VAT mặc định 8%; tỷ giá cơ sở 26.000; lãi suất năm 14,6%; hệ số NTNN 12%; hỗ trợ license 0,5%; hỗ trợ KT định kỳ nội bộ 5%; hỗ trợ KT thuê ngoài 2%; bảo hành TB 0,2%; kế hoạch năm: doanh thu 25 tỷ, LN thuần 5,2 tỷ.
### 4.4. Đơn mới, đơn tái ký và nguồn khách hàng
|
BR |
Quy tắc |
|
BR-20 |
"Có phải đơn hàng mới?" mặc định Có |
|
BR-21 |
Không phải đơn mới: bắt buộc Số HĐ/PO năm trước, CPBH năm trước, Doanh thu năm trước (> 0), LN thuần năm trước. Các ô này để trống khi tạo đơn, không mặc định 0 |
|
BR-22 |
Có thể lấy số liệu năm trước từ một đơn trước của cùng KH (cùng mã KH hoặc tên KH, ngày đơn sớm hơn): lấy Số HĐ/PO, CPBH, Doanh thu, LN thuần từ P&L đơn đó |
|
BR-23 |
Không phải đơn mới thì Nguồn khách hàng = "Không" (KH cũ), tự đặt và khóa; nếu dữ liệu có nguồn là một người thì báo lỗi bắt buộc |
### 4.5. Chia chỉ tiêu kinh doanh và KPI
|
BR |
Quy tắc |
|
BR-30 |
6 giai đoạn deal và hệ số mặc định: Cơ hội 20%, Làm rõ yêu cầu 30%, Báo giá 10%, Đàm phán 10%, Chốt deal 20%, HĐ · Thanh toán · CSKH 10%; tổng = 100%. Mặc định AM phụ trách 5 giai đoạn đầu, Inside Sales giai đoạn cuối (nếu có) |
|
BR-31 |
Chỉ tiêu KD được chia của một người = LN thuần × tổng hệ số các giai đoạn người đó đảm nhận |
|
BR-32 |
Người mang KH về (nguồn KH) được cộng thêm 20% nếu có tham gia giai đoạn deal; KH cũ không có phần này |
|
BR-33 |
Hoàn tất = đơn đã đi hết 7 giai đoạn; Dự kiến = mọi đơn chưa hoàn tất, trừ Close-lost (kể cả đơn ở GĐ1–3) |
|
BR-34 |
% KPI và % kế hoạch tính trên số hoàn tất; hiển thị thêm "gồm dự kiến X%" = (hoàn tất + dự kiến) / chỉ tiêu |
|
BR-35 |
KPI và kế hoạch nhập theo năm; xem theo quý / tháng / tuần quy đổi 1/4, 1/12, 1/52 |
|
BR-36 |
Đơn tính vào KPI của AM = đơn AM phụ trách; của Sales Admin = đơn được giao cho SA đó |
|
BR-37 |
Màu thanh KPI: xanh ≥ 100%, vàng ≥ 70%, đỏ < 70% |
### 4.6. Quy trình, phê duyệt và SLA
|
BR |
Quy tắc |
|
BR-40 |
Task áp dụng theo nội dung đơn: có dịch vụ → t22, t62; có TB / license → t23, t44, t45, t53, t61. t31 bắt buộc khi đơn > 300 triệu hoặc có mua hàng; đơn ≤ 300 triệu, không mua hàng và đạt ngưỡng LN thì tự duyệt |
|
BR-41 |
Task mở ngay khi các task tiền đề đã xong / bỏ qua / không áp dụng: t22, t23 ← t11 · t31 ← t22, t23 · t40, t44 ← t31 · t42 ← t40, t44 · t41, t45 ← t42 · t51 ← t41 · t53 ← t45 · t61 ← t45, t53 · t62 ← t41 · t71 ← t61, t62 · t72 ← t71. Không chờ cả giai đoạn |
|
BR-42 |
Chỉ gửi duyệt khi Phiếu khảo sát, Danh mục và Thông tin đơn không còn trường bắt buộc trống và không còn lỗi định dạng |
|
BR-43 |
Chỉ t22 (Duyệt kỹ thuật) và t31 (Phê duyệt đơn) được Trả lại; đơn về GĐ1 và bắt buộc ghi lý do. Ở t42, SD "Yêu cầu sửa dự thảo" chỉ mở lại t40 / t44, không trả đơn về GĐ1 |
|
BR-44 |
Hợp đồng KH hoặc NCC có giá trị > 20 triệu bắt buộc có file ở cả bước dự thảo và bước chính thức; mỗi file phải qua AI kiểm tra, còn lỗi nghiêm trọng thì phải ghi lý do bỏ qua mới hoàn thành được task |
|
BR-45 |
Bước Ký HĐ KH (t41) bắt buộc: Số HĐ/PO, ngày ký, số lần thanh toán, địa chỉ KH, thông tin nhận hàng; bản chính thức phải khớp dự thảo đã duyệt về giá trị, bên ký và điều khoản thanh toán |
|
BR-46 |
Không ký bản chính thức khi SD chưa duyệt dự thảo (t42). Sửa nội dung sau khi duyệt thì phải gửi lại dự thảo. SD ký HĐ NCC (có lịch tạm ứng) đồng thời là duyệt tạm ứng NCC. HĐ NCC chỉ có hiệu lực khi HĐ khách hàng đã ký, trừ khi SD cho phép đặt hàng sớm |
|
BR-47 |
Giao hàng / triển khai không chờ KH tạm ứng, trừ khi Phiếu khảo sát chọn "KH tạm ứng trước khi giao / triển khai = Có" (khi đó t61, t62 chờ thêm t51). NCC không yêu cầu tạm ứng thì Kế toán bấm "Không áp dụng" ở t53 để mở t61 |
|
BR-48 |
Cảnh báo dòng tiền khi thanh toán tạm ứng NCC trước khi KH tạm ứng (tiền tạm ứng NCC = giá vốn theo từng NCC × tỷ lệ tạm ứng trong danh sách NCC) |
|
BR-49 |
SLA tính bằng ngày làm việc T2–T6 từ lúc task mở (task tiền đề cuối cùng xong); t11 tính từ ngày tạo đơn hoặc lần bị trả lại gần nhất. Sắp đến hạn khi còn dưới 24 giờ; SLA = 0 thì không theo dõi |
|
BR-4A |
Close-lost được phép trước khi ký HĐ khách hàng bản chính thức (t41); đơn Close-lost dừng quy trình, không tính vào doanh thu, KPI, dự kiến |
|
BR-4B |
Thanh 7 giai đoạn chỉ để theo dõi: giai đoạn hiện tại là giai đoạn đầu tiên còn task chưa xong; đơn "đã phê duyệt" khi xong GĐ1–3 |
|
BR-4C |
Mọi cảnh báo của AI hoặc hệ thống mà người dùng vẫn tiếp tục đều được ghi vào lịch sử xử lý, không sửa / xóa được. Áp dụng cho: t11 gửi duyệt khi AI kiểm tra P&L còn lỗi / lưu ý; t31 duyệt khi P&L không đạt hoặc AI không khuyến nghị "Duyệt"; t40 / t42 tiếp tục khi AI rà soát điều khoản là "Ký, có lưu ý" / "Chưa nên ký"; dùng dự thảo hoặc bản chính thức còn lỗi / lưu ý của AI (kể cả lệch dự thảo); dùng dự thảo AI soạn còn chỗ trống; áp dụng dữ liệu HĐ khi giá trị lệch doanh thu; tạo đơn từ file khi AI báo thiếu dữ liệu; t53 trả tạm ứng NCC khi KH chưa tạm ứng; hoàn thành task quá hạn SLA; đóng gợi ý AI phân loại / bóc tách mà không áp dụng. Cảnh báo mức nghiêm trọng bắt buộc ghi lý do; mức lưu ý được ghi tự động, lý do khuyến khích |
### 4.7. Danh mục và cấu hình
|
BR |
Quy tắc |
|
BR-50 |
Không xóa được loại hàng hóa / dịch vụ, mức VAT đang được dùng trong đơn; không xóa mức VAT mặc định |
|
BR-51 |
Thay đổi cấu hình áp dụng ngay cho các đơn tính tự động; đơn đã chốt số liệu (ký duyệt từ Excel) giữ nguyên |
|
BR-52 |
Danh sách AM / Sales Admin và bảng KPI lấy từ nhóm Sales Team; "Team Marketing" và "Other" là nguồn KH, không phải nhân viên |
|
BR-53 |
Mã đơn: TM- cho đơn có thiết bị, DV- cho đơn chỉ có dịch vụ |
### 4.8. Quy tắc định dạng trường nhập liệu
Mỗi trường được kiểm tra định dạng ngay khi nhập: ô sai viền đỏ kèm hướng dẫn dưới ô. Một số trường được tự chuẩn hóa trước khi lưu. Trường trống chỉ bị báo khi là trường bắt buộc.
|
Loại |
Áp dụng cho |
Quy tắc |
Ví dụ hợp lệ |
Tự chuẩn hóa |
|
Số điện thoại |
Điện thoại KH, SĐT nhận hàng, SĐT NCC |
Di động 10 số bắt đầu 03/05/07/08/09; cố định 11 số bắt đầu 02 |
0909 123 456 · 028 3800 0000 |
Bỏ dấu chấm, gạch; +84 → 0; nhóm 4-3-3 / 3-4-4 |
|
Email |
Email KH, email NCC, email End User |
ten@miền.đuôi (đuôi ≥ 2 ký tự) |
cntt@barria.gov.vn |
Chữ thường, bỏ khoảng trắng |
|
Ngày |
Ngày ký, ngày báo giá, hiệu lực đến, ngày bắt đầu / kết thúc |
dd/mm/yyyy, ngày có thật, năm 2000–2100 |
05/11/2026 |
5-11-2026, 5.11.2026, 2026-11-05, 05112026 → 05/11/2026 |
|
Mã số thuế |
MST khách hàng, MST công ty |
10 số, hoặc 13 số dạng 10 số-3 số (chi nhánh) |
0312345678 · 0312345678-001 |
Bỏ khoảng trắng |
|
Số tài khoản |
TK khách hàng, TK công ty |
6–19 chữ số |
0071000123456 |
Bỏ khoảng trắng, dấu chấm, gạch |
|
Mã khách hàng |
Mã KH |
2–20 ký tự in hoa không dấu, số, - _ |
SOGTVTLD |
Chuyển in hoa, bỏ khoảng trắng |
|
Số HĐ / PO |
Số HĐ nội bộ, Số HĐ/PO KH, Số HĐ năm trước, Số HĐ NCC |
2–40 ký tự: chữ, số, / - . _ |
018/2026/HĐ-KLM |
— |
|
SKU |
SKU thiết bị / license |
1–40 ký tự: chữ không dấu, số, - _ . / + |
HIK-1 |
— |
|
Họ tên |
Người liên hệ, người đại diện, người nhận, người liên hệ End User |
2–80 ký tự, có chữ, không chứa số hoặc @ |
Chị Hạnh (Phòng CNTT) |
Gộp khoảng trắng thừa |
|
Văn bản |
Tên KH, địa chỉ, nội dung đơn, tên hàng, ngân hàng, chức vụ |
2–300 ký tự, phải có chữ |
Máy chủ Dell PowerEdge R750 |
Gộp khoảng trắng thừa |
|
ĐVT |
Đơn vị tính |
1–20 ký tự, có chữ |
Cái · Gói · Tháng |
— |
|
Số tiền |
Giá bán, giá mua, CPBH, dự phòng, giá trị HĐ NCC, DT / CPBH năm trước, mốc KPI, kế hoạch |
Số ≥ 0, dấu chấm phân cách nghìn |
15.000.000 |
— |
|
Số tiền có dấu |
LN thuần năm trước |
Số, có thể âm; không lớn hơn DT năm trước |
-2.500.000 |
— |
|
Số lượng |
SL dòng hàng |
Số nguyên > 0 |
17 |
— |
|
Số tháng |
Thời hạn / bảo hành |
Số nguyên 0–120; DV định kỳ phải > 0 và khớp khoảng ngày bắt đầu – kết thúc (lệch tối đa 1 tháng) |
12 |
— |
|
Tỷ lệ % |
Chiết khấu, tỷ lệ tạm ứng NCC, mọi tỷ lệ trong Cấu hình |
0–100, số lẻ dùng dấu phẩy |
0,5 · 30 |
— |
|
Công nợ |
Số ngày công nợ KH |
Số nguyên 0–365 |
45 ngày |
45 → 45 ngày |
|
Số ngày |
Thời gian giao hàng, số ngày đợt tạm ứng, công nợ NCC, SLA task |
Số nguyên 0–365 |
5 |
— |
|
Số lần thanh toán |
Số lần thanh toán |
Số nguyên 1–12 |
2 |
— |
|
Đếm |
New logo tối thiểu / KPI |
Số nguyên ≥ 0 |
2 |
— |
Ràng buộc giữa các trường:
Ngày kết thúc phải sau ngày bắt đầu; hiệu lực báo giá phải sau ngày báo giá.
LN thuần năm trước không lớn hơn doanh thu năm trước.
Giá bán, giá mua không âm; tổng tỷ lệ tạm ứng NCC không quá 100%.
Còn lỗi định dạng thì không gửi duyệt được (t11) và không hoàn thành được bước Ký HĐ khách hàng (t41); checklist liệt kê các trường sai.
## PHẦN 5: YÊU CẦU PHI CHỨC NĂNG
Đây là yêu cầu cho bản phần mềm thật. Mockup hiện tại chạy dữ liệu mẫu trong trình duyệt, chưa có máy chủ và đăng nhập thật; file upload chỉ lưu trong phiên.
|
Mã |
Nhóm |
Yêu cầu |
|
NFR-01 |
Hiệu năng |
Mở danh sách đơn và trang đơn dưới 2 giây với 5.000 đơn; tính lại P&L khi sửa một ô dưới 0,5 giây; Dashboard theo năm dưới 3 giây |
|
NFR-02 |
Hiệu năng AI |
Bóc tách một file báo giá / hợp đồng dưới 60 giây, có thanh tiến trình và cho phép hủy |
|
NFR-03 |
Xác thực |
Đăng nhập bằng tài khoản công ty (SSO); mỗi người dùng gắn một hoặc nhiều vai trò do Admin cấp |
|
NFR-04 |
Phân quyền dữ liệu |
Kiểm tra quyền ở máy chủ theo ma trận 2.5, không chỉ ẩn trên giao diện; giá mua đề xuất và P&L không trả về cho vai trò không được xem |
|
NFR-05 |
Bảo mật tài liệu |
Hợp đồng lưu mã hóa, tải về qua liên kết có thời hạn; giới hạn 25 MB mỗi file; chỉ nhận PDF, Word, Excel, ảnh, TXT, EML, HTML |
|
NFR-06 |
Bảo mật AI |
Dữ liệu gửi cho AI chỉ gồm nội dung cần xử lý, không dùng để huấn luyện mô hình; mọi kết quả AI phải được người dùng xác nhận trước khi ghi vào đơn |
|
NFR-07 |
Lưu vết |
Ghi lại mọi thao tác quy trình, thay đổi số liệu P&L và thay đổi cấu hình: ai, lúc nào, giá trị cũ / mới; lưu tối thiểu 5 năm |
|
NFR-08 |
Phiên bản cấu hình |
Mỗi đơn lưu lại bộ tham số tại thời điểm phê duyệt để P&L đã duyệt không đổi khi Admin sửa cấu hình sau đó |
|
NFR-09 |
Khả dụng |
Hoạt động 99,5% giờ làm việc; sao lưu dữ liệu hằng ngày, khôi phục trong 4 giờ |
|
NFR-10 |
Giao diện |
Tiếng Việt; số tiền định dạng dấu chấm hàng nghìn, ngày dd/mm/yyyy; giao diện sáng / tối; dùng được trên màn hình từ 360 px (điện thoại) |
|
NFR-11 |
Khả năng truy cập |
Biểu đồ có nhãn và tooltip, không dùng màu là tín hiệu duy nhất (Hoàn tất đậm / Dự kiến nhạt có sọc); điều khiển được bằng bàn phím |
|
NFR-12 |
Thông báo |
Báo cho người phụ trách khi có task mới, task sắp / đã quá hạn, đơn bị trả lại (trong ứng dụng và email) |
|
NFR-13 |
Mở rộng |
Thêm loại hàng hóa, vai trò, task hoặc giai đoạn bằng cấu hình, không phải sửa mã nguồn; có API để kết nối CRM và phần mềm kế toán sau này |
|
NFR-14 |
Xuất dữ liệu |
Xuất P&L đơn và báo cáo Dashboard ra Excel / PDF theo đúng bố cục trên màn hình |
Các con số ở NFR-01, 02, 05, 07, 09 là đề xuất ban đầu, cần IT và Ban giám đốc xác nhận.
