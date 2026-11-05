import { describe, expect, it } from 'vitest';
import { renewalOf } from '../../src/domain/renewal';
import { validLine } from './fixtures/order-form';

describe('renewalOf', () => {
  it('thiết bị: ngày giao + số tháng bảo hành dài nhất; không có dòng định kỳ thì không theo dõi tái ký', () => {
    const r = renewalOf([validLine({ so_thang: 12 }), validLine({ so_thang: 24 })], '2026-01-31');
    expect(r).toEqual({ ngay_het_han: '2028-01-31', theo_doi_tai_ky: false });
  });
  it('cuối tháng cộng tháng không tràn sang tháng sau', () => {
    expect(renewalOf([validLine({ so_thang: 1 })], '2027-01-31').ngay_het_han).toBe('2027-02-28');
  });
  it('dòng định kỳ: ngày kết thúc dài nhất, bật cờ theo dõi tái ký', () => {
    const l = (end: string) => validLine({ loai: 'dvdk_i', sku: '', co_cq: '', so_thang: 12, ngay_bat_dau: '01/01/2026', ngay_ket_thuc: end });
    expect(renewalOf([l('31/12/2026'), l('30/06/2027')], null)).toEqual({ ngay_het_han: '2027-06-30', theo_doi_tai_ky: true });
  });
});
