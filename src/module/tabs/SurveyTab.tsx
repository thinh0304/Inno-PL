import { useEffect, useId, useState } from 'react';
import type { DealStage } from '../../pl/types';
import { CheckField, Field, SelectField, YesNoField, type Option } from '../Field.js';
import { formatPercent } from '../format.js';
import type { PreviousOrder } from '../orders-api.js';
import type { TabProps } from '../OrderPage.js';
import { TEXT } from '../text.js';

// The tab's fields, for its banner: everything on the order and its finance but the customer and delivery blocks.
const OUTSIDE = new Set(['customer_name', 'customer_code', 'tax_code', 'address', 'contact_name', 'contact_phone', 'contact_email',
  'representative', 'representative_title', 'bank_account', 'bank_name', 'quote_date', 'quote_valid_until', 'exchange_rate',
  'receiver_name', 'receiver_phone', 'delivery_address', 'delivery_note']);
const STAGES: Exclude<DealStage, 'lead'>[] = ['opportunity', 'clarification', 'quotation', 'negotiation', 'close', 'contract'];

/** Phiếu khảo sát (FR-2.1–2.8, BR-20–23, Thiết kế 13.3, 13.5; mockup renderForm). */
export function SurveyTab({ hook, api, lang }: TabProps) {
  const t = TEXT[lang];
  const s = t.survey;
  const { draft, live, config, staff, me } = hook;
  const { order } = draft;
  const stagesId = useId();
  const [previous, setPrevious] = useState<PreviousOrder[] | null>(null);

  const renewal = !order.is_new_order;
  // A renewal of a known customer may copy last year's figures from an earlier order (BR-22).
  useEffect(() => {
    if (!renewal || !order.customer || !hook.editor) return;
    let live = true;
    api.previousOrders(order.customer, order.id ?? null).then((found) => live && setPrevious(found), () => live && setPrevious([]));
    return () => { live = false; };
  }, [api, renewal, order.customer, order.id, hook.editor]);

  const users = (teams: string[]): Option[] => staff.filter((m) => m.user && teams.includes(m.team) && m.active)
    .map((m) => ({ value: m.user!, label: m.name }));
  const codes = (teams: string[]): Option[] => staff.filter((m) => teams.includes(m.team) && m.active).map((m) => ({ value: m.code, label: m.name }));
  const staffIds: Option[] = staff.filter((m) => m.active).map((m) => ({ value: m.id, label: m.name }));
  const iAmTheAm = order.am === me.id && staff.some((m) => m.user === me.id && m.team === 'sales');

  const setRenewal = (isNew: boolean) => {
    hook.set('order.is_new_order', isNew);
    // BR-23: a renewal's lead source is "Không".
    if (!isNew) hook.set('order.lead_source', null);
  };

  const fillFrom = (id: string | null) => {
    const from = previous?.find((p) => p.id === id);
    if (!from) return;
    hook.setDraft((d) => ({ ...d,
      order: { ...d.order, prev_contract_no: from.code || d.order.prev_contract_no },
      finance: { ...d.finance, prev_sales_cost: from.finance.sales_cost,
        prev_revenue: typeof from.pl?.revenue === 'number' ? from.pl.revenue : d.finance.prev_revenue,
        prev_net_profit: typeof from.pl?.net_profit === 'number' ? from.pl.net_profit : d.finance.prev_net_profit } }));
  };

  const rateName = (code: string) => config.contractTypeRates.find((r) => r.code === code)?.name ?? code;
  const appliedOptions: Option[] = [...live.contractTypes, 'fulfillment' as const].filter((c, i, all) => all.indexOf(c) === i)
    .map((code) => ({ value: code, label: rateName(code) }));
  const weights = config.dealStageWeights[live.weightSet] ?? {};
  const total = STAGES.reduce((sum, stage) => sum + (weights[stage] ?? 0), 0);

  const setStagePerson = (stage: Exclude<DealStage, 'lead'>, person: string | null) => hook.setDraft((d) => {
    const has = d.order.deal_stages.some((x) => x.stage === stage);
    const deal_stages = has ? d.order.deal_stages.map((x) => (x.stage === stage ? { ...x, person } : x))
      : [...d.order.deal_stages, { stage, weight: null, person }];
    return { ...d, order: { ...d.order, deal_stages } };
  });
  const personOf = (stage: string) => order.deal_stages.find((x) => x.stage === stage)?.person ?? null;
  const nameOfCode = (code: string | null) => staff.find((m) => m.code === code)?.name ?? code ?? '—';

  const missing = hook.issues.filter((issue) => issue.message === 'Bắt buộc'
    && ((issue.path.startsWith('order.') && !OUTSIDE.has(issue.path.slice(6))) || issue.path.startsWith('finance.'))).length;

  return (
    <div className="tab-body">
      {hook.editor && missing > 0 && <div className="af-banner warning inset" role="status">{t.surveyMissing(missing)}</div>}

      <section className="card">
        <h2 className="card-title">{t.orderInfo}</h2>
        <div className="grid">
          <YesNoField hook={hook} path="order.is_new_order" label={s.is_new_order} yes={t.yes} no={t.no} onPick={setRenewal} />
          <YesNoField hook={hook} path="order.is_new_logo" label={s.is_new_logo} yes={t.yes} no={t.no} />
          <Field hook={hook} path="order.internal_contract_no" label={s.internal_contract_no} required />
          <Field hook={hook} path="order.customer_po_no" label={s.customer_po_no} />
          <Field hook={hook} path="order.content" label={s.content} required wide />
          <Field hook={hook} path="order.signed_on" label={s.signed_on} />
          <SelectField hook={hook} path="order.am" label={s.am} required options={users(['sales'])} empty={t.pickOne}
            lockedReason={iAmTheAm ? t.amLock : undefined} />
          <SelectField hook={hook} path="order.sa" label={s.sa} options={users(['sa'])} empty={t.none} />
          <SelectField hook={hook} path="order.inside_sales" label={s.inside_sales} options={users(['sa', 'sales'])} empty={t.none} />
        </div>
        {renewal && (
          <div className="grid renewal">
            {hook.editor && (
              // A picker, not a field: picking fills the four figures and is not stored itself.
              <SelectField hook={hook} path="order.__previous" label={s.previous} empty={previous?.length === 0 ? t.noPrevious : t.pickOne}
                options={(previous ?? []).map((p) => ({ value: p.id, label: t.previousOption(p.code) }))} onPick={fillFrom} />
            )}
            <Field hook={hook} path="order.prev_contract_no" label={s.prev_contract_no} required />
            <Field hook={hook} path="finance.prev_sales_cost" label={s.prev_sales_cost} required />
            <Field hook={hook} path="finance.prev_revenue" label={s.prev_revenue} required />
            <Field hook={hook} path="finance.prev_net_profit" label={s.prev_net_profit} required />
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">{s.financial}</h2>
        <div className="grid">
          <SelectField hook={hook} path="order.lead_source" label={s.lead_source} options={codes(['lead_source', 'sales'])} empty={t.none}
            lockedReason={renewal ? t.renewalLock : undefined} />
          <SelectField hook={hook} path="order.customer_tier" label={s.customer_tier} required empty={t.pickOne}
            options={(['vip', 'potential', 'standard'] as const).map((tier) => ({ value: tier, label: t.tierLong[tier] }))} />
          <Field hook={hook} path="order.debt_days" label={s.debt_days} required />
          <Field hook={hook} path="finance.sales_cost" label={s.sales_cost} required />
          <SelectField hook={hook} path="order.deploy_staff" label={s.deploy_staff} options={staffIds} empty={t.none} />
          <SelectField hook={hook} path="order.consult_staff" label={s.consult_staff} options={staffIds} empty={t.none} />
          {order.consult_staff && (
            <fieldset className="field">
              <legend className="label">{s.consult_items}</legend>
              <div className="choices">
                <CheckField hook={hook} path="order.proposal" label={s.proposal} />
                <CheckField hook={hook} path="order.poc" label={s.poc} />
              </div>
            </fieldset>
          )}
          <YesNoField hook={hook} path="order.use_provision_fund" label={s.use_provision_fund} yes={t.yes} no={t.no} />
          <Field hook={hook} path="order.payment_count" label={s.payment_count} />
          <YesNoField hook={hook} path="order.customer_prepays" label={s.customer_prepays} yes={t.yes} no={t.no} />
          <div className="field">
            <span className="label" id={`${stagesId}-types`}>{s.contract_types}</span>
            <ul className="chips" aria-label={s.contract_types}>
              {live.contractTypes.length ? live.contractTypes.map((code) => <li key={code} className="tag" data-tone="info">{rateName(code)}</li>)
                : <li className="hint">—</li>}
            </ul>
          </div>
          <SelectField hook={hook} path="order.contract_type_override" label={s.applied} options={appliedOptions}
            empty={t.autoApplied(live.appliedContractType ? rateName(live.appliedContractType) : '—')} />
        </div>
        {order.use_provision_fund && <p className="hint">{t.fundNote}</p>}
      </section>

      <section className="card">
        <h2 className="card-title" id={stagesId}>{s.stages}</h2>
        <p className="hint">{t.weightsNote}</p>
        <table className="table stages" aria-labelledby={stagesId}>
          <thead><tr><th scope="col">{s.stage}</th><th scope="col">{s.person}</th><th scope="col" className="num">{s.weight}</th></tr></thead>
          <tbody>
            {order.is_new_logo && (weights.lead ?? 0) > 0 && (
              <tr className="lead-row">
                <td>{t.stageNames.lead}</td><td>{nameOfCode(order.lead_source)}</td><td className="num">{formatPercent(weights.lead)}</td>
              </tr>
            )}
            {STAGES.map((stage) => (
              <tr key={stage} data-zero={(weights[stage] ?? 0) === 0 || undefined}>
                <td>{t.stageNames[stage]}</td>
                <td>
                  {hook.editor ? (
                    <select className="input select-input" aria-label={`${s.person} · ${t.stageNames[stage]}`} value={personOf(stage) ?? ''}
                      aria-invalid={hook.issueAt(`order.deal_stages[${order.deal_stages.findIndex((x) => x.stage === stage)}].person`) || hook.issueAt(`order.deal_stages.${stage}`) ? true : undefined}
                      onChange={(e) => setStagePerson(stage, e.target.value || null)}>
                      <option value="">{t.none}</option>
                      {codes(['sales', 'sa']).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : nameOfCode(personOf(stage))}
                </td>
                <td className="num">{formatPercent(weights[stage] ?? 0)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><th scope="row" colSpan={2}>{s.total}</th><td className="num">{formatPercent(total)}</td></tr></tfoot>
        </table>
      </section>
    </div>
  );
}
