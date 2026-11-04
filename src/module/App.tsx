import { InboxIcon } from './icons.js';
import type { ThemeMode } from './kit.js';
import type { ScreenHost } from './mount.js';
import { TEXT, type Lang } from './text.js';

export interface AppProps { host: ScreenHost; lang: Lang; locale: string; theme: ThemeMode }

/** Picks the screen for the module's path. Until the new screens exist, one placeholder. */
export function App({ lang }: AppProps) {
  const t = TEXT[lang];
  return (
    <main className="screen empty">
      <InboxIcon />
      <h1>{t.appName}</h1>
      <p>{t.rebuilding}</p>
    </main>
  );
}
