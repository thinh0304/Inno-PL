// Every text of the module, in Vietnamese (the business's language) and English.

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
};

export const TEXT: Record<Lang, Text> = { vi, en };
export type { Text };
