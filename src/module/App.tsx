import type { ThemeMode } from './kit.js';
import type { ScreenHost } from './mount.js';
import { OrderListScreen } from './OrderListScreen.js';
import { OrderPage } from './OrderPage.js';
import type { OrdersApi } from './orders-api.js';
import { parseRoute, routePath, usePath } from './routes.js';
import { LinesTab } from './tabs/LinesTab.js';
import { FlowTab } from './tabs/FlowTab.js';
import { HistoryTab } from './tabs/HistoryTab.js';
import { PlTab } from './tabs/PlTab.js';
import { PurchaseTab } from './tabs/PurchaseTab.js';
import { SuppliersTab } from './tabs/SuppliersTab.js';
import { SurveyTab } from './tabs/SurveyTab.js';
import type { Lang } from './text.js';

const TABS = { form: SurveyTab, lines: LinesTab, suppliers: SuppliersTab, pl: PlTab, purchase: PurchaseTab, flow: FlowTab, history: HistoryTab };

export interface AppProps { host: ScreenHost; api: OrdersApi; lang: Lang; locale: string; theme: ThemeMode }

/** Picks the screen for the module's path: the order list, a new order, or an order. */
export function App({ host, api, lang, locale, theme }: AppProps) {
  const route = parseRoute(usePath(host));
  if (route.name === 'list') {
    return <OrderListScreen api={api} lang={lang} locale={locale} theme={theme}
      onOpen={(id) => host.navigate(routePath({ name: 'order', id, tab: null }))} onNew={() => host.navigate(routePath({ name: 'new' }))} />;
  }
  return <OrderPage key={route.name === 'order' ? route.id : 'new'} api={api} id={route.name === 'order' ? route.id : null}
    tab={route.name === 'order' ? route.tab : null} lang={lang} locale={locale} theme={theme} navigate={(path) => host.navigate(path)} tabs={TABS} />;
}
