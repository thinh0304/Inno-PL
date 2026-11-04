import { useState } from 'react';
import { slaState } from '../../domain/sla.js';
import type { TaskAct } from '../api.js';
import { TEXT, type Lang, type TextKey } from '../text.js';

/** Loại thao tác của task (spec §7.2): Gửi duyệt, Duyệt / Trả lại, Đồng ý trình ký / Yêu cầu sửa, Hoàn thành / Không áp dụng, Hoàn thành. */
export type ActionKind = 'submit' | 'approve' | 'review' | 'optional' | 'do';

const KIND: Record<string, ActionKind> = { t11: 'submit', t22: 'approve', t31: 'approve', t42: 'review', t51: 'optional', t53: 'optional' };
export const taskKind = (ma: string): ActionKind => KIND[ma] ?? 'do';

export interface TaskActionsProps {
  kind: ActionKind;
  lang: Lang;
  busy: boolean;
  /** Cảnh báo nghiêm trọng trước nút (ví dụ P&L không đạt): đi tiếp được nhưng bắt buộc ghi lý do. */
  warning?: string;
  /** Kèm lý do (rỗng khi không có). */
  onAct(status: TaskAct, reason: string): void;
}

/** Nút thao tác của một task theo loại. Trả lại và Yêu cầu sửa cần lý do; cảnh báo nghiêm trọng cũng cần lý do để đi tiếp. */
export function TaskActions({ kind, lang, busy, warning, onAct }: TaskActionsProps) {
  const t = TEXT[lang];
  const [reason, setReason] = useState('');
  const needsText = kind === 'approve' || kind === 'review' || !!warning;
  const main = kind === 'submit' ? t.submit : kind === 'approve' ? t.approve : kind === 'review' ? t.agreeSign : t.complete;
  const back = kind === 'approve' ? { status: 'tra_lai' as const, label: t.returnBack } : kind === 'review' ? { status: 'yeu_cau_sua' as const, label: t.requestFix } : null;
  const trimmed = reason.trim();
  return (
    <div className="actions">
      {warning ? <p className="warn" role="alert">{warning}</p> : null}
      {needsText ? (
        <label className="field">
          <span>{t.reason}</span>
          <textarea aria-label={t.reason} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
      ) : null}
      <div className="row">
        <button type="button" className="btn primary" disabled={busy || (!!warning && !trimmed)} onClick={() => onAct('xong', trimmed)}>{main}</button>
        {back ? <button type="button" className="btn" disabled={busy || !trimmed} onClick={() => onAct(back.status, trimmed)}>{back.label}</button> : null}
        {kind === 'optional' ? <button type="button" className="btn" disabled={busy} onClick={() => onAct('khong_ap_dung', '')}>{t.notApplicable}</button> : null}
      </div>
    </div>
  );
}

/** Chip trạng thái hạn (spec §7.6): Còn hạn, Sắp đến hạn, Quá hạn. Không có hạn thì không hiện. */
export function SlaChip({ han, lang }: { han: string | null; lang: Lang }) {
  const state = slaState(han, Date.now());
  if (state === 'none') return null;
  return <span className={`sla sla-${state}`}>{TEXT[lang][`sla.${state}` as TextKey]}</span>;
}

export interface MyTask { id: string; ma: string; orderId: string; orderCode: string; kind: ActionKind; han: string | null }

export function TaskList({ tasks, lang, busy, onAct, onOpen }: {
  tasks: MyTask[]; lang: Lang; busy: boolean; onAct(task: MyTask, status: TaskAct, reason: string): void; onOpen(orderId: string): void;
}) {
  const t = TEXT[lang];
  if (!tasks.length) return <p className="faint">{t.noTasks}</p>;
  return (
    <ul className="tasks">
      {tasks.map((task) => (
        <li key={task.id} className="task">
          <div className="row">
            <b>{t[`task.${task.ma}` as TextKey] ?? task.ma}</b>
            <SlaChip han={task.han} lang={lang} />
            <button type="button" className="link" onClick={() => onOpen(task.orderId)}>{task.orderCode}</button>
          </div>
          {/* Gửi duyệt (t11) phải đi qua màn đơn: ở đó mới kiểm trường bắt buộc và lưu các thay đổi trước. */}
          {task.kind === 'submit' ? null : <TaskActions kind={task.kind} lang={lang} busy={busy} onAct={(status, reason) => onAct(task, status, reason)} />}
        </li>
      ))}
    </ul>
  );
}
