import { KIT_CSS } from '@reflexify/agentflow-elements/kit';
import type { AppHost } from '@reflexify/agentflow-sdk';
import { StrictMode, useEffect, useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import type { ThemeMode } from './kit.js';
import css from './styles.css?inline';
import { langOf } from './text.js';

/** What the screens read from their host: the language and the theme, which change in place, and the module's path. */
export type ScreenHost = Pick<AppHost, 'context' | 'onLocaleChange' | 'onThemeChange' | 'navigate' | 'onLocationChange'>;

/**
 * Renders the order screens in `root`, and returns how to take them away again. Its one stylesheet, the kit's and its
 * own, goes into the shadow root that holds `root`, so the page around it neither styles it nor is styled by it.
 */
export function mountApp(root: ShadowRoot | Element, host: ScreenHost): () => void {
  const doc = root.ownerDocument;
  const scope = root instanceof ShadowRoot ? root : root.getRootNode();
  const style = doc.createElement('style');
  style.textContent = `${KIT_CSS}\n${css}`;
  (scope instanceof ShadowRoot ? scope : root).prepend(style);

  const element = doc.createElement('div');
  element.className = 'pl af-kit';
  // Focusable itself, so a click anywhere inside puts focus in the module.
  element.tabIndex = -1;
  root.append(element);
  const react = createRoot(element);
  react.render(<StrictMode><Following host={host} element={element} /></StrictMode>);
  return () => {
    react.unmount();
    element.remove();
    style.remove();
  };
}

function Following({ host, element }: { host: ScreenHost; element: HTMLElement }) {
  const [locale, setLocale] = useState(host.context.locale);
  const [theme, setTheme] = useState<ThemeMode>(host.context.theme.mode);
  // A language or theme switch re-renders in place, so an open dialog and what is typed in it stay. Neither listener is
  // called as it subscribes, so the context is read again once subscribed: a switch made before then is not lost.
  useEffect(() => {
    const off = host.onLocaleChange(setLocale);
    setLocale(host.context.locale);
    return off;
  }, [host]);
  useEffect(() => {
    const off = host.onThemeChange((next) => setTheme(next.mode));
    setTheme(host.context.theme.mode);
    return off;
  }, [host]);
  const lang = langOf(locale);
  useLayoutEffect(() => {
    element.dataset.theme = theme;
    element.lang = lang;
  }, [element, theme, lang]);
  return <App host={host} lang={lang} locale={locale} theme={theme} />;
}
