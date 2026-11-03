import { dueState } from '../flow/calendar';
import { waitingOn, type BoardTask } from '../flow/board';
import { formatDay } from './format.js';
import type { OrderTask } from './orders-api.js';
import { TEXT, type Lang } from './text.js';

interface Props { task: OrderTask; name: string; tasks: BoardTask[]; customerPrepays: boolean; holder: string | null; busy: boolean; now: string; lang: Lang }

/** One task of the board (mockup `taskCard`): who does it, where it stands, when it is due, and who it waits for. */
export function TaskCard({ task, name, tasks, customerPrepays, holder, busy, now, lang }: Props) {
  const t = TEXT[lang].flow;
  const waiting = waitingOn(task.task_code, tasks, customerPrepays).map((r) => t.roles[r]).join(', ');
  const live = task.status === 'open' ? dueState(task.due_at, now, null) : null;
  const dueText = live?.state === 'overdue' ? t.dueState.overdue(live.lateDays) : live?.state === 'due_soon' ? t.dueState.due_soon : live?.state === 'on_time' ? t.dueState.on_time : null;
  const finished = task.due_state === 'done_late' ? t.dueState.done_late(task.late_days ?? 0) : task.due_state === 'done_on_time' ? t.dueState.done_on_time : null;
  const tone = live?.state === 'overdue' || task.due_state === 'done_late' ? 'danger' : live?.state === 'due_soon' ? 'warn' : task.status === 'open' ? 'info' : undefined;
  return (
    <article className="tcard" data-status={task.status} aria-label={`${task.task_code.toUpperCase()} · ${name}`} aria-busy={busy || undefined}>
      <header className="tcard-head">
        <b className="code">{task.task_code.toUpperCase()}</b>
        <span className="tag">{t.roles[task.role]}</span>
      </header>
      <p className="tcard-name">{name}</p>
      <p className="tcard-meta">
        <span className="tag" data-tone={tone}>{t.status[task.status]}</span>
        {task.status === 'blocked' && waiting && <span>{t.waitingOn(waiting)}</span>}
        {task.status === 'open' && task.due_at && <span>{t.due(formatDay(task.due_at))}</span>}
        {dueText && <span data-tone={tone} className="due">{dueText}</span>}
        {finished && <span data-tone={tone} className="due">{finished}</span>}
        {task.status === 'open' && holder && <span>{t.heldBy(holder)}</span>}
      </p>
      {busy && <p className="busy" role="status">{t.busy}</p>}
    </article>
  );
}
