// Hạn và trạng thái SLA của task (spec §7.6). Hàm thuần: module hiển thị, Code step ghi cảnh báo "hoàn thành quá hạn".
export type SlaState = 'none' | 'con_han' | 'sap' | 'qua_han';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Thời gian của AgentFlow có thể kèm nano giây và múi giờ (`2026-11-03T18:54:44.945958101+07:00`); `Date.parse` không chắc đọc được. */
export function parseTime(s: string | null | undefined): number | null {
  if (!s) return null;
  const t = Date.parse(s.replace(/(\.\d{3})\d+/, '$1'));
  return Number.isNaN(t) ? null : t;
}

/** Còn hạn → Sắp đến hạn (còn dưới 24 giờ) → Quá hạn. Không có hạn (N = 0) là `none`. */
export function slaState(han: string | null | undefined, now: number): SlaState {
  const h = parseTime(han);
  if (h === null) return 'none';
  if (now > h) return 'qua_han';
  return h - now < DAY ? 'sap' : 'con_han';
}

/** Task xong: đúng hạn hoặc trễ N ngày (làm tròn lên theo ngày lịch). Không có hạn thì coi là đúng hạn. */
export function lateness(han: string | null | undefined, doneAt: number): { onTime: boolean; daysLate: number } {
  const h = parseTime(han);
  if (h === null || doneAt <= h) return { onTime: true, daysLate: 0 };
  return { onTime: false, daysLate: Math.ceil((doneAt - h) / DAY) };
}
