import { CasesError } from './cases-api.js';

export type Lang = 'en' | 'vi';

export const langOf = (locale: string): Lang => (locale.toLowerCase().startsWith('vi') ? 'vi' : 'en');

const en = {
  heading: 'Cases',
  count: (n: number, locale: string) => (n === 1 ? '1 case' : `${new Intl.NumberFormat(locale).format(n)} cases`),
  newCase: 'New case',
  loading: 'Loading cases',
  emptyTitle: 'No cases yet',
  emptyBody: 'Open a case and it shows up here.',
  loadFailed: "Couldn't load the cases.",
  notInstalled: 'The pl package is not installed in this organization.',
  offline: "Couldn't reach AgentFlow. Check your connection.",
  retry: 'Try again',
  retryHint: "AgentFlow didn't say why. Try again in a moment.",
  colTitle: 'Title',
  colStatus: 'Status',
  colOpened: 'Opened on',
  caption: 'Cases, newest first',
  urgent: 'Urgent',
  today: 'Today',
  status: { open: 'Open', approved: 'Approved', rejected: 'Rejected' },
  title: 'Title',
  titlePlaceholder: 'What is the case about?',
  titleMissing: 'Enter a title',
  urgentLabel: 'Urgent',
  urgentHelp: 'Marked in the list so it is seen first.',
  openedOn: 'Opened on',
  cancel: 'Cancel',
  create: 'Create case',
  creating: 'Creating…',
  createFailed: "Couldn't create the case.",
  created: 'Case created',
};

type Text = typeof en;

const vi: Text = {
  heading: 'Hồ sơ',
  count: (n: number, locale: string) => `${new Intl.NumberFormat(locale).format(n)} hồ sơ`,
  newCase: 'Hồ sơ mới',
  loading: 'Đang tải hồ sơ',
  emptyTitle: 'Chưa có hồ sơ nào',
  emptyBody: 'Mở một hồ sơ, nó sẽ hiện ở đây.',
  loadFailed: 'Không tải được danh sách hồ sơ.',
  notInstalled: 'Gói Pl chưa được cài đặt trong tổ chức này.',
  offline: 'Không kết nối được AgentFlow. Hãy kiểm tra kết nối mạng.',
  retry: 'Thử lại',
  retryHint: 'AgentFlow không cho biết lý do. Hãy thử lại sau giây lát.',
  colTitle: 'Tiêu đề',
  colStatus: 'Trạng thái',
  colOpened: 'Ngày mở',
  caption: 'Hồ sơ, mới nhất trước',
  urgent: 'Khẩn',
  today: 'Hôm nay',
  status: { open: 'Đang mở', approved: 'Đã duyệt', rejected: 'Đã từ chối' },
  title: 'Tiêu đề',
  titlePlaceholder: 'Hồ sơ này về việc gì?',
  titleMissing: 'Hãy nhập tiêu đề',
  urgentLabel: 'Khẩn',
  urgentHelp: 'Được đánh dấu trong danh sách để ai cũng thấy trước.',
  openedOn: 'Ngày mở',
  cancel: 'Huỷ',
  create: 'Tạo hồ sơ',
  creating: 'Đang tạo…',
  createFailed: 'Không tạo được hồ sơ.',
  created: 'Đã tạo hồ sơ',
};

export const TEXT: Record<Lang, Text> = { en, vi };

/** What to tell the person about a failed call: AgentFlow's own reason when it gave one, else `fallback`. */
export function errorText(error: unknown, t: Text, fallback: string): string {
  if (error instanceof CasesError) {
    if (error.code === 'NOT_INSTALLED') return t.notInstalled;
    if (error.code === 'NETWORK') return t.offline;
    if (error.reason) return error.reason;
  }
  return fallback;
}
