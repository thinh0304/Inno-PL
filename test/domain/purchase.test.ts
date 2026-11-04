import { describe, expect, it } from 'vitest';
import { checkProposals } from '../../src/domain/purchase';
import { validLine } from './fixtures/order-form';

const tb = validLine({ gia_mua: 40_000_000 });
const dv = validLine({ loai: 'dvtk_i', sku: '', co_cq: '', gia_mua: 0 });
const L = [{ ...tb, id: 'a' }, { ...dv, id: 'b' }];

describe('checkProposals', () => {
  it('mọi dòng TB/License phải có đề xuất; dịch vụ không cần', () => {
    expect(checkProposals(L, [])).toEqual([{ field: 'dong_1.gia_mua_de_xuat', code: 'required' }]);
    expect(checkProposals(L, [{ dong_hang: 'a', gia_mua_de_xuat: 38_000_000, ncc_id: 'n1', ly_do: '' }])).toEqual([]);
  });
  it('thiếu NCC bị báo; giá cao hơn giá Sale cần lý do', () => {
    expect(checkProposals(L, [{ dong_hang: 'a', gia_mua_de_xuat: 38_000_000, ncc_id: '', ly_do: '' }])).toEqual([{ field: 'dong_1.ncc_id', code: 'required' }]);
    expect(checkProposals(L, [{ dong_hang: 'a', gia_mua_de_xuat: 45_000_000, ncc_id: 'n1', ly_do: '' }])).toEqual([{ field: 'dong_1.ly_do', code: 'required' }]);
    expect(checkProposals(L, [{ dong_hang: 'a', gia_mua_de_xuat: 45_000_000, ncc_id: 'n1', ly_do: 'NCC tăng giá' }])).toEqual([]);
  });
});
