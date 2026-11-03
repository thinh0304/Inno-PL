import { describe, expect, it } from 'vitest';
import { parseRoute, routePath } from '../../src/module/routes.js';

describe('routes', () => {
  it('parses_each_route', () => {
    expect(parseRoute('/')).toEqual({ name: 'list' });
    expect(parseRoute('/orders/new')).toEqual({ name: 'new' });
    expect(parseRoute('/orders/o-1')).toEqual({ name: 'order', id: 'o-1', tab: null });
    expect(parseRoute('/orders/o-1?tab=pl')).toEqual({ name: 'order', id: 'o-1', tab: 'pl' });
    expect(parseRoute('/orders/o-1?tab=nope')).toEqual({ name: 'order', id: 'o-1', tab: null });
    expect(parseRoute('/x/y')).toEqual({ name: 'list' });
  });

  it('round_trips', () => {
    for (const path of ['/', '/orders/new', '/orders/o-1', '/orders/o-1?tab=lines']) {
      expect(routePath(parseRoute(path))).toBe(path);
    }
  });
});
