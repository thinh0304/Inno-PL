import { describe, expect, it } from 'vitest';
import { checkFormat, parseNumberVi, type FormatKind } from '../../src/order/formats';

const ok = (kind: FormatKind, raw: string, value: string | number) =>
  expect(checkFormat(kind, raw), `${kind} "${raw}"`).toEqual({ ok: true, value });
const bad = (kind: FormatKind, raw: string) => {
  const result = checkFormat(kind, raw);
  expect(result.ok, `${kind} "${raw}"`).toBe(false);
  expect(result.message).toBeTruthy();
};

describe('parseNumberVi', () => {
  it('reads Vietnamese numbers', () => {
    expect(parseNumberVi('15.000.000')).toBe(15_000_000);
    expect(parseNumberVi('0,5')).toBe(0.5);
    expect(parseNumberVi('-2.500.000')).toBe(-2_500_000);
    expect(parseNumberVi('1.5')).toBe(1.5);
    expect(parseNumberVi('1.234.567,89')).toBe(1_234_567.89);
    expect(parseNumberVi(' 17 ')).toBe(17);
    expect(parseNumberVi('abc')).toBeNull();
    expect(parseNumberVi('1,2,3')).toBeNull();
  });
});

describe('checkFormat (Đặc tả 4.8)', () => {
  it('parse_phone', () => {
    ok('phone', '0909.123.456', '0909 123 456');
    ok('phone', '+84 909 123 456', '0909 123 456');
    ok('phone', '028 3800 0000', '028 3800 0000');
    bad('phone', '0123');
    bad('phone', '0123456789');
  });
  it('parse_email', () => {
    ok('email', ' CNTT@Barria.gov.vn ', 'cntt@barria.gov.vn');
    bad('email', 'a@b.c');
    bad('email', 'no-at.vn');
  });
  it('parse_date', () => {
    for (const raw of ['05/11/2026', '5-11-2026', '5.11.2026', '2026-11-05', '05112026']) ok('date', raw, '2026-11-05');
    bad('date', '31/02/2026');
    bad('date', '01/01/1999');
  });
  it('parse_tax_code', () => {
    ok('tax_code', '0312 345 678', '0312345678');
    ok('tax_code', '0312345678-001', '0312345678-001');
    bad('tax_code', '031234567');
  });
  it('parse_bank_account', () => {
    ok('bank_account', '0071.000-123 456', '0071000123456');
    bad('bank_account', '12345');
  });
  it('parse_customer_code', () => {
    ok('customer_code', 'sogt vtld', 'SOGTVTLD');
    bad('customer_code', 'Á');
    bad('customer_code', 'A');
  });
  it('parse_contract_no', () => {
    ok('contract_no', '018/2026/HĐ-KLM', '018/2026/HĐ-KLM');
    bad('contract_no', 'X');
  });
  it('parse_sku', () => {
    ok('sku', 'HIK-1', 'HIK-1');
    bad('sku', 'mã có dấu');
  });
  it('parse_person_name', () => {
    ok('person_name', '  Chị  Hạnh (Phòng CNTT) ', 'Chị Hạnh (Phòng CNTT)');
    bad('person_name', 'An1');
    bad('person_name', 'a@b');
  });
  it('parse_text_and_unit', () => {
    ok('text', ' Máy chủ  Dell PowerEdge R750 ', 'Máy chủ Dell PowerEdge R750');
    bad('text', '12');
    ok('unit', 'Cái', 'Cái');
    bad('unit', '123');
  });
  it('parse_money', () => {
    ok('money', '15.000.000', 15_000_000);
    bad('money', '-1');
    ok('signed_money', '-2.500.000', -2_500_000);
  });
  it('parse_counts', () => {
    ok('quantity', '17', 17);
    bad('quantity', '0');
    bad('quantity', '1,5');
    ok('months', '12', 12);
    bad('months', '121');
    ok('days', '5', 5);
    bad('days', '366');
    ok('payment_count', '2', 2);
    bad('payment_count', '13');
    ok('count', '0', 0);
    bad('count', '-1');
  });
  it('parse_percent', () => {
    ok('percent', '30', 0.3);
    ok('percent', '0,5', 0.005);
    bad('percent', '101');
  });
  it('parse_debt_days', () => {
    ok('debt_days', '45 ngày', 45);
    ok('debt_days', '45', 45);
    bad('debt_days', '366');
  });
  it('empty_is_not_an_error', () => {
    const kinds: FormatKind[] = ['phone', 'email', 'date', 'tax_code', 'bank_account', 'customer_code', 'contract_no', 'sku',
      'person_name', 'text', 'unit', 'money', 'signed_money', 'quantity', 'months', 'percent', 'debt_days', 'days',
      'payment_count', 'count'];
    for (const kind of kinds) expect(checkFormat(kind, '  ')).toEqual({ ok: true, value: null });
  });
});
