import type { ThemeMode } from './kit.js';
import type { ScreenHost } from './mount.js';
import { OrderListScreen } from './OrderListScreen.js';
import type { OrdersApi } from './orders-api.js';
import { parseRoute, routePath, usePath } from './routes.js';
import { TEXT, type Lang } from './text.js';

export interface AppProps { host: ScreenHost; api: OrdersApi; lang: Lang; locale: string; theme: ThemeMode }

/** Picks the screen for the module's path: the order list, a new order, or an order. */
export function App({ host, api, lang, locale, theme }: AppProps) {
  const t = TEXT[lang];
  const route = parseRoute(usePath(host));
  if (route.name === 'list') {
    return <OrderListScreen api={api} lang={lang} locale={locale} theme={theme}
      onOpen={(id) => host.navigate(routePath({ name: 'order', id, tab: null }))} onNew={() => host.navigate(routePath({ name: 'new' }))} />;
  }
  return (
    <main className="screen">
      <header className="head">
        <h1>{route.name === 'new' ? t.newOrderHeading : t.listHeading}</h1>
      </header>
    </main>
  );
}
