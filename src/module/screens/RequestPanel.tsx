import { useState } from 'react';
import type { TaskRow } from '../api.js';
import { TEXT, type Lang } from '../text.js';

/** Yêu cầu của IS / AM đối với một đơn đã gửi: Close-lost (tới hết t41) và Xin duyệt lại (đơn đã phê duyệt). Cần lý do; máy chủ kiểm lại. */
export function RequestPanel({ lang, busy, status, tasks, onRequest }: {
  lang: Lang; busy: boolean; status: string; tasks: TaskRow[]; onRequest(kind: 'close_lost' | 'xin_duyet_lai', reason: string): void;
}) {
  const t = TEXT[lang];
  const [reason, setReason] = useState('');
  const t41Done = tasks.some((x) => x.ma === 't41' && x.trang_thai === 'xong');
  const canClose = ['dang_xu_ly', 'da_phe_duyet', 'tra_lai'].includes(status) && !t41Done;
  const canReapprove = status === 'da_phe_duyet';
  if (!canClose && !canReapprove) return null;
  const text = reason.trim();
  return (
    <section className="panel" aria-label={t.sCloseRequests}>
      <h2>{t.sCloseRequests}</h2>
      <label className="field">
        <span>{t.requestReason}</span>
        <textarea aria-label={t.requestReason} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <div className="row">
        {canReapprove ? <button type="button" className="btn" disabled={busy || !text} onClick={() => onRequest('xin_duyet_lai', text)}>{t.askReapproval}</button> : null}
        {canClose ? <button type="button" className="btn" disabled={busy || !text} onClick={() => onRequest('close_lost', text)}>{t.closeLost}</button> : null}
      </div>
    </section>
  );
}
