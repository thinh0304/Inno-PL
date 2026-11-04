// A host for screen tests: the language and the theme, and a working route (reference/routes.md of the UI skill).
import type { ScreenHost } from '../../src/module/mount.js';

export interface TestHost extends ScreenHost { paths: string[] }

export function testHost(path = '/', locale = 'vi'): TestHost {
  const listeners = new Set<(path: string) => void>();
  let current = path;
  const paths: string[] = [];
  return {
    paths,
    context: { person: { id: 'u-test', name: 'Test', email: null }, org: { id: 'org', name: 'TeraBox' }, locale,
      theme: { mode: 'light', brand: 'agentflow' } },
    onLocaleChange: () => () => {},
    onThemeChange: () => () => {},
    navigate(next: string) {
      current = next;
      paths.push(next);
      for (const listener of listeners) listener(next);
    },
    onLocationChange(listener: (path: string) => void) {
      listeners.add(listener);
      listener(current);
      return () => void listeners.delete(listener);
    },
  } as TestHost;
}
