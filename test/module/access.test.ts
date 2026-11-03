import { describe, expect, it } from 'vitest';
import { isEditor, probeAccess, tabsFor } from '../../src/module/access.js';
import { createHttpOrdersApi } from '../../src/module/http-orders-api.js';
import type { Access } from '../../src/module/orders-api.js';
import { blankDraft } from '../../src/module/save-plan.js';
import { fakeBackend } from './fake-backend.js';

const none: Access = { seesPl: false, seesGoodsPrices: false, seesServicePrices: false, seesProposals: false, seesPlService: false,
  seesPlGoods: false, canCreateOrder: false, isAdmin: false };

describe('access', () => {
  it('probe_maps_403_and_404_to_false', async () => {
    const b = fakeBackend((method, entity) => {
      if (method !== 'QUERY') return null;
      if (entity === 'order_pl') return { status: 403, type: 'FORBIDDEN' };
      if (entity === 'purchase_proposal') return { status: 404, type: 'ENTITY_NOT_FOUND' };
      return null;
    });
    b.seed('staff', { code: 'ThuanNG', user: 'u-am', team: 'sales' });
    const access = await probeAccess(createHttpOrdersApi(b.host));
    expect(access).toMatchObject({ seesPl: false, seesProposals: false, seesGoodsPrices: true, canCreateOrder: true, isAdmin: false });
  });

  it('tabs_by_role', () => {
    const am = { ...none, seesPl: true, seesGoodsPrices: true, seesServicePrices: true, seesPlService: true, seesPlGoods: true, canCreateOrder: true };
    expect(tabsFor(am, true)).toEqual(['form', 'lines', 'suppliers', 'pl']);
    expect(tabsFor({ ...am, seesProposals: true, canCreateOrder: false }, false)).toEqual(['pl', 'lines', 'purchase', 'suppliers', 'form']);
    expect(tabsFor({ ...am, canCreateOrder: false, isAdmin: true }, false)).toEqual(['pl', 'lines', 'suppliers', 'form']);
    expect(tabsFor({ ...none, seesGoodsPrices: true, seesProposals: true, seesPlGoods: true }, false)).toEqual(['purchase']);
    expect(tabsFor({ ...none, seesServicePrices: true, seesPlService: true }, false)).toEqual(['purchase']);
  });

  it('editor_only_in_draft', () => {
    const draft = blankDraft('u-am');
    expect(isEditor(draft.order, { id: 'u-am', name: '' })).toBe(true);
    expect(isEditor({ ...draft.order, sa: 'u-sa' }, { id: 'u-sa', name: '' })).toBe(true);
    expect(isEditor(draft.order, { id: 'u-x', name: '' })).toBe(false);
    expect(isEditor({ ...draft.order, status: 'in_progress' }, { id: 'u-am', name: '' })).toBe(false);
  });
});
