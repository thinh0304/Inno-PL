// Field formats and their normalisation: Đặc tả 4.8. An empty value is never a format error;
// whether it is required is validate.ts's call.

export type FormatKind = 'phone' | 'email' | 'date' | 'tax_code' | 'bank_account' | 'customer_code' | 'contract_no' | 'sku'
  | 'person_name' | 'text' | 'unit' | 'money' | 'signed_money' | 'quantity' | 'months' | 'percent' | 'debt_days' | 'days'
  | 'payment_count' | 'count';

// value is what is stored: normalised text, an ISO date (yyyy-mm-dd), a number, or a fraction for a percentage.
export interface FormatResult { ok: boolean; value: string | number | null; message?: string }

// Vietnamese numbers: "." groups thousands, "," is the decimal mark. A lone "." with other than three digits after it
// ("1.5") is read as a decimal point.
export function parseNumberVi(raw: string): number | null {
  let s = raw.trim().replace(/\s+/g, '');
  if (s === '') return null;
  if (s.includes(',')) {
    if ((s.match(/,/g) ?? []).length > 1) return null;
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

const collapse = (raw: string) => raw.trim().replace(/\s+/g, ' ');
const pass = (value: string | number): FormatResult => ({ ok: true, value });
const fail = (message: string): FormatResult => ({ ok: false, value: null, message });

function integerIn(raw: string, min: number, max: number, message: string): FormatResult {
  const n = parseNumberVi(raw);
  return n !== null && Number.isInteger(n) && n >= min && n <= max ? pass(n) : fail(message);
}

function phone(raw: string): FormatResult {
  let digits = raw.trim().replace(/[\s.\-()]/g, '');
  if (digits.startsWith('+84')) digits = `0${digits.slice(3)}`;
  if (/^0[35789]\d{8}$/.test(digits)) return pass(`${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`);
  if (/^02\d{9}$/.test(digits)) return pass(`${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`);
  return fail('Di động 10 số bắt đầu 03/05/07/08/09, hoặc cố định 11 số bắt đầu 02');
}

function date(raw: string): FormatResult {
  const s = raw.trim();
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  let [year, month, day] = match ? [match[1], match[2], match[3]] : ['', '', ''];
  if (!match) {
    match = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(s) ?? /^(\d{2})(\d{2})(\d{4})$/.exec(s);
    if (match) [day, month, year] = [match[1], match[2], match[3]];
  }
  const y = Number(year); const m = Number(month); const d = Number(day);
  const real = match && y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
  return real ? pass(`${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    : fail('Ngày dạng dd/mm/yyyy, ngày có thật, năm 2000–2100');
}

export function checkFormat(kind: FormatKind, raw: string): FormatResult {
  if (raw.trim() === '') return { ok: true, value: null };
  switch (kind) {
    case 'phone': return phone(raw);
    case 'email': {
      const s = raw.replace(/\s+/g, '').toLowerCase();
      return /^[^@]+@[^@]+\.[^@.]{2,}$/.test(s) ? pass(s) : fail('Email dạng ten@miền.đuôi');
    }
    case 'date': return date(raw);
    case 'tax_code': {
      const s = raw.replace(/\s+/g, '');
      return /^\d{10}(-\d{3})?$/.test(s) ? pass(s) : fail('MST 10 số, hoặc 10 số-3 số (chi nhánh)');
    }
    case 'bank_account': {
      const s = raw.replace(/[\s.\-]/g, '');
      return /^\d{6,19}$/.test(s) ? pass(s) : fail('Số tài khoản 6–19 chữ số');
    }
    case 'customer_code': {
      const s = raw.replace(/\s+/g, '').toUpperCase();
      return /^[A-Z0-9_-]{2,20}$/.test(s) ? pass(s) : fail('Mã KH 2–20 ký tự in hoa không dấu, số, - _');
    }
    case 'contract_no': {
      const s = raw.trim();
      return /^[\p{L}\d/\-._]{2,40}$/u.test(s) ? pass(s) : fail('Số HĐ / PO 2–40 ký tự: chữ, số, / - . _');
    }
    case 'sku': {
      const s = raw.trim();
      return /^[A-Za-z0-9\-_./+]{1,40}$/.test(s) ? pass(s) : fail('SKU 1–40 ký tự: chữ không dấu, số, - _ . / +');
    }
    case 'person_name': {
      const s = collapse(raw);
      return s.length >= 2 && s.length <= 80 && /\p{L}/u.test(s) && !/[\d@]/.test(s) ? pass(s)
        : fail('Họ tên 2–80 ký tự, có chữ, không chứa số hoặc @');
    }
    case 'text': {
      const s = collapse(raw);
      return s.length >= 2 && s.length <= 300 && /\p{L}/u.test(s) ? pass(s) : fail('2–300 ký tự, phải có chữ');
    }
    case 'unit': {
      const s = collapse(raw);
      return s.length <= 20 && /\p{L}/u.test(s) ? pass(s) : fail('ĐVT 1–20 ký tự, có chữ');
    }
    // VND has no decimals: a comma in a money field is a thousands separator pasted from elsewhere ("21,000"), so refuse it.
    case 'money': {
      const n = raw.includes(',') ? null : parseNumberVi(raw);
      return n !== null && n >= 0 && Number.isInteger(n) ? pass(n) : fail('Số tiền ≥ 0, dấu chấm phân cách nghìn');
    }
    case 'signed_money': {
      const n = raw.includes(',') ? null : parseNumberVi(raw);
      return n !== null && Number.isInteger(n) ? pass(n) : fail('Số tiền, có thể âm, dấu chấm phân cách nghìn');
    }
    case 'quantity': {
      const n = parseNumberVi(raw);
      return n !== null && Number.isInteger(n) && n > 0 ? pass(n) : fail('Số lượng là số nguyên > 0');
    }
    case 'months': return integerIn(raw, 0, 120, 'Số tháng là số nguyên 0–120');
    case 'percent': {
      const n = parseNumberVi(raw);
      return n !== null && n >= 0 && n <= 100 ? pass(n / 100) : fail('Tỷ lệ 0–100, số lẻ dùng dấu phẩy');
    }
    case 'debt_days': return integerIn(raw.replace(/\s*ngày\s*$/i, ''), 0, 365, 'Công nợ là số nguyên 0–365 ngày');
    case 'days': return integerIn(raw, 0, 365, 'Số ngày là số nguyên 0–365');
    case 'payment_count': return integerIn(raw, 1, 12, 'Số lần thanh toán là số nguyên 1–12');
    case 'count': return integerIn(raw, 0, Number.MAX_SAFE_INTEGER, 'Số nguyên ≥ 0');
  }
}
