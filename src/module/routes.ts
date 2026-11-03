import type { AppHost } from '@reflexify/agentflow-sdk';
import { useEffect, useState } from 'react';

// The module's paths: the list, a new order, and an order with its open tab (?tab=).
export type TabKey = 'form' | 'lines' | 'suppliers' | 'pl' | 'purchase';
export type Route = { name: 'list' } | { name: 'new' } | { name: 'order'; id: string; tab: TabKey | null };

const TABS: readonly TabKey[] = ['form', 'lines', 'suppliers', 'pl', 'purchase'];

export function parseRoute(path: string): Route {
  const [pathname, query = ''] = path.split('?');
  if (pathname === '/orders/new') return { name: 'new' };
  const match = /^\/orders\/([^/?#]+)$/.exec(pathname);
  if (!match) return { name: 'list' };
  const tab = new URLSearchParams(query).get('tab') as TabKey | null;
  return { name: 'order', id: decodeURIComponent(match[1]), tab: tab && TABS.includes(tab) ? tab : null };
}

export function routePath(route: Route): string {
  if (route.name === 'list') return '/';
  if (route.name === 'new') return '/orders/new';
  return `/orders/${encodeURIComponent(route.id)}${route.tab ? `?tab=${route.tab}` : ''}`;
}

export function usePath(host: Pick<AppHost, 'onLocationChange'>): string {
  const [path, setPath] = useState('/');
  useEffect(() => host.onLocationChange(setPath), [host]);
  return path;
}
