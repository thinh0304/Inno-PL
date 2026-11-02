import type { AfToastElement, DateChangeDetail, DialogCloseDetail } from '@reflexify/agentflow-elements/jsx';
import '@reflexify/agentflow-elements/kit';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

export type ThemeMode = 'light' | 'dark';
type Common = { locale: string; theme: ThemeMode };

/**
 * Sets `props` on a kit element as properties and listens for its `events`, so nothing depends on how a React version
 * treats custom elements. A handler is read when its event fires, so a new function each render costs no listener.
 */
function useElement<E extends HTMLElement>(props: Record<string, unknown>, events: Record<string, (detail: never) => void>): RefObject<E | null> {
  const ref = useRef<E | null>(null);
  useLayoutEffect(() => {
    const el = ref.current as unknown as Record<string, unknown> | null;
    if (el) for (const [key, value] of Object.entries(props)) if (el[key] !== value) el[key] = value;
  });
  const latest = useRef(events);
  latest.current = events;
  const names = Object.keys(events).join(',');
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const offs = names.split(',').filter(Boolean).map((type) => {
      const listener = (e: Event) => latest.current[type]?.((e as CustomEvent).detail as never);
      el.addEventListener(type, listener);
      return () => el.removeEventListener(type, listener);
    });
    return () => offs.forEach((off) => off());
  }, [names]);
  return ref;
}

/** `af-dialog`: the body in the default slot, the buttons in `actions`. It never closes itself: `onClose` sets `open` false. */
export function Dialog(p: Common & { open: boolean; heading: string; onClose(detail: DialogCloseDetail): void; children: ReactNode; actions: ReactNode }) {
  const ref = useElement<HTMLElement>({ open: p.open, heading: p.heading, locale: p.locale }, { close: p.onClose });
  return (
    <af-dialog ref={ref} data-theme={p.theme}>
      {p.children}
      <div slot="actions" className="slot">{p.actions}</div>
    </af-dialog>
  );
}

/** `af-date`, named by `label` because a `<label for>` cannot reach the input inside its shadow root. */
export function DateInput(p: Common & { value: string | null; label: string; onChange(value: string | null): void }) {
  const ref = useElement<HTMLElement>(
    { value: p.value, label: p.label, clearable: true, locale: p.locale },
    { change: (detail: DateChangeDetail) => p.onChange(detail.value) },
  );
  return <af-date ref={ref} data-theme={p.theme} />;
}

/** The module's one `af-toast`, and a function that shows a toast in it. */
export function useToasts(p: Common): { region: ReactNode; show(kind: 'success' | 'error', text: string): void } {
  const ref = useElement<AfToastElement>({ locale: p.locale }, {});
  const show = useCallback((kind: 'success' | 'error', text: string) => ref.current?.show({ kind, text }), [ref]);
  return { region: <af-toast ref={ref} data-theme={p.theme} />, show };
}

/** `af-tooltip` around `children`: `text` shows after a short hover, or at once when the anchor takes keyboard focus. */
export function Tooltip(p: Common & { text: string; children: ReactNode }) {
  const ref = useElement<HTMLElement>({ text: p.text, locale: p.locale }, {});
  return <af-tooltip ref={ref} data-theme={p.theme}>{p.children}</af-tooltip>;
}

/**
 * A `Tooltip` that mounts only when the pointer first enters `children`. A list has no upper bound, and every
 * `af-tooltip` is a shadow root nobody hovers; until then a span with the same box stands in. The pointer move that arms
 * it is not replayed: the tooltip opens on the next move over the anchor. It arms on hover only, so it is for a
 * non-interactive value, and what it shows only adds detail the visible text already implies (text cut by an ellipsis
 * implies the rest, and stays whole in the page for a screen reader), with the full form also given as visually hidden text.
 *
 * Never wrap focusable content in it (a control, a link, anything with `tabIndex`): the swap remounts `children`, and
 * focus inside them would drop. For a control, use a wrapper that moves the children's existing nodes into the
 * tooltip and replays the pointer's arrival.
 */
export function LazyTooltip(p: Common & { text: string; children: ReactNode }) {
  const [armed, setArmed] = useState(false);
  if (armed) return <Tooltip {...p} />;
  return (
    <span style={{ display: 'inline-block' }} onPointerEnter={() => setArmed(true)}>
      {p.children}
    </span>
  );
}
