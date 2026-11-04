// Every text of the module, in Vietnamese (the business's language) and English.
export type Lang = 'en' | 'vi';

export const langOf = (locale: string): Lang => (locale.toLowerCase().startsWith('vi') ? 'vi' : 'en');

const vi = {
  appName: 'Hiệu quả đơn hàng',
  rebuilding: 'Ứng dụng đang được xây dựng lại.',
};

const en: typeof vi = {
  appName: 'Order performance',
  rebuilding: 'The app is being rebuilt.',
};

export const TEXT: Record<Lang, typeof vi> = { vi, en };
