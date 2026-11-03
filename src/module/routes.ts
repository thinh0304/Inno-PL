import type { AppHost } from '@reflexify/agentflow-sdk';
import { useEffect, useState } from 'react';

// The module's paths: the list, a new order, an order with its open tab (?tab=), My work (/tasks) and a task (/tasks/<id>).
export type TabKey = 'form' | 'lines' | 'suppliers' | 'pl' | 'purchase' | 'contracts' | 'flow' | 'history';
export type Route = { name: 'list' } | { name: 'new' } | { name: 'work' } | { name: 'task'; id: string } | { name: 'order'; id: string; tab: TabKey | null };

const TABS: readonly TabKey[] = ['form', 'lines', 'suppliers', 'pl', 'purchase', 'contracts', 'flow', 'history'];

export function parseRoute(path: string): Route {
  const [pathname, query = ''] = path.split('?');
  if (pathname === '/orders/new') return { name: 'new' };
  if (pathname === '/tasks') return { name: 'work' };
  const task = /^\/tasks\/([^/?#]+)$/.exec(pathname);
  if (task) return { name: 'task', id: decodeURIComponent(task[1]) };
  const match = /^\/orders\/([^/?#]+)$/.exec(pathname);
  if (!match) return { name: 'list' };
  const tab = new URLSearchParams(query).get('tab') as TabKey | null;
  return { name: 'order', id: decodeURIComponent(match[1]), tab: tab && TABS.includes(tab) ? tab : null };
}

export function routePath(route: Route): string {
  if (route.name === 'list') return '/';
  if (route.name === 'new') return '/orders/new';
  if (route.name === 'work') return '/tasks';
  if (route.name === 'task') return `/tasks/${encodeURIComponent(route.id)}`;
  return `/orders/${encodeURIComponent(route.id)}${route.tab ? `?tab=${route.tab}` : ''}`;
}

export function usePath(host: Pick<AppHost, 'onLocationChange'>): string {
  const [path, setPath] = useState('/');
  useEffect(() => host.onLocationChange(setPath), [host]);
  return path;
}
