import { useState } from 'react';
import { TEXT, type Lang, type TextKey } from '../text.js';

export type ActionKind = 'submit' | 'approve' | 'do';
export interface TaskActionsProps {
  kind: ActionKind;
  lang: Lang;
  busy: boolean;
  /** `xong` hoặc `tra_lai`, kèm lý do (rỗng khi không có). */
  onAct(status: 'xong' | 'tra_lai', reason: string): void;
}

/** Nút thao tác của một task theo loại (spec §7.2): Gửi duyệt (t11), Duyệt / Trả lại (t22, t31), Hoàn thành (t23). Trả lại cần lý do. */
export function TaskActions({ kind, lang, busy, onAct }: TaskActionsProps) {
  const t = TEXT[lang];
  const [reason, setReason] = useState('');
  const main = kind === 'submit' ? t.submit : kind === 'approve' ? t.approve : t.complete;
  return (
    <div className="actions">
      {kind === 'approve' ? (
        <label className="field">
          <span>{t.reason}</span>
          <textarea aria-label={t.reason} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
      ) : null}
      <div className="row">
        <button type="button" className="btn primary" disabled={busy} onClick={() => onAct('xong', '')}>{main}</button>
        {kind === 'approve' ? (
          <button type="button" className="btn" disabled={busy || !reason.trim()} onClick={() => onAct('tra_lai', reason.trim())}>{t.returnBack}</button>
        ) : null}
      </div>
    </div>
  );
}

export interface MyTask { id: string; ma: string; orderId: string; orderCode: string; kind: ActionKind }

export function TaskList({ tasks, lang, busy, onAct, onOpen }: {
  tasks: MyTask[]; lang: Lang; busy: boolean; onAct(task: MyTask, status: 'xong' | 'tra_lai', reason: string): void; onOpen(orderId: string): void;
}) {
  const t = TEXT[lang];
  if (!tasks.length) return <p className="faint">{t.noTasks}</p>;
  return (
    <ul className="tasks">
      {tasks.map((task) => (
        <li key={task.id} className="task">
          <div className="row">
            <b>{t[`task.${task.ma}` as TextKey] ?? task.ma}</b>
            <button type="button" className="link" onClick={() => onOpen(task.orderId)}>{task.orderCode}</button>
          </div>
          <TaskActions kind={task.kind} lang={lang} busy={busy} onAct={(status, reason) => onAct(task, status, reason)} />
        </li>
      ))}
    </ul>
  );
}
