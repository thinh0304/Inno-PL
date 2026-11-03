import { AF_DEFAULT_PALETTE, applyTheme, createModuleContainer, type AppTheme } from '@reflexify/agentflow-sdk';
import { mountApp, type ScreenHost } from './mount.js';

/**
 * The module on its in-memory demo data, in a shadow root as AgentFlow gives it one, following the browser's language
 * and colour scheme. This is the page's code, not the module's, so it may listen on the window. The path lives in the
 * address bar's hash, so back and forward work.
 */
function mountDemo(element: HTMLElement): void {
  const scheme = matchMedia('(prefers-color-scheme: dark)');
  const theme = (): AppTheme => ({ mode: scheme.matches ? 'dark' : 'light', brand: 'agentflow' });
  const themes = new Set<(theme: AppTheme) => void>();
  const locales = new Set<(locale: string) => void>();
  const paths = new Set<(path: string) => void>();
  const path = () => location.hash.slice(1) || '/';
  const host: ScreenHost = {
    context: { person: { id: 'u-am', name: 'Nguyễn Thuận', email: null }, org: { id: 'demo', name: 'TeraBox' }, locale: navigator.language, theme: theme() },
    navigate(next) {
      location.hash = next;
    },
    onLocationChange(listener) {
      paths.add(listener);
      listener(path());
      return () => void paths.delete(listener);
    },
    onThemeChange(listener) {
      themes.add(listener);
      return () => void themes.delete(listener);
    },
    onLocaleChange(listener) {
      locales.add(listener);
      return () => void locales.delete(listener);
    },
  };
  scheme.addEventListener('change', () => {
    host.context.theme = theme();
    applyTheme(element, host.context.theme, AF_DEFAULT_PALETTE);
    for (const listener of themes) listener(host.context.theme);
  });
  addEventListener('hashchange', () => {
    for (const listener of paths) listener(path());
  });
  addEventListener('languagechange', () => {
    host.context.locale = navigator.language;
    for (const listener of locales) listener(navigator.language);
  });

  applyTheme(element, host.context.theme, AF_DEFAULT_PALETTE);
  mountApp(createModuleContainer(element).root, host);
}

mountDemo(document.getElementById('app')!);
