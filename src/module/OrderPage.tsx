import { useEffect, useId, useRef, type ReactElement } from 'react';
import { tabsFor } from './access.js';
import { CustomerCard } from './CustomerCard.js';
import { DeliveryCard } from './DeliveryCard.js';
import { AlertIcon, ChevronIcon } from './icons.js';
import { useToasts, type ThemeMode } from './kit.js';
import type { OrdersApi } from './orders-api.js';
import { routePath, type TabKey } from './routes.js';
import { errorText, TEXT, type Lang } from './text.js';
import { useOrderDraft, type OrderDraftHook } from './useOrderDraft.js';

export interface TabProps { hook: OrderDraftHook; api: OrdersApi; lang: Lang; locale: string; theme: ThemeMode }
export type TabComponent = (props: TabProps) => ReactElement;

interface Props {
  api: OrdersApi;
  id: string | null;
  tab: TabKey | null;
  lang: Lang;
  locale: string;
  theme: ThemeMode;
  navigate(path: string): void;
  /** The tabs' contents (Tasks 6–9); a tab without one shows nothing yet. */
  tabs?: Partial<Record<TabKey, TabComponent>>;
}

/** One order: its head and Save, the customer and delivery blocks, and the tabs this person may see (mockup renderDetail). */
export function OrderPage({ api, id, tab, lang, locale, theme, navigate, tabs = {} }: Props) {
  const t = TEXT[lang];
  const hook = useOrderDraft(api, id);
  const toasts = useToasts({ locale, theme });
  const reasonId = useId();
  const pressed = useRef(false);

  // A saved new order moves to its own address.
  const created = useRef<string | null>(null);
  useEffect(() => {
    if (!id && created.current) navigate(routePath({ name: 'order', id: created.current, tab: null }));
  });

  if (hook.state === 'loading') return <main className="screen"><div className="panel skeleton" aria-busy="true" aria-label={t.loading}>
    {[0, 1, 2].map((i) => <div key={i} className="skeleton-row"><span className="af-skeleton" style={{ width: '50%' }} /></div>)}
  </div></main>;
  if (hook.state === 'failed') return (
    <main className="screen">
      <div className="state" role="alert">
        <span className="state-icon danger"><AlertIcon /></span>
        <h2>{errorText(hook.loadError, t, t.orderLoadFailed)}</h2>
        <p>{t.retryHint}</p>
        <button type="button" className="af-button secondary" onClick={hook.reload}>{t.retry}</button>
      </div>
    </main>
  );

  const { order } = hook.draft;
  const nameOf = (user: string | null) => hook.staff.find((s) => s.user === user)?.name ?? null;
  const visible = tabsFor(hook.access!, hook.editor);
  const current = tab && visible.includes(tab) ? tab : visible[0];
  const Tab = tabs[current];
  const reason = !hook.dirty ? t.noChanges : hook.formatErrors > 0 || !hook.canSave ? t.fixFormats : '';

  const save = async () => {
    if (!hook.canSave || pressed.current) return;
    pressed.current = true;
    try {
      const loaded = await hook.save();
      toasts.show('success', t.saved);
      if (!id) created.current = loaded.draft.order.id ?? null;
    } catch (error) {
      toasts.show('error', errorText(error, t, t.saveFailed));
    } finally {
      pressed.current = false;
    }
  };

  return (
    <main className="screen screen-wide order-page">
      <nav className="crumbs"><button type="button" className="link" onClick={() => navigate('/')}>
        <ChevronIcon open={false} />{t.backToList}</button></nav>
      <header className="head">
        <div className="title-block">
          <h1>{order.customer_name || (id ? t.untitled : t.newOrderHeading)}</h1>
          <div className="meta-tags">
            <span className="code">{order.code || t.draftCode}</span>
            <span className="pill" data-status={order.status}>{t.status[order.status]}</span>
            {nameOf(order.am) && <span className="tag">{t.amTag(nameOf(order.am)!)}</span>}
            {nameOf(order.inside_sales) && <span className="tag">{t.isTag(nameOf(order.inside_sales)!)}</span>}
          </div>
        </div>
        <span className="grow" />
        {hook.editor && (
          <>
            <button type="button" className="af-button primary" aria-disabled={!hook.canSave} aria-busy={hook.saving || undefined}
              aria-describedby={reason ? reasonId : undefined} onClick={save}>{hook.saving ? t.saving : t.save}</button>
            <span id={reasonId} className="sr-only">{reason}</span>
          </>
        )}
      </header>

      <CustomerCard hook={hook} api={api} lang={lang} />
      <DeliveryCard hook={hook} lang={lang} />

      <div className="tabs" role="tablist" aria-label={t.tabsLabel}>
        {visible.map((key) => (
          <button key={key} type="button" role="tab" id={`tab-${key}`} aria-selected={key === current} aria-controls={`panel-${key}`}
            className="tab" onClick={() => id && navigate(routePath({ name: 'order', id, tab: key }))}>{t.tabs[key]}</button>
        ))}
      </div>
      <section role="tabpanel" id={`panel-${current}`} aria-labelledby={`tab-${current}`} className="tab-panel">
        {Tab && <Tab hook={hook} api={api} lang={lang} locale={locale} theme={theme} />}
      </section>
      {toasts.region}
    </main>
  );
}
