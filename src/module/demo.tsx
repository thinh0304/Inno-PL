import { AF_DEFAULT_PALETTE, applyTheme, createModuleContainer, type AppTheme } from '@reflexify/agentflow-sdk';
import type { Case } from './cases-api.js';
import { createMemoryCasesApi } from './memory-cases-api.js';
import { mountCases, type ScreenHost } from './mount.js';
import { todayIso } from './NewCaseDialog.js';

const SEED: Case[] = [
  { id: 'demo-3', title: 'Refund for a damaged delivery', urgent: true, openedOn: todayIso(), status: 'open' },
  { id: 'demo-2', title: 'Change the billing address', urgent: false, openedOn: '2026-10-14', status: 'approved' },
  { id: 'demo-1', title: 'Second invoice for one order', urgent: false, openedOn: '2026-10-02', status: 'rejected' },
];

/**
 * The module on its in-memory fake, in a shadow root as AgentFlow gives it one, following the browser's language and
 * colour scheme. This is the page's code, not the module's, so it may listen on the window. `?empty` starts with no
 * cases, and `?fail` makes the first create fail.
 */
function mountDemo(element: HTMLElement): void {
  const query = new URLSearchParams(location.search);
  const api = createMemoryCasesApi(query.has('empty') ? [] : SEED, { delayMs: 400 });
  if (query.has('fail')) api.failNextCreate('The demo refuses this one create. Press Create case again.');

  const scheme = matchMedia('(prefers-color-scheme: dark)');
  const theme = (): AppTheme => ({ mode: scheme.matches ? 'dark' : 'light', brand: 'agentflow' });
  const themes = new Set<(theme: AppTheme) => void>();
  const locales = new Set<(locale: string) => void>();
  const host: ScreenHost = {
    context: { person: { id: 'demo', name: 'Demo', email: null }, org: { id: 'demo', name: 'Acme' }, locale: navigator.language, theme: theme() },
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
  addEventListener('languagechange', () => {
    host.context.locale = navigator.language;
    for (const listener of locales) listener(navigator.language);
  });

  applyTheme(element, host.context.theme, AF_DEFAULT_PALETTE);
  mountCases(createModuleContainer(element).root, host, api);
}

mountDemo(document.getElementById('cases')!);
