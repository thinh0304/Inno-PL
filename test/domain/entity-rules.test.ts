import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Leaf = { kind: string; write?: { op: string; field?: string; fields?: string[] } };
type Entity = { fields: { key: string }[]; rules: { key: string; condition: { leaves: Leaf[] } }[] };
const entity = (k: string) => JSON.parse(readFileSync(new URL(`../../config/entities/${k}.json`, import.meta.url), 'utf8')) as Entity;

// Rule "khóa khi đã gửi": mọi trường người lập sửa được phải nằm trong danh sách trường bị khóa, kẻo thêm trường mới là hở quyền (review cuối Phase 2).
describe('tai_chinh_don: khóa mọi trường người lập nhập sau khi đơn đã gửi', () => {
  it('rule khoa_khi_da_gui liệt kê mọi trường không do hệ thống ghi', () => {
    const e = entity('tai_chinh_don');
    const system = ['don_hang', 'pl_chot', 'cau_hinh_chot', 'ln_thuan_chot', 'dat_chot', 'chot_luc'];
    const editable = e.fields.map((f) => f.key).filter((k) => !system.includes(k));
    const rule = e.rules.find((r) => r.key === 'khoa_khi_da_gui')!;
    const locked = rule.condition.leaves.flatMap((l) => (l.write?.op === 'changed_any' ? l.write.fields ?? [] : l.write?.op === 'changed' ? [l.write.field!] : []));
    expect(editable.filter((k) => !locked.includes(k))).toEqual([]);
  });
});
