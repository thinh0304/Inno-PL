import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { emptyLine, emptyOrder } from '../../src/domain/form';
import { financePayload, linePayload, orderPayload } from '../../src/domain/records';

const keys = (entity: string): string[] =>
  (JSON.parse(readFileSync(new URL(`../../config/entities/${entity}.json`, import.meta.url), 'utf8')) as { fields: { key: string }[] }).fields.map((f) => f.key);

// Khóa nào payload ghi mà entity không có thì AgentFlow bỏ qua không báo lỗi (create form lọc): test này giữ hai bên khớp nhau.
describe('payload khớp trường của entity', () => {
  it('don_hang', () => expect(Object.keys(orderPayload(emptyOrder('a'))).filter((k) => !keys('don_hang').includes(k))).toEqual([]));
  it('tai_chinh_don', () => expect(Object.keys(financePayload(emptyOrder('a'))).filter((k) => !keys('tai_chinh_don').includes(k))).toEqual([]));
  it('dong_hang', () => expect(Object.keys(linePayload('d', emptyLine(), 1)).filter((k) => !keys('dong_hang').includes(k))).toEqual([]));
});
