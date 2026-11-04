// Every text of the module, in Vietnamese (the business's language) and English.
export type Lang = 'en' | 'vi';

export const langOf = (locale: string): Lang => (locale.toLowerCase().startsWith('vi') ? 'vi' : 'en');

const vi = {
  appName: 'Hiệu quả đơn hàng',
  orders: 'Đơn hàng', newOrder: 'Tạo đơn', myTasks: 'Việc của bạn', noOrders: 'Chưa có đơn hàng nào.', noTasks: 'Không có việc nào đang chờ bạn.',
  save: 'Lưu đơn', saving: 'Đang lưu…', saved: 'Đã lưu', back: 'Quay lại', loadFailed: 'Không tải được dữ liệu.', actionFailed: 'Thao tác không thành công.',
  code: 'Mã đơn', customer: 'Khách hàng', am: 'AM', status: 'Trạng thái', revenue: 'Doanh thu', result: 'Kết quả P&L',
  customerInfo: 'Thông tin khách hàng', survey: 'Phiếu khảo sát', lines: 'Danh mục hàng hóa / dịch vụ', plTitle: 'Kết quả P&L',
  fCustomer: 'Tên khách hàng', fCustomerCode: 'Mã KH', fTax: 'MST', fContact: 'Người liên hệ', fContent: 'Nội dung đơn hàng', fInternalNo: 'Số HĐ nội bộ',
  fAm: 'AM phụ trách (mã người dùng)', fIs: 'Inside Sale (mã người dùng)', fTier: 'Hạng KH', fCredit: 'Số ngày công nợ', fSalesCost: 'Chi phí bán hàng',
  fDeploy: 'NV triển khai (mã người dùng)', fConsult: 'NV tư vấn (mã người dùng)', fProposal: 'Tư vấn có Proposal', fPoc: 'Tư vấn có PoC',
  fKind: 'Loại HĐ áp ngưỡng', fKindAuto: 'Tự nhận theo danh mục', fAdvance: 'KH tạm ứng trước khi giao / triển khai',
  tierVip: 'VIP', tierPotential: 'Tiềm năng', tierRegular: 'Phổ thông',
  addLine: 'Thêm dòng', removeLine: 'Xóa dòng', colType: 'Loại', colDesc: 'Hàng hóa / dịch vụ', colUnit: 'ĐVT', colQty: 'SL', colSell: 'Đơn giá bán',
  colDiscount: 'CK %', colBuy: 'Đơn giá mua dự kiến', monthsService: 'Số tháng dịch vụ', monthsWarranty: 'Tháng bảo hành', months: 'Số tháng', line: 'dòng',
  pass: 'Đạt', fail: 'Không đạt', margin: 'Tỷ suất LN thuần / giá vốn', threshold: 'Ngưỡng LN tối thiểu', netProfit: 'LN thuần',
  lockedAt: 'Số đã chốt lúc', liveCalc: 'Đang tính trên dữ liệu bạn nhập',
  plRevenue: 'Doanh thu (chưa VAT)', plCost: 'Giá vốn', plGross: 'Lợi nhuận gộp', plSales: '− Chi phí bán hàng', plFinance: '− Chi phí tài chính',
  plWarranty: '− Chi phí bảo hành', plLicense: '− Hỗ trợ license', plTech: '− Hỗ trợ kỹ thuật', plDeploy: '− Thưởng triển khai', plProvision: '− Trích dự phòng',
  plConsult: '− Thưởng tư vấn', plFund: '+ Bù từ quỹ dự phòng', plNet: 'Lợi nhuận thuần',
  submit: 'Gửi duyệt', approve: 'Duyệt', returnBack: 'Trả lại', complete: 'Hoàn thành', reason: 'Lý do',
  missing: 'Còn trường bắt buộc chưa điền', stage: 'Giai đoạn',
  'status.nhap': 'Nháp', 'status.dang_xu_ly': 'Đang xử lý', 'status.tra_lai': 'Bị trả lại', 'status.da_phe_duyet': 'Đã phê duyệt',
  'status.hoan_tat': 'Hoàn tất', 'status.close_lost': 'Close-lost',
  'task.t11': 'Lập đơn & gửi duyệt', 'task.t22': 'Duyệt giải pháp & chi phí kỹ thuật', 'task.t23': 'Đề xuất giá mua & NCC', 'task.t31': 'Phê duyệt đơn hàng',
  'stage.1': 'Khởi tạo', 'stage.2': 'Thẩm định', 'stage.3': 'Phê duyệt', 'stage.4': 'Hợp đồng', 'stage.5': 'Tạm ứng', 'stage.6': 'Giao hàng – Triển khai', 'stage.7': 'Đóng đơn',
  'type.tb': 'TB', 'type.lic': 'LIC', 'type.lic_dk': 'LIC-DK', 'type.lic_ntnn': 'LIC-NTNN', 'type.dvtk_i': 'DVTK-I', 'type.dvtk_o': 'DVTK-O',
  'type.dvdk_i': 'DVDK-I', 'type.dvdk_o': 'DVDK-O', 'type.dvdk_ntnn': 'DVDK-NTNN', 'type.cloud_server': 'Cloud Server', 'type.colocation': 'Colocation',
  'type.veeam': 'Veeam', 'type.manage_service': 'Manage Service', 'type.other_services': 'Other Services',
  'kind.thuong_mai': 'Thương mại 1 lần', 'kind.license_runrate': 'Thương mại định kỳ', 'kind.dv_loai_1': 'Dịch vụ 1 lần', 'kind.dv_loai_2': 'Dịch vụ định kỳ',
  'kind.fulfillment': 'Fulfillment',
};

const en: typeof vi = {
  appName: 'Order performance',
  orders: 'Orders', newOrder: 'New order', myTasks: 'Your work', noOrders: 'No orders yet.', noTasks: 'Nothing is waiting for you.',
  save: 'Save order', saving: 'Saving…', saved: 'Saved', back: 'Back', loadFailed: 'Could not load the data.', actionFailed: 'The action failed.',
  code: 'Order', customer: 'Customer', am: 'AM', status: 'Status', revenue: 'Revenue', result: 'P&L result',
  customerInfo: 'Customer', survey: 'Survey', lines: 'Goods and services', plTitle: 'P&L result',
  fCustomer: 'Customer name', fCustomerCode: 'Customer code', fTax: 'Tax ID', fContact: 'Contact', fContent: 'Order content', fInternalNo: 'Internal contract no.',
  fAm: 'AM (user id)', fIs: 'Inside Sale (user id)', fTier: 'Customer tier', fCredit: 'Credit days', fSalesCost: 'Sales cost',
  fDeploy: 'Deployment staff (user id)', fConsult: 'Consulting staff (user id)', fProposal: 'Consulting has a proposal', fPoc: 'Consulting has a PoC',
  fKind: 'Contract kind for the threshold', fKindAuto: 'Detected from the lines', fAdvance: 'Customer pays an advance before delivery / deployment',
  tierVip: 'VIP', tierPotential: 'Potential', tierRegular: 'Regular',
  addLine: 'Add line', removeLine: 'Remove line', colType: 'Type', colDesc: 'Goods / service', colUnit: 'Unit', colQty: 'Qty', colSell: 'Sell price',
  colDiscount: 'Disc. %', colBuy: 'Expected buy price', monthsService: 'Service months', monthsWarranty: 'Warranty months', months: 'Months', line: 'line',
  pass: 'Passed', fail: 'Failed', margin: 'Net profit / cost', threshold: 'Minimum threshold', netProfit: 'Net profit',
  lockedAt: 'Figures locked at', liveCalc: 'Calculated from what you entered',
  plRevenue: 'Revenue (before VAT)', plCost: 'Cost', plGross: 'Gross profit', plSales: '− Sales cost', plFinance: '− Financial cost',
  plWarranty: '− Warranty', plLicense: '− License support', plTech: '− Technical support', plDeploy: '− Deployment bonus', plProvision: '− Provision',
  plConsult: '− Consulting bonus', plFund: '+ Fund top-up', plNet: 'Net profit',
  submit: 'Submit', approve: 'Approve', returnBack: 'Send back', complete: 'Complete', reason: 'Reason',
  missing: 'Required fields are missing', stage: 'Stage',
  'status.nhap': 'Draft', 'status.dang_xu_ly': 'In progress', 'status.tra_lai': 'Sent back', 'status.da_phe_duyet': 'Approved',
  'status.hoan_tat': 'Completed', 'status.close_lost': 'Closed-lost',
  'task.t11': 'Create and submit the order', 'task.t22': 'Approve technical solution and cost', 'task.t23': 'Propose purchase price and supplier', 'task.t31': 'Approve the order',
  'stage.1': 'Start', 'stage.2': 'Assessment', 'stage.3': 'Approval', 'stage.4': 'Contract', 'stage.5': 'Advance', 'stage.6': 'Delivery – Deployment', 'stage.7': 'Closing',
  'type.tb': 'TB', 'type.lic': 'LIC', 'type.lic_dk': 'LIC-DK', 'type.lic_ntnn': 'LIC-NTNN', 'type.dvtk_i': 'DVTK-I', 'type.dvtk_o': 'DVTK-O',
  'type.dvdk_i': 'DVDK-I', 'type.dvdk_o': 'DVDK-O', 'type.dvdk_ntnn': 'DVDK-NTNN', 'type.cloud_server': 'Cloud Server', 'type.colocation': 'Colocation',
  'type.veeam': 'Veeam', 'type.manage_service': 'Manage Service', 'type.other_services': 'Other Services',
  'kind.thuong_mai': 'One-off trade', 'kind.license_runrate': 'Recurring trade', 'kind.dv_loai_1': 'One-off service', 'kind.dv_loai_2': 'Recurring service',
  'kind.fulfillment': 'Fulfillment',
};

export const TEXT: Record<Lang, typeof vi> = { vi, en };
export type TextKey = keyof typeof vi;
