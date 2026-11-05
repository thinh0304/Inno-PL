import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_CONFIG } from '../../domain/config.js';
import { CODE_OF_CONTRACT_KIND } from '../../domain/codes.js';
import type { LineForm, OrderForm } from '../../domain/form.js';
import { detectContractKinds } from '../../domain/lines.js';
import { computePl, contractKindFor } from '../../domain/pl.js';
import { defaultStages, stageSetFor, stagesTotal } from '../../domain/stages.js';
import { normalize, parseNumber, validateOrder, type FormatKind, type Issue } from '../../domain/validate.js';
import type { Api, LoadedOrder, SupplierRec, TaskAct } from '../api.js';
import { TASKS } from '../../domain/flow.js';
import { fillEmpty, quickFill, suggest, suggestCode, type Conflict, type CustomerRec } from '../customerBook.js';
import { emptyLine, onlyMine, plInputFromForm } from '../model.js';
import { TEXT, type Lang, type TextKey } from '../text.js';
import { LinesTable } from './LinesTable.js';
import { PlPanel } from './PlPanel.js';
import { SlaChip, TaskActions, taskKind } from './ViecCuaBan.js';
import { PurchasePanel } from './PurchasePanel.js';
import { RequestPanel } from './RequestPanel.js';

const STAGES = [1, 2, 3, 4, 5, 6, 7];

type StrKey = { [K in keyof Required<OrderForm>]: Required<OrderForm>[K] extends string ? K : never }[keyof Required<OrderForm>];
type NumKey = { [K in keyof Required<OrderForm>]: Required<OrderForm>[K] extends number ? K : never }[keyof Required<OrderForm>];

function errorText(code: string, lang: Lang): string {
  const t = TEXT[lang];
  if (code === 'required') return t.errRequired;
  if (code.startsWith('format.')) return t.errFormat;
  if (code === 'stages.total') return t.errStagesTotal;
  if (code === 'months.mismatch') return t.errMonths;
  if (code === 'renew.source') return t.errRenewSource;
  return t.errRange;
}

/** Một ô nhập: nhãn, viền đỏ (`aria-invalid`) và chữ hướng dẫn dưới ô khi sai; tự chuẩn hóa khi rời ô. */
function Field({ label, value, onChange, kind, error, readOnly, type = 'text' }: {
  label: string; value: string | number; onChange(v: string): void; kind?: FormatKind; error?: string; readOnly: boolean; type?: 'text' | 'number';
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input aria-label={label} aria-invalid={error ? true : undefined} className={type === 'number' ? 'num' : undefined} inputMode={type === 'number' ? 'decimal' : undefined}
        value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} onBlur={kind ? (e) => onChange(normalize(kind, e.target.value)) : undefined} />
      {error ? <small className="err">{error}</small> : null}
    </label>
  );
}

export function DonHang({ api, lang, id, onBack, onCreated }: { api: Api; lang: Lang; id: string | null; onBack(): void; onCreated(id: string): void }) {
  const t = TEXT[lang];
  const [loaded, setLoaded] = useState<LoadedOrder | null>(null);
  const [order, setOrder] = useState<OrderForm>(() => api.emptyOrder());
  const [lines, setLines] = useState<LineForm[]>(() => [emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [showRequired, setShowRequired] = useState(false);
  const [customers, setCustomers] = useState<CustomerRec[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRec[]>([]);
  const [previous, setPrevious] = useState<{ id: string; ma_don: string }[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const l = await api.loadOrder(id);
      setLoaded(l); setOrder(l.order); setLines(l.lines);
    } catch { setMessage({ kind: 'error', text: t.loadFailed }); }
  }, [api, id, t.loadFailed]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void Promise.all([api.customers(), api.suppliers()]).then(([c, s]) => { setCustomers(c); setSuppliers(s); }, () => undefined); }, [api]);
  useEffect(() => { void api.previousOrders(order.ma_kh, id ?? undefined).then(setPrevious, () => setPrevious([])); }, [api, order.ma_kh, id]);

  const editable = !id || (loaded ? ['nhap', 'tra_lai'].includes(loaded.trang_thai) || loaded.choDuyetLai : false);
  const seesMoney = !id || (loaded?.seesMoney ?? false);
  const plIn = useMemo(() => plInputFromForm(order, lines), [order, lines]);
  const live = useMemo(() => computePl(plIn, DEFAULT_CONFIG), [plIn]);
  const kinds = useMemo(() => detectContractKinds(plIn.lines), [plIn]);
  const stageSet = useMemo(() => stageSetFor(contractKindFor(plIn.lines, plIn.chosenKind), order.don_moi), [plIn, order.don_moi]);

  const issues: Issue[] = useMemo(() => validateOrder(order, lines), [order, lines]);
  const errors = useMemo(() => {
    const out: Record<string, string> = {};
    for (const i of issues) if (showRequired || i.code !== 'required') out[i.field] = errorText(i.code, lang);
    return out;
  }, [issues, showRequired, lang]);
  const shown = Object.keys(errors).length;

  const set = <K extends keyof OrderForm>(k: K, v: OrderForm[K]) => setOrder((o) => ({ ...o, [k]: v }));
  // Gợi ý hệ số mặc định chỉ khi người lập chưa đụng tới bảng giai đoạn.
  useEffect(() => {
    if (!editable) return;
    setOrder((o) => (o.giai_doan.every((s) => !s.nv && !s.pct) ? { ...o, giai_doan: defaultStages(stageSet, o.am, o.is) } : o));
  }, [editable, stageSet, order.am, order.is]);

  const text = (k: StrKey, label: string, kind?: FormatKind) => (
    <Field label={label} value={order[k] ?? ""} kind={kind} error={errors[k]} readOnly={!editable} onChange={(v) => { set(k, v as never); if (k === 'ten_kh' || k === 'ma_kh' || k === 'mst') setQuery(v); }} />
  );
  const number = (k: NumKey, label: string) => (
    <Field label={label} type="number" value={order[k]} error={errors[k]} readOnly={!editable} onChange={(v) => set(k, parseNumber(v) as never)} />
  );
  const nullable = (k: 'cpbh_truoc' | 'doanh_thu_truoc' | 'ln_truoc', label: string) => (
    <Field label={label} type="number" value={order[k] ?? ''} error={errors[k]} readOnly={!editable}
      onChange={(v) => set(k, v.trim() === '' ? null : parseNumber(v))} />
  );
  const flag = (k: 'tv_proposal' | 'tv_poc' | 'tu_truoc' | 'don_moi' | 'kh_moi', label: string) => (
    <label className="check"><input type="checkbox" checked={order[k]} disabled={!editable} onChange={(e) => set(k, e.target.checked)} />{label}</label>
  );

  const matches = editable && !order.khach_hang_id ? suggest(customers, query) : [];
  const pickCustomer = (c: CustomerRec) => { const r = fillEmpty(order, c); setOrder(r.order); setConflicts(r.conflicts); setQuery(''); };
  const useBook = (c: Conflict) => { set(c.field, c.fromBook as never); setConflicts((cs) => cs.filter((x) => x.field !== c.field)); };

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

  const plResult = loaded?.locked && !editable ? loaded.locked.result : live;
  const mine = onlyMine((loaded?.tasks ?? []).filter((x) => x.trang_thai === 'dang_lam'), loaded?.workIds ?? new Set<string>());
  const act = (taskId: string, status: TaskAct, reason: string) => run(async () => {
    const isSubmit = mine.find((x) => x.id === taskId)?.ma === 't11';
    if (isSubmit && status === 'xong') {
      if (issues.length) { setShowRequired(true); return; }
      await api.saveOrder(order, lines, loaded?.lines ?? []);
    }
    await api.actOnTask(taskId, status, reason);
    await load();
  });

  const pct = (v: number) => String(Math.round(v * 10000) / 100);
  return (
    <main className="screen">
      <header className="bar">
        <button type="button" className="btn" onClick={onBack}>{t.back}</button>
        <h1>{loaded?.ma_don || t.newOrder}</h1>
        {loaded ? <span className="tag">{t[`status.${loaded.trang_thai}` as TextKey] ?? loaded.trang_thai}</span> : null}
      </header>

      {id && loaded ? (
        <ol className="stages" aria-label={t.stage}>
          {STAGES.map((s) => {
            // Task chạy trước giai đoạn của nó mang nhãn "Song song" (spec §7.1).
            const parallel = loaded.tasks.some((x) => x.trang_thai === 'dang_lam' && TASKS[x.ma as keyof typeof TASKS]?.stage === s && s > loaded.giai_doan);
            return <li key={s} className={s < loaded.giai_doan ? 'done' : s === loaded.giai_doan ? 'cur' : undefined}>{s} · {t[`stage.${s}` as TextKey]}{parallel ? ` (${t.parallel})` : ''}</li>;
          })}
        </ol>
      ) : null}

      {message ? <p className={message.kind === 'error' ? 'error' : 'ok'} role="status">{message.text}</p> : null}
      {loaded?.lyDoGui && loaded.trang_thai === 'tra_lai' ? <p className="error" role="alert">{`${t.returnedReason}: ${loaded.lyDoGui}`}</p> : null}
      {shown ? <p className="error" role="alert">{`${shown} ${t.errBanner}`}</p> : null}

      {mine.length ? (
        <section className="panel" aria-label={t.myTasks}>
          <h2>{t.myTasks}</h2>
          {mine.map((x) => (
            <div key={x.id} className="task">
              <b>{t[`task.${x.ma}` as TextKey] ?? x.ma}</b> <SlaChip han={x.han} lang={lang} />
              <TaskActions kind={taskKind(x.ma)} lang={lang} busy={busy} warning={(x.ma === 't11' || x.ma === 't31') && seesMoney && !plResult.passed ? t.warnPlFail : undefined}
                onAct={(st, r) => void act(x.id, st, r)} />
            </div>
          ))}
        </section>
      ) : null}

      {id && loaded && order.is === api.me ? (
        <RequestPanel lang={lang} busy={busy} status={loaded.trang_thai} tasks={loaded.tasks}
          onRequest={(kind, reason) => void run(async () => { await api.requestOrder(id, kind, reason); setMessage({ kind: 'ok', text: t.requestSent }); })} />
      ) : null}

      {id && loaded?.proposals ? (
        <PurchasePanel lang={lang} busy={busy} lines={lines} proposals={loaded.proposals} suppliers={suppliers}
          editable={loaded.tasks.some((x) => x.ma === 't23' && x.trang_thai === 'dang_lam' && loaded.workIds.has(x.id))}
          onSave={(rows) => void run(async () => { await api.saveProposals(id, rows); await load(); setMessage({ kind: 'ok', text: t.saved }); })} />
      ) : null}

      <section className="panel">
        <h2>{t.customerInfo}</h2>
        <div className="grid">
          {text('ten_kh', t.fCustomer)}
          <div className="field">
            {text('ma_kh', t.fCustomerCode, 'customerCode')}
            {editable && !order.ma_kh && order.ten_kh ? <button type="button" className="link" onClick={() => set('ma_kh', suggestCode(order.ten_kh, customers.map((c) => c.ma_kh)))}>{t.suggestCode}</button> : null}
          </div>
          {text('mst', t.fTax, 'taxId')}{text('nguoi_lien_he', t.fContact, 'personName')}{text('dien_thoai', t.fPhone, 'phone')}{text('email', t.fEmail, 'email')}
          {text('dia_chi', t.fAddress, 'text')}{text('nguoi_dai_dien', t.fRep, 'personName')}{text('chuc_vu', t.fRepRole, 'text')}
          {text('so_tk', t.fAccount, 'account')}{text('ngan_hang', t.fBank, 'text')}
          {text('noi_dung', t.fContent, 'text')}{text('so_hd_noi_bo', t.fInternalNo, 'contractNo')}{text('so_hd_po', t.fPoNo, 'contractNo')}
          {text('ngay_ky', t.fSignDate, 'date')}{text('ngay_bao_gia', t.fQuoteDate, 'date')}{text('hieu_luc_den', t.fValidTo, 'date')}
          {number('ty_gia', t.fRate)}
        </div>
        {matches.length ? (
          <div className="suggest" role="listbox" aria-label={t.suggestions}>
            {matches.map((c) => <button key={c.id} type="button" role="option" aria-selected={false} className="link" onClick={() => pickCustomer(c)}>{`${c.ma_kh} · ${c.ten}`}</button>)}
          </div>
        ) : null}
        {conflicts.length ? (
          <div className="conflicts" role="group" aria-label={t.conflictTitle}>
            <b>{t.conflictTitle}</b>
            {conflicts.map((c) => (
              <div key={c.field} className="row">
                <span>{`${c.current} → ${c.fromBook}`}</span>
                <button type="button" className="btn" onClick={() => useBook(c)}>{t.useBook}</button>
                <button type="button" className="btn" onClick={() => setConflicts((cs) => cs.filter((x) => x.field !== c.field))}>{t.keepMine}</button>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>{t.sDelivery}</h2>
        {editable ? (
          <div className="row">
            <button type="button" className="btn" onClick={() => setOrder((o) => quickFill(o, 'contact'))}>{t.fillContact}</button>
            <button type="button" className="btn" onClick={() => setOrder((o) => quickFill(o, 'address'))}>{t.fillAddress}</button>
          </div>
        ) : null}
        <div className="grid">
          {text('nguoi_nhan', t.fReceiver, 'personName')}{text('sdt_nhan', t.fReceiverPhone, 'phone')}{text('dia_chi_nhan', t.fReceiverAddress, 'text')}
          {text('email_nhan_license', t.fLicenseEmail, 'email')}{text('ghi_chu_giao', t.fDeliveryNote)}
        </div>
      </section>

      {seesMoney ? (
        <>
          <section className="panel">
            <h2>{t.survey}</h2>
            <div className="grid">
              {text('am', t.fAm)}{text('is', t.fIs)}
              <label className="field"><span>{t.fTier}</span>
                <select aria-label={t.fTier} value={order.hang_kh} disabled={!editable} onChange={(e) => set('hang_kh', e.target.value as OrderForm['hang_kh'])}>
                  <option value="vip">{t.tierVip}</option><option value="tiem_nang">{t.tierPotential}</option><option value="pho_thong">{t.tierRegular}</option>
                </select></label>
              {number('cong_no_ngay', t.fCredit)}{number('cpbh', t.fSalesCost)}{number('so_lan_tt', t.fPayments)}
              {text('nv_trien_khai', t.fDeploy)}{text('nv_tu_van', t.fConsult)}
              {flag('tv_proposal', t.fProposal)}{flag('tv_poc', t.fPoc)}{flag('tu_truoc', t.fAdvance)}{flag('don_moi', t.fNewOrder)}{flag('kh_moi', t.fNewLogo)}
              <label className="field"><span>{t.fKind}</span>
                <select aria-label={t.fKind} value={order.loai_hd_chon} disabled={!editable} onChange={(e) => set('loai_hd_chon', e.target.value)}>
                  <option value="">{t.fKindAuto}</option>
                  {[...new Set([...kinds.map((k) => CODE_OF_CONTRACT_KIND[k.kind]), 'fulfillment'])].map((c) => <option key={c} value={c}>{t[`kind.${c}` as TextKey]}</option>)}
                </select></label>
              <label className="field"><span>{t.fSource}</span>
                <select aria-label={t.fSource} value={order.nguon_kh} disabled={!editable} onChange={(e) => set('nguon_kh', e.target.value as OrderForm['nguon_kh'])}>
                  <option value="khong">{t.srcNone}</option><option value="nguoi">{t.srcPerson}</option><option value="marketing">{t.srcMarketing}</option><option value="other">{t.srcOther}</option>
                </select>
                {errors.nguon_kh ? <small className="err">{errors.nguon_kh}</small> : null}</label>
              {order.nguon_kh === 'nguoi' ? text('nguon_kh_nguoi', t.fSourcePerson) : null}
              <label className="field"><span>{t.fForm}</span>
                <select aria-label={t.fForm} value={order.hinh_thuc} disabled={!editable} onChange={(e) => set('hinh_thuc', e.target.value as OrderForm['hinh_thuc'])}>
                  <option value="">{t.pick}</option><option value="hop_dong">{t.formContract}</option><option value="don_hang">{t.formOrder}</option><option value="thau">{t.formTender}</option>
                </select></label>
            </div>
          </section>

          {!order.don_moi ? (
            <section className="panel">
              <h2>{t.sRenew}</h2>
              <div className="grid">
                {text('so_hd_truoc', t.fPrevNo, 'contractNo')}{nullable('cpbh_truoc', t.fPrevCost)}{nullable('doanh_thu_truoc', t.fPrevRevenue)}{nullable('ln_truoc', t.fPrevProfit)}
              </div>
            </section>
          ) : null}

          <section className="panel">
            <h2>{t.sStages}</h2>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>#</th><th>{t.stageOwner}</th><th className="num">{t.stageShare}</th></tr></thead>
                <tbody>
                  {order.giai_doan.map((s, i) => (
                    <tr key={s.ma}>
                      <td>{s.ma}</td>
                      <td><input aria-label={`${t.stageOwner} ${i + 1}`} aria-invalid={errors[`giai_doan.${i}.nv`] ? true : undefined} value={s.nv} readOnly={!editable}
                        onChange={(e) => set('giai_doan', order.giai_doan.map((x, j) => (j === i ? { ...x, nv: e.target.value } : x)))} /></td>
                      <td><input className="num" aria-label={`${t.stageShare} ${i + 1}`} value={pct(s.pct)} readOnly={!editable}
                        onChange={(e) => set('giai_doan', order.giai_doan.map((x, j) => (j === i ? { ...x, pct: (Number(e.target.value.replace(',', '.')) || 0) / 100 } : x)))} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={2}>{t.stageTotal}</td><td className={`num${errors['giai_doan.tong'] ? ' err' : ''}`}>{`${pct(order.giai_doan.reduce((a, s) => a + s.pct, 0))}% / ${pct(stagesTotal(stageSet))}%`}</td></tr></tfoot>
              </table>
            </div>
            {editable ? <button type="button" className="btn" onClick={() => set('giai_doan', defaultStages(stageSet, order.am, order.is))}>{t.applyStageDefaults}</button> : null}
          </section>
        </>
      ) : null}

      <section className="panel">
        <h2>{t.lines}</h2>
        {editable && previous.length ? (
          <label className="field"><span>{t.copyLines}</span>
            <select aria-label={t.copyLines} value="" onChange={(e) => { if (e.target.value) void api.linesOf(e.target.value).then((ls) => setLines(ls)); }}>
              <option value="">{t.pickOrder}</option>
              {previous.map((p) => <option key={p.id} value={p.id}>{p.ma_don}</option>)}
            </select></label>
        ) : null}
        <LinesTable lines={lines} editable={editable} showPrices={seesMoney} suppliers={suppliers} errors={errors} lang={lang} onChange={setLines} />
        {(editable && !lines.length) || errors.dong_hang ? <small className="err">{errors.dong_hang ?? ''}</small> : null}
      </section>

      {seesMoney ? <PlPanel result={plResult} lockedAt={loaded?.locked && !editable ? loaded.locked.at : null} lang={lang} /> : null}

      {!seesMoney && loaded ? (
        <section className="panel">
          <h2>{t.sSummary}</h2>
          {loaded.summaries.length ? loaded.summaries.map((s) => (
            <div key={s.phan}>
              <b>{s.phan === 'dich_vu' ? t.summaryService : t.summaryGoods}</b>
              <table><tbody>{Object.entries(s.data).map(([k, v]) => <tr key={k}><td>{k.replace(/[._]/g, ' ')}</td><td className="num">{v}</td></tr>)}</tbody></table>
            </div>
          )) : <p className="faint">{t.noSummary}</p>}
        </section>
      ) : null}

      {editable ? <div className="row"><button type="button" className="btn primary" disabled={busy} onClick={() => void save()}>{busy ? t.saving : t.save}</button></div> : null}
    </main>
  );
}
