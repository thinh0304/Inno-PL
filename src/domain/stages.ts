// Chia chỉ tiêu theo giai đoạn deal (spec §5.1): 4 bộ hệ số của Excel, người phụ trách mỗi giai đoạn, người được chia.
import { STAGE_CODES, type SourceKind, type StageCode, type StageForm } from './form.js';
import type { ContractKind } from './lines.js';

export type StageSet = 'new_tm' | 'new_dv' | 'tmdk' | 'dv_renew';

/** `lead` là phần thêm cho người mang KH mới về (cấu hình được ở Phase 6); 6 giai đoạn còn lại cộng 1 (đơn mới) hoặc 0,5 (tái ký). */
export const STAGE_SETS: Record<StageSet, { lead: number } & Record<StageCode, number>> = {
  new_tm: { lead: 0.3, co_hoi: 0.2, lam_ro: 0.3, bao_gia: 0.1, dam_phan: 0.1, chot: 0.2, hd_tt_cskh: 0.1 },
  new_dv: { lead: 0.3, co_hoi: 0.2, lam_ro: 0.3, bao_gia: 0.05, dam_phan: 0.1, chot: 0.2, hd_tt_cskh: 0.15 },
  tmdk: { lead: 0, co_hoi: 0, lam_ro: 0, bao_gia: 0.1, dam_phan: 0.1, chot: 0.2, hd_tt_cskh: 0.1 },
  dv_renew: { lead: 0, co_hoi: 0, lam_ro: 0, bao_gia: 0.05, dam_phan: 0.1, chot: 0.2, hd_tt_cskh: 0.15 },
};

const TOLERANCE = 1e-6;

export const stagesTotal = (set: StageSet): number => STAGE_CODES.reduce((t, c) => t + STAGE_SETS[set][c], 0);

/** Bộ hệ số theo loại HĐ và đơn mới / tái ký (Excel `Define!H80`): dịch vụ dùng bộ DV, mọi loại khác dùng bộ TM. */
export function stageSetFor(kind: ContractKind, donMoi: boolean): StageSet {
  const service = kind === 'Dịch vụ Loại I' || kind === 'Dịch vụ Loại II';
  if (service) return donMoi ? 'new_dv' : 'dv_renew';
  return donMoi ? 'new_tm' : 'tmdk';
}

/** AM phụ trách 5 giai đoạn đầu, Inside Sale giai đoạn cuối (AM nếu chưa có IS). */
export function defaultStages(set: StageSet, am: string, is: string): StageForm[] {
  return STAGE_CODES.map((ma, i) => ({ ma, nv: i === STAGE_CODES.length - 1 ? is || am : am, pct: STAGE_SETS[set][ma] }));
}

/** null khi hợp lệ: mỗi giai đoạn có người phụ trách và tổng bằng tổng của bộ (sai số thực được bỏ qua). */
export function stagesIssue(stages: StageForm[], set: StageSet): string | null {
  if (stages.some((s) => !s.nv.trim())) return 'stages.owner';
  const total = stages.reduce((t, s) => t + s.pct, 0);
  return Math.abs(total - stagesTotal(set)) > TOLERANCE ? 'stages.total' : null;
}

/** Người được chia chỉ tiêu, và vì thế được đọc đơn (spec §5.1): người phụ trách các giai đoạn và người mang KH về. */
export function recipientsOf(stages: StageForm[], source: { kind: SourceKind; nguoi: string }): string[] {
  const out: string[] = [];
  for (const s of stages) if (s.nv.trim() && !out.includes(s.nv)) out.push(s.nv);
  if (source.kind === 'nguoi' && source.nguoi.trim() && !out.includes(source.nguoi)) out.push(source.nguoi);
  return out;
}
