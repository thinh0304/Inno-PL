import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { formatDay, formatMoney } from './format.js';
import type { OrderDraftHook } from './useOrderDraft.js';
import { getIn, kindOf } from './paths.js';

interface FieldProps {
  hook: OrderDraftHook;
  path: string;
  label: string;
  required?: boolean;
  wide?: boolean;
  /** Read-only even for the order's editor (a value the app sets). */
  locked?: boolean;
  onKeyDown?(event: KeyboardEvent<HTMLInputElement>): void;
  onFocus?(): void;
  /** Called after each edit, with the text typed. */
  onEdit?(text: string): void;
  listbox?: ReactNode;
  inputProps?: Record<string, unknown>;
}

/** How a stored value reads in a field: dates dd/mm/yyyy, money with dots, a fraction as a percentage. */
export function shownValue(path: string, value: unknown): string {
  if (value === null || value === undefined) return '';
  const kind = kindOf(path);
  if (kind === 'date') return formatDay(String(value));
  if (kind === 'money' || kind === 'signed_money') return typeof value === 'number' ? formatMoney(value) : String(value);
  if (kind === 'percent' && typeof value === 'number') return String(Math.round(value * 10000) / 100).replace('.', ',');
  return String(value);
}

/** A labelled field of the draft: an input for the order's editor, the value as text for everyone else (FR-1.6). */
export function Field({ hook, path, label, required, wide, locked, onKeyDown, onFocus, onEdit, listbox, inputProps }: FieldProps) {
  const id = useId();
  const issue = hook.issueAt(path);
  const value = shownValue(path, getIn(hook.draft, path));
  const editable = hook.editor && !locked;
  return (
    <div className="field" data-wide={wide || undefined}>
      <label htmlFor={id} className="label">{label}{required && <span className="req" aria-hidden="true"> *</span>}</label>
      {editable ? (
        <div className="field-input">
          <input id={id} className="input" value={hook.rawAt(path) ?? value} aria-required={required || undefined}
            aria-invalid={issue ? true : undefined} aria-describedby={issue ? `${id}-issue` : undefined}
            onChange={(e) => { hook.set(path, e.target.value); onEdit?.(e.target.value); }} onKeyDown={onKeyDown} onFocus={onFocus} autoComplete="off" {...inputProps} />
          {listbox}
        </div>
      ) : (
        <div id={id} className="value">{value || '—'}</div>
      )}
      {editable && issue && <p id={`${id}-issue`} className="field-error">{issue}</p>}
    </div>
  );
}
