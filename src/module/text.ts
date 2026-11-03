// Every text of the module, in Vietnamese (the business's language) and English.
import { OrdersError } from './orders-api.js';

export type Lang = 'en' | 'vi';

export const langOf = (locale: string): Lang => (locale.toLowerCase().startsWith('vi') ? 'vi' : 'en');

const vi = {
  listHeading: 'Danh sách đơn hàng',
  newOrderHeading: 'Tạo đơn hàng mới',
  newOrder: 'Tạo đơn hàng mới',
  loading: 'Đang tải',
  retry: 'Thử lại',
  retryHint: 'AgentFlow không cho biết lý do. Hãy thử lại sau giây lát.',
  offline: 'Không kết nối được AgentFlow. Hãy kiểm tra kết nối mạng.',
  notInstalled: (keys: string) => `Ứng dụng P&L chưa được cài đủ trong tổ chức này (thiếu ${keys}).`,
  loadFailed: 'Không tải được dữ liệu.',
  // The list
  periods: { all: 'Tất cả', year: 'Năm', quarter: 'Quý', month: 'Tháng', week: 'Tuần' },
  periodLabel: { year: (y: number) => `Năm ${y}`, quarter: (q: number, y: number) => `Quý ${q}/${y}`,
    month: (m: number, y: number) => `Tháng ${m}/${y}`, week: (from: string, to: string) => `Tuần ${from} – ${to}` },
  periodGroup: 'Kỳ',
  previousPeriod: 'Kỳ trước',
  nextPeriod: 'Kỳ sau',
  statusFilter: 'Trạng thái',
  anyStatus: 'Mọi trạng thái',
  amFilter: 'AM phụ trách',
  anyAm: 'Tất cả AM',
  status: { draft: 'Nháp', in_progress: 'Đang xử lý', done: 'Hoàn tất', close_lost: 'Close-lost' },
  stageOf: (n: number) => `GĐ ${n}/7`,
  colCode: 'Mã đơn',
  colCustomer: 'Khách hàng',
  colOwner: 'Phụ trách',
  colStatus: 'Trạng thái',
  colRevenue: 'Doanh thu (VNĐ)',
  colMyLines: 'Dòng thuộc bạn',
  colResult: 'Kết quả P&L',
  draftCode: 'Nháp',
  saPrefix: 'SA:',
  passed: 'Đạt',
  failed: 'Không đạt',
  caption: 'Đơn hàng, mới nhất trước',
  emptyTitle: 'Chưa có đơn hàng nào',
  emptyBody: 'Tạo đơn hàng mới, đơn sẽ hiện ở đây.',
  noMatch: 'Không có đơn hàng nào khớp bộ lọc.',
  deleteOrder: (name: string) => `Xóa đơn ${name}`,
  deleteHeading: 'Xóa đơn hàng?',
  deleteBody: 'Đơn, các dòng danh mục, giá và P&L của đơn sẽ bị xóa. Không hoàn tác được.',
  deleteConfirm: 'Xóa đơn',
  cancel: 'Hủy',
  deleted: 'Đã xóa đơn',
  deleteFailed: 'Không xóa được đơn.',
  count: (n: number) => `${n} đơn`,
};

type Text = typeof vi;

const en: Text = {
  listHeading: 'Sales orders',
  newOrderHeading: 'New sales order',
  newOrder: 'New sales order',
  loading: 'Loading',
  retry: 'Try again',
  retryHint: "AgentFlow didn't say why. Try again in a moment.",
  offline: "Couldn't reach AgentFlow. Check your connection.",
  notInstalled: (keys: string) => `The P&L app is not fully installed in this organization (missing ${keys}).`,
  loadFailed: "Couldn't load the data.",
  periods: { all: 'All', year: 'Year', quarter: 'Quarter', month: 'Month', week: 'Week' },
  periodLabel: { year: (y: number) => `${y}`, quarter: (q: number, y: number) => `Q${q} ${y}`,
    month: (m: number, y: number) => `${String(m).padStart(2, '0')}/${y}`, week: (from: string, to: string) => `Week ${from} – ${to}` },
  periodGroup: 'Period',
  previousPeriod: 'Previous period',
  nextPeriod: 'Next period',
  statusFilter: 'Status',
  anyStatus: 'Any status',
  amFilter: 'Account manager',
  anyAm: 'All account managers',
  status: { draft: 'Draft', in_progress: 'In progress', done: 'Done', close_lost: 'Close-lost' },
  stageOf: (n: number) => `Stage ${n}/7`,
  colCode: 'Order',
  colCustomer: 'Customer',
  colOwner: 'Owner',
  colStatus: 'Status',
  colRevenue: 'Revenue (VND)',
  colMyLines: 'Your lines',
  colResult: 'P&L result',
  draftCode: 'Draft',
  saPrefix: 'SA:',
  passed: 'Passed',
  failed: 'Failed',
  caption: 'Sales orders, newest first',
  emptyTitle: 'No sales orders yet',
  emptyBody: 'Create a sales order and it shows up here.',
  noMatch: 'No sales order matches the filters.',
  deleteOrder: (name: string) => `Delete order ${name}`,
  deleteHeading: 'Delete this order?',
  deleteBody: "The order, its lines, prices and P&L are deleted. This can't be undone.",
  deleteConfirm: 'Delete order',
  cancel: 'Cancel',
  deleted: 'Order deleted',
  deleteFailed: "Couldn't delete the order.",
  count: (n: number) => (n === 1 ? '1 order' : `${n} orders`),
};

export const TEXT: Record<Lang, Text> = { vi, en };
export type { Text };

/** What to tell the person about a failed call: AgentFlow's own reason when it gave one, else `fallback`. */
export function errorText(error: unknown, t: Text, fallback: string): string {
  if (error instanceof OrdersError) {
    if (error.code === 'NOT_INSTALLED') return t.notInstalled(error.reason ?? '');
    if (error.code === 'NETWORK') return t.offline;
    if (error.reason) return error.reason;
  }
  return fallback;
}
