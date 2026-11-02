// @vitest-environment jsdom
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CasesError, type Case, type CasesApi } from '../../src/module/cases-api.js';
import { createMemoryCasesApi } from '../../src/module/memory-cases-api.js';
import type { ScreenHost } from '../../src/module/mount.js';
import { TEXT } from '../../src/module/text.js';

// What jsdom lacks and the kit's elements use.
class NoResize { observe() {} unobserve() {} disconnect() {} }
globalThis.ResizeObserver ??= NoResize as unknown as typeof ResizeObserver;
HTMLElement.prototype.showPopover ??= function (this: HTMLElement) { this.dataset.shown = 'true'; };
HTMLElement.prototype.hidePopover ??= function (this: HTMLElement) { this.dataset.shown = 'false'; };
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };

// The first render draws the kit's elements for the first time, which takes over a second on a busy machine.
configure({ asyncUtilTimeout: 5000 });

const { CasesScreen } = await import('../../src/module/CasesScreen.js');
const { mountCases } = await import('../../src/module/mount.js');

const SEED: Case[] = [
  { id: 'c2', title: 'Refund for a damaged delivery', urgent: true, openedOn: '2026-10-14', status: 'open' },
  { id: 'c1', title: 'Change the billing address', urgent: false, openedOn: '2026-10-02', status: 'approved' },
];

/** The texts of the toasts on screen, read from the toast element's own parts. */
const toasts = () =>
  [...document.querySelectorAll('af-toast')].flatMap((el) =>
    [...(el.shadowRoot?.querySelectorAll('[part="toast"]') ?? [])].map((t) => (t.querySelector('[part="text"]') ?? t).textContent?.trim() ?? ''));

const dialogOpen = () => (document.querySelector('af-dialog') as HTMLElement & { open: boolean }).open;

function show(seed: Case[], wrap: (api: CasesApi) => CasesApi = (api) => api) {
  const api = createMemoryCasesApi(seed);
  render(<CasesScreen api={wrap(api)} lang="en" locale="en" theme="light" />);
  return api;
}

async function fillAndCreate(title: string) {
  fireEvent.click(screen.getByText('New case'));
  await waitFor(() => expect(dialogOpen()).toBe(true));
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: title } });
  fireEvent.click(screen.getByText('Create case'));
}

afterEach(cleanup);

describe('the Cases screen', () => {
  it('lists the cases, with the urgent ones marked', async () => {
    show(SEED);
    await screen.findByText('Change the billing address');
    const cases = [...document.querySelectorAll('tbody tr')] as HTMLElement[];
    expect(cases.map((r) => r.querySelector('.title-text')!.textContent)).toEqual(['Refund for a damaged delivery', 'Change the billing address']);
    expect(cases.map((r) => within(r).queryByText('Urgent') !== null)).toEqual([true, false]);
    expect(cases.map((r) => r.querySelector('.pill')!.textContent)).toEqual(['Open', 'Approved']);
  });

  it('adds a created case to the list and says so in a toast', async () => {
    const api = show(SEED);
    await screen.findByText('Change the billing address');
    await fillAndCreate('Second invoice for one order');
    expect(await screen.findByText('Second invoice for one order')).toBeTruthy();
    expect(api.cases.map((c) => c.title)).toContain('Second invoice for one order');
    await waitFor(() => expect(toasts()).toContain('Case created'));
    expect(dialogOpen()).toBe(false);
  });

  it('says there are no cases yet when the list is empty', async () => {
    show([]);
    expect((await screen.findByText('No cases yet')).tagName).toBe('H2');
    expect(document.querySelector('table')).toBeNull();
  });

  it('shows why a create failed in the dialog, and keeps what was typed', async () => {
    const api = show(SEED);
    await screen.findByText('Change the billing address');
    api.failNextCreate('A case with this title is already open');
    await fillAndCreate('Refund for a damaged delivery');
    const alert = await screen.findByText('A case with this title is already open');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.closest('af-dialog')).not.toBeNull();
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Refund for a damaged delivery');
    expect(dialogOpen()).toBe(true);
    expect(api.cases).toHaveLength(2);
    expect(toasts()).toEqual([]);
  });

  it('shows a case created while the list could not load, by reading the list again', async () => {
    let failing = true;
    show(SEED, (api) => ({
      list: () => (failing ? Promise.reject(new CasesError('NETWORK', null)) : api.list()),
      create: (input) => api.create(input),
    }));
    await screen.findByText("Couldn't reach AgentFlow. Check your connection.");
    failing = false;
    await fillAndCreate('Second invoice for one order');
    expect(await screen.findByText('Second invoice for one order')).toBeTruthy();
    expect(screen.getByText('Change the billing address')).toBeTruthy();
    await waitFor(() => expect(toasts()).toContain('Case created'));
  });

  it('keeps both cases when two creates land together', async () => {
    const held: (() => void)[] = [];
    show(SEED, (api) => ({
      list: () => api.list(),
      create: (input) =>
        new Promise<Case>((resolve) => {
          held.push(() => resolve({ id: `held-${held.length}`, title: input.title, urgent: input.urgent, openedOn: input.openedOn, status: 'open' }));
        }),
    }));
    await screen.findByText('Change the billing address');
    await fillAndCreate('First of two');
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(dialogOpen()).toBe(false));
    await fillAndCreate('Second of two');
    await waitFor(() => expect(held).toHaveLength(2));
    await act(async () => {
      for (const land of held) land();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const titles = () => [...document.querySelectorAll('tbody tr .title-text')].map((el) => el.textContent);
    await waitFor(() => expect(titles()).toEqual(['Second of two', 'First of two', 'Refund for a damaged delivery', 'Change the billing address']));
  });

  it('opens clean after a create that failed once its dialog was closed', async () => {
    let refuse: (error: unknown) => void = () => undefined;
    show(SEED, (api) => ({
      list: () => api.list(),
      create: () => new Promise<Case>((_, reject) => { refuse = reject; }),
    }));
    await screen.findByText('Change the billing address');
    await fillAndCreate('Refund for a damaged delivery');
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(dialogOpen()).toBe(false));
    await act(async () => {
      refuse(new CasesError('ENTITY_VALIDATION_RULE_FAILED', 'A case needs a title'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    fireEvent.click(screen.getByText('New case'));
    await waitFor(() => expect(dialogOpen()).toBe(true));
    expect(screen.queryByText('A case needs a title')).toBeNull();
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('');
    expect(screen.getByText('Create case')).toBeTruthy();
  });
});

describe('dates and counts', () => {
  afterEach(() => vi.useRealTimers());
  const shown = (iso: string) => [...document.querySelectorAll(`time[datetime="${iso}"]`)].map((t) => t.textContent);
  const tooltips = () => document.querySelectorAll('af-tooltip');
  const SEEDED: Case[] = [
    { id: 't', title: 'Opened today', urgent: false, openedOn: '2026-10-18', status: 'open' },
    { id: 'y', title: 'Opened this year', urgent: false, openedOn: '2026-10-02', status: 'open' },
    { id: 'o', title: 'Opened last year', urgent: false, openedOn: '2025-12-30', status: 'open' },
  ];

  it('shows a day as the date picker shows it', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-18T09:00:00') });
    show(SEEDED);
    await screen.findByText('Opened this year');
    expect(shown('2026-10-18')).toEqual(['Today', 'Today']);
    expect(shown('2026-10-02')).toEqual(['2 Oct', '2 Oct']);
    expect(shown('2025-12-30')).toEqual(['30 Dec 2025', '30 Dec 2025']);
  });

  it('in Vietnamese, writes the day before the month in figures', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-18T09:00:00') });
    render(<CasesScreen api={createMemoryCasesApi(SEEDED)} lang="vi" locale="vi" theme="light" />);
    await screen.findByText('Opened this year');
    expect(shown('2026-10-18')[0]).toBe('Hôm nay');
    expect(shown('2026-10-02')[0]).toBe('02/10');
    expect(shown('2025-12-30')[0]).toBe('30/12/2025');
    expect(screen.getAllByText('Thứ Sáu, 2 tháng 10, 2026').length).toBeGreaterThan(0);
  });

  it('gives the full date to a screen reader beside the short one, and hides the short one from it', async () => {
    show(SEEDED);
    await screen.findByText('Opened this year');
    const time = document.querySelector('time[datetime="2026-10-02"]')!;
    const full = time.parentElement!.nextElementSibling!;
    expect(time.getAttribute('aria-hidden')).toBe('true');
    expect(full.textContent).toMatch(/^Friday,? 2 October 2026$/);
    expect(full.classList.contains('sr-only')).toBe(true);
  });

  it('builds no tooltip until the pointer first reaches a date, then the full date in one', async () => {
    show(SEEDED);
    await screen.findByText('Opened this year');
    expect(tooltips()).toHaveLength(0);
    fireEvent.pointerEnter(document.querySelector('time[datetime="2026-10-02"]')!);
    await waitFor(() => expect(tooltips()).toHaveLength(1));
    const tip = tooltips()[0] as HTMLElement & { text: string };
    expect(tip.text).toMatch(/^Friday,? 2 October 2026$/);
    expect(tip.querySelector('time')!.textContent).toBe('2 Oct');
  });

  it('counts through Intl.NumberFormat in both languages', () => {
    expect(TEXT.en.count(1, 'en')).toBe('1 case');
    expect(TEXT.en.count(1200, 'en')).toBe('1,200 cases');
    expect(TEXT.vi.count(1200, 'vi')).toBe('1.200 hồ sơ');
  });
});

describe('the mounted screen', () => {
  /** A host whose language and theme switch once more as the screen subscribes, before its listener is registered. */
  function switchingHost(): ScreenHost {
    const context: ScreenHost['context'] = {
      person: { id: 'p', name: 'P', email: null }, org: { id: 'o', name: 'Acme' }, locale: 'en', theme: { mode: 'light', brand: 'agentflow' },
    };
    return {
      context,
      onLocaleChange: () => {
        context.locale = 'vi';
        return () => {};
      },
      onThemeChange: () => {
        context.theme = { mode: 'dark', brand: 'agentflow' };
        return () => {};
      },
    };
  }

  it('keeps a language and a theme switch made between its first render and its subscription', async () => {
    const element = document.createElement('div');
    document.body.append(element);
    const shadow = element.attachShadow({ mode: 'open' });
    let unmount = () => {};
    act(() => {
      unmount = mountCases(shadow, switchingHost(), createMemoryCasesApi(SEED));
    });
    const root = shadow.querySelector('.cases') as HTMLElement;
    await waitFor(() => expect(root.querySelector('h1')!.textContent).toBe('Hồ sơ'));
    expect(root.lang).toBe('vi');
    expect(root.dataset.theme).toBe('dark');
    act(() => unmount());
    element.remove();
  });
});
