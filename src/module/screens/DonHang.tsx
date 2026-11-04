import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_CONFIG } from '../../domain/config.js';
import { detectContractKinds } from '../../domain/lines.js';
import { CODE_OF_CONTRACT_KIND } from '../../domain/codes.js';
import { computePl } from '../../domain/pl.js';
import type { Api, LoadedOrder } from '../api.js';
import { emptyLine, missingFields, onlyMine, toPlInput, type LineDraft, type OrderDraft } from '../model.js';
import { TEXT, type Lang, type TextKey } from '../text.js';
import { LinesTable } from './LinesTable.js';
import { PlPanel } from './PlPanel.js';
import { TaskActions } from './ViecCuaBan.js';

const STAGES = [1, 2, 3, 4, 5, 6, 7];
const ACTION_KIND: Record<string, 'submit' | 'approve' | 'do'> = { t11: 'submit', t22: 'approve', t31: 'approve', t23: 'do' };

export function DonHang({ api, lang, id, onBack, onCreated }: { api: Api; lang: Lang; id: string | null; onBack(): void; onCreated(id: string): void }) {
  const t = TEXT[lang];
  const [loaded, setLoaded] = useState<LoadedOrder | null>(null);
  const [order, setOrder] = useState<OrderDraft>(() => api.emptyOrder());
  const [lines, setLines] = useState<LineDraft[]>(() => [emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const l = await api.loadOrder(id);
      setLoaded(l); setOrder(l.order); setLines(l.lines);
    } catch { setMessage({ kind: 'error', text: t.loadFailed }); }
  }, [api, id, t.loadFailed]);
  useEffect(() => { void load(); }, [load]);

  const editable = !id || (loaded ? ['nhap', 'tra_lai'].includes(loaded.trang_thai) : false);
  const seesMoney = !id || (loaded?.seesMoney ?? false);
  const live = useMemo(() => computePl(toPlInput(order, lines), DEFAULT_CONFIG), [order, lines]);
  const kinds = useMemo(() => detectContractKinds(toPlInput(order, lines).lines), [order, lines]);
  const missing = missingFields(order, lines);
  const set = <K extends keyof OrderDraft>(k: K, v: OrderDraft[K]) => setOrder((o) => ({ ...o, [k]: v }));
  const text = (k: keyof OrderDraft, label: string) => (
    <label className="field"><span>{label}</span>
      <input aria-label={label} value={String(order[k] ?? '')} readOnly={!editable} onChange={(e) => set(k, e.target.value as never)} /></label>
  );
  const number = (k: 'cong_no_ngay' | 'cpbh', label: string) => (
    <label className="field"><span>{label}</span>
      <input className="num" inputMode="decimal" aria-label={label} value={order[k]} readOnly={!editable}
        onChange={(e) => set(k, Number(e.target.value.replace(/[^\d.-]/g, '')) || 0)} /></label>
  );

  const run = async (work: () => Promise<void>) => {
    setBusy(true); setMessage(null);
    try { await work(); } catch { setMessage({ kind: 'error', text: t.actionFailed }); } finally { setBusy(false); }
  };

  const save = () => run(async () => {
    if (!id) { onCreated(await api.createOrder(order, lines)); return; }
    await api.saveOrder(order, lines, loaded?.lines ?? []);
    await load();
    setMessage({ kind: 'ok', text: t.saved });
  });

  const mine = onlyMine((loaded?.tasks ?? []).filter((x) => x.trang_thai === 'dang_lam'), loaded?.workIds ?? new Set<string>());
  const act = (taskId: string, status: 'xong' | 'tra_lai', reason: string) => run(async () => {
    // t11: lưu các thay đổi trước khi gửi duyệt, để số chốt tính trên đúng dữ liệu.
    if (mine.find((x) => x.id === taskId)?.ma === 't11') await api.saveOrder(order, lines, loaded?.lines ?? []);
    await api.actOnTask(taskId, status, reason);
    await load();
  });

  const plResult = loaded?.locked && !editable ? loaded.locked.result : live;
  return (
    <main className="screen">
      <header className="bar">
        <button type="button" className="btn" onClick={onBack}>{t.back}</button>
        <h1>{loaded?.ma_don || t.newOrder}</h1>
        {loaded ? <span className="tag">{t[`status.${loaded.trang_thai}` as TextKey] ?? loaded.trang_thai}</span> : null}
      </header>

      {id && loaded ? (
        <ol className="stages" aria-label={t.stage}>
          {STAGES.map((s) => <li key={s} className={s < loaded.giai_doan ? 'done' : s === loaded.giai_doan ? 'cur' : undefined}>{s} · {t[`stage.${s}` as TextKey]}</li>)}
        </ol>
      ) : null}

      {message ? <p className={message.kind === 'error' ? 'error' : 'ok'} role="status">{message.text}</p> : null}

      {mine.length ? (
        <section className="panel" aria-label={t.myTasks}>
          <h2>{t.myTasks}</h2>
          {mine.map((x) => (
            <div key={x.id} className="task">
              <b>{t[`task.${x.ma}` as TextKey] ?? x.ma}</b>
              <TaskActions kind={ACTION_KIND[x.ma] ?? 'do'} lang={lang} busy={busy || (x.ma === 't11' && missing.length > 0)} onAct={(s, r) => void act(x.id, s, r)} />
              {x.ma === 't11' && missing.length ? <p className="faint">{t.missing}</p> : null}
            </div>
          ))}
        </section>
      ) : null}

      <section className="panel">
        <h2>{t.customerInfo}</h2>
        <div className="grid">
          {text('ten_kh', t.fCustomer)}{text('ma_kh', t.fCustomerCode)}{text('mst', t.fTax)}{text('nguoi_lien_he', t.fContact)}
          {text('noi_dung', t.fContent)}{text('so_hd_noi_bo', t.fInternalNo)}
        </div>
      </section>

      {!seesMoney && loaded ? (
        <section className="panel"><h2>{t.lines}</h2><LinesTable lines={lines} editable={false} showPrices={false} lang={lang} onChange={() => {}} /></section>
      ) : null}

      {seesMoney ? (
        <>
          <section className="panel">
            <h2>{t.survey}</h2>
            <div className="grid">
              {text('am', t.fAm)}{text('is', t.fIs)}
              <label className="field"><span>{t.fTier}</span>
                <select aria-label={t.fTier} value={order.hang_kh} disabled={!editable} onChange={(e) => set('hang_kh', e.target.value as OrderDraft['hang_kh'])}>
                  <option value="vip">{t.tierVip}</option><option value="tiem_nang">{t.tierPotential}</option><option value="pho_thong">{t.tierRegular}</option>
                </select></label>
              {number('cong_no_ngay', t.fCredit)}{number('cpbh', t.fSalesCost)}
              {text('nv_trien_khai', t.fDeploy)}{text('nv_tu_van', t.fConsult)}
              <label className="check"><input type="checkbox" checked={order.tv_proposal} disabled={!editable} onChange={(e) => set('tv_proposal', e.target.checked)} />{t.fProposal}</label>
              <label className="check"><input type="checkbox" checked={order.tv_poc} disabled={!editable} onChange={(e) => set('tv_poc', e.target.checked)} />{t.fPoc}</label>
              <label className="check"><input type="checkbox" checked={order.tu_truoc} disabled={!editable} onChange={(e) => set('tu_truoc', e.target.checked)} />{t.fAdvance}</label>
              <label className="field"><span>{t.fKind}</span>
                <select aria-label={t.fKind} value={order.loai_hd_chon} disabled={!editable} onChange={(e) => set('loai_hd_chon', e.target.value)}>
                  <option value="">{t.fKindAuto}</option>
                  {[...new Set([...kinds.map((k) => CODE_OF_CONTRACT_KIND[k.kind]), 'fulfillment'])].map((c) => <option key={c} value={c}>{t[`kind.${c}` as TextKey]}</option>)}
                </select></label>
            </div>
          </section>
          <section className="panel"><h2>{t.lines}</h2><LinesTable lines={lines} editable={editable} lang={lang} onChange={setLines} /></section>
          <PlPanel result={plResult} lockedAt={loaded?.locked && !editable ? loaded.locked.at : null} lang={lang} />
        </>
      ) : null}

      {editable ? <div className="row"><button type="button" className="btn primary" disabled={busy} onClick={() => void save()}>{busy ? t.saving : t.save}</button></div> : null}
    </main>
  );
}
