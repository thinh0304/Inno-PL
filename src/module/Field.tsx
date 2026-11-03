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

export interface Option { value: string; label: string }

interface SelectProps {
  hook: OrderDraftHook;
  path: string;
  label: string;
  options: Option[];
  /** The option for an empty value (stored as null). */
  empty?: string;
  required?: boolean;
  /** Shown but not changeable, with the reason read out. */
  lockedReason?: string;
  onPick?(value: string | null): void;
}

/** A choice from a list, stored as the option's value, or null for the empty option. */
export function SelectField({ hook, path, label, options, empty, required, lockedReason, onPick }: SelectProps) {
  const id = useId();
  const issue = hook.issueAt(path);
  const stored = getIn(hook.draft, path);
  const value = stored === null || stored === undefined ? '' : String(stored);
  const shown = options.find((o) => o.value === value)?.label ?? (value ? value : empty ?? '—');
  if (!hook.editor) {
    return (
      <div className="field">
        <span className="label" id={`${id}-label`}>{label}</span>
        <div className="value" aria-labelledby={`${id}-label`}>{shown}</div>
      </div>
    );
  }
  const described = [issue && `${id}-issue`, lockedReason && `${id}-why`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id} className="label">{label}{required && <span className="req" aria-hidden="true"> *</span>}</label>
      <select id={id} className="input select-input" value={value} aria-invalid={issue ? true : undefined}
        aria-disabled={lockedReason ? true : undefined} aria-describedby={described}
        onChange={(e) => {
          if (lockedReason) return;
          const next = e.target.value === '' ? null : e.target.value;
          if (onPick) onPick(next);
          else hook.set(path, next);
        }}>
        {empty !== undefined && <option value="">{empty}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {lockedReason && <span id={`${id}-why`} className="hint">{lockedReason}</span>}
      {issue && <p id={`${id}-issue`} className="field-error">{issue}</p>}
    </div>
  );
}

/** A yes / no question (Có / Không), stored as a boolean. */
export function YesNoField({ hook, path, label, yes, no, onPick }: { hook: OrderDraftHook; path: string; label: string; yes: string; no: string;
  onPick?(value: boolean): void }) {
  const id = useId();
  const value = getIn(hook.draft, path) === true;
  if (!hook.editor) {
    return <div className="field"><span className="label">{label}</span><div className="value">{value ? yes : no}</div></div>;
  }
  const pick = (next: boolean) => (onPick ? onPick(next) : hook.set(path, next));
  return (
    <fieldset className="field yes-no">
      <legend className="label">{label}</legend>
      <div className="choices">
        <label className="check"><input type="radio" name={id} checked={value} onChange={() => pick(true)} />{yes}</label>
        <label className="check"><input type="radio" name={id} checked={!value} onChange={() => pick(false)} />{no}</label>
      </div>
    </fieldset>
  );
}

/** A tick, stored as a boolean. */
export function CheckField({ hook, path, label }: { hook: OrderDraftHook; path: string; label: string }) {
  const value = getIn(hook.draft, path) === true;
  if (!hook.editor) return value ? <span className="tag">{label}</span> : null;
  return <label className="check"><input type="checkbox" checked={value} onChange={(e) => hook.set(path, e.target.checked)} />{label}</label>;
}
