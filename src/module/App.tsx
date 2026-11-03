import type { ThemeMode } from './kit.js';
import type { ScreenHost } from './mount.js';
import { parseRoute, usePath } from './routes.js';
import { TEXT, type Lang } from './text.js';

export interface AppProps { host: ScreenHost; lang: Lang; locale: string; theme: ThemeMode }

/** Picks the screen for the module's path: the order list, a new order, or an order. */
export function App({ host, lang }: AppProps) {
  const t = TEXT[lang];
  const route = parseRoute(usePath(host));
  return (
    <main className="screen">
      <header className="head">
        <h1>{route.name === 'new' ? t.newOrderHeading : t.listHeading}</h1>
      </header>
    </main>
  );
}
