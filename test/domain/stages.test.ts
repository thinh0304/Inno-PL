import { describe, expect, it } from 'vitest';
import { defaultStages, recipientsOf, STAGE_SETS, stageSetFor, stagesIssue, stagesTotal } from '../../src/domain/stages';

describe('bảng hệ số giai đoạn (spec §5.1)', () => {
  it('khớp 4 bộ của Excel', () => {
    expect(STAGE_SETS.new_tm).toEqual({ lead: 0.3, co_hoi: 0.2, lam_ro: 0.3, bao_gia: 0.1, dam_phan: 0.1, chot: 0.2, hd_tt_cskh: 0.1 });
    expect(STAGE_SETS.new_dv).toEqual({ lead: 0.3, co_hoi: 0.2, lam_ro: 0.3, bao_gia: 0.05, dam_phan: 0.1, chot: 0.2, hd_tt_cskh: 0.15 });
    expect(STAGE_SETS.tmdk).toEqual({ lead: 0, co_hoi: 0, lam_ro: 0, bao_gia: 0.1, dam_phan: 0.1, chot: 0.2, hd_tt_cskh: 0.1 });
    expect(STAGE_SETS.dv_renew).toEqual({ lead: 0, co_hoi: 0, lam_ro: 0, bao_gia: 0.05, dam_phan: 0.1, chot: 0.2, hd_tt_cskh: 0.15 });
  });

  it('tổng của bộ: đơn mới 1, đơn tái ký 0,5', () => {
    expect(stagesTotal('new_tm')).toBeCloseTo(1, 10);
    expect(stagesTotal('new_dv')).toBeCloseTo(1, 10);
    expect(stagesTotal('tmdk')).toBeCloseTo(0.5, 10);
    expect(stagesTotal('dv_renew')).toBeCloseTo(0.5, 10);
  });
});

describe('stageSetFor', () => {
  it('dịch vụ dùng bộ DV, mọi loại khác (kể cả Fulfillment) dùng bộ TM; tái ký đổi sang bộ tái ký', () => {
    expect(stageSetFor('Thương Mại', true)).toBe('new_tm');
    expect(stageSetFor('License/Runrate', false)).toBe('tmdk');
    expect(stageSetFor('Dịch vụ Loại I', true)).toBe('new_dv');
    expect(stageSetFor('Dịch vụ Loại II', false)).toBe('dv_renew');
    expect(stageSetFor('Fulfillment', false)).toBe('tmdk');
  });
});

describe('defaultStages và stagesIssue', () => {
  it('AM phụ trách 5 giai đoạn đầu, IS giai đoạn cuối; hệ số lấy từ bộ', () => {
    const s = defaultStages('new_dv', 'u-am', 'u-is');
    expect(s.map((x) => x.nv)).toEqual(['u-am', 'u-am', 'u-am', 'u-am', 'u-am', 'u-is']);
    expect(s.map((x) => x.pct)).toEqual([0.2, 0.3, 0.05, 0.1, 0.2, 0.15]);
    expect(stagesIssue(s, 'new_dv')).toBeNull();
  });

  it('Review Focus #4: sai số thực không bị báo lỗi, tổng lệch 1% thì bị báo', () => {
    const s = defaultStages('new_tm', 'a', 'b').map((x, i) => ({ ...x, pct: [0.1 + 0.1, 0.1 + 0.2, 0.1, 0.1, 0.2, 0.1][i]! }));
    expect(stagesIssue(s, 'new_tm')).toBeNull();
    expect(stagesIssue(s.map((x, i) => (i === 0 ? { ...x, pct: x.pct + 0.01 } : x)), 'new_tm')).toBe('stages.total');
  });

  it('thiếu người phụ trách một giai đoạn bị báo', () => {
    const s = defaultStages('new_tm', 'a', 'b').map((x, i) => (i === 2 ? { ...x, nv: '' } : x));
    expect(stagesIssue(s, 'new_tm')).toBe('stages.owner');
  });
});

describe('recipientsOf (người được chia, được đọc đơn)', () => {
  const stages = defaultStages('new_tm', 'u-am', 'u-is');
  it('người phụ trách các giai đoạn, không trùng', () => {
    expect(recipientsOf(stages, { kind: 'khong', nguoi: '' })).toEqual(['u-am', 'u-is']);
  });
  it('nguồn KH là một người thì thêm người đó', () => {
    expect(recipientsOf(stages, { kind: 'nguoi', nguoi: 'u-sale2' })).toEqual(['u-am', 'u-is', 'u-sale2']);
  });
  it('Review Focus #5: Team Marketing / Other không thêm ai', () => {
    expect(recipientsOf(stages, { kind: 'marketing', nguoi: '' })).toEqual(['u-am', 'u-is']);
    expect(recipientsOf(stages, { kind: 'other', nguoi: '' })).toEqual(['u-am', 'u-is']);
  });
});
