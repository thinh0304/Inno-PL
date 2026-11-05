import { useEffect, useState } from 'react';
import type { Api, OrderRow } from '../api.js';
import { formatMoney } from '../format.js';
import { TEXT, type Lang, type TextKey } from '../text.js';

export function DanhSachDon({ api, lang, onOpen, onNew, onMyTasks }: {
  api: Api; lang: Lang; onOpen(id: string): void; onNew(): void; onMyTasks(): void;
}) {
  const t = TEXT[lang];
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [waiting, setWaiting] = useState(0);
  useEffect(() => { api.listOrders().then(setRows, () => setFailed(true)); }, [api]);
  // Huy hiệu số task đang chờ người xem (spec §7.6).
  useEffect(() => { api.myTasks().then((ts) => setWaiting(ts.length), () => undefined); }, [api]);

  return (
    <main className="screen">
      <header className="bar">
        <h1>{t.orders}</h1>
        <div className="row">
          <button type="button" className="btn" onClick={onMyTasks}>{t.myTasks}{waiting ? <span className="badge" aria-label={`${waiting}`}>{waiting}</span> : null}</button>
          <button type="button" className="btn primary" onClick={onNew}>{t.newOrder}</button>
        </div>
      </header>
      {failed ? <p className="error" role="alert">{t.loadFailed}</p> : null}
      {rows && !rows.length ? <p className="faint">{t.noOrders}</p> : null}
      {rows?.length ? (
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>{t.code}</th><th>{t.customer}</th><th>{t.am}</th><th>{t.status}</th><th>{t.stage}</th><th className="num">{t.revenue}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><button type="button" className="link" onClick={() => onOpen(r.id)}>{r.ma_don}</button></td>
                  <td>{r.ten_kh}</td><td>{r.am}</td>
                  <td>{TEXT[lang][`status.${r.trang_thai}` as TextKey] ?? r.trang_thai}</td>
                  <td>{r.giai_doan}</td>
                  <td className="num">{formatMoney(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
