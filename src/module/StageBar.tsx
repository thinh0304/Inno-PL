import { stageBar, type BoardTask } from '../flow/board';
import type { FlowOrder } from '../flow/tasks';
import { CheckIcon, XIcon } from './icons.js';
import { TEXT, type Lang } from './text.js';

/** The seven stages above every tab (FR-6.1, mockup `state-line`): done, current with who is awaited, or in parallel. */
export function StageBar({ tasks, status, returned, lang }: { tasks: BoardTask[]; status: FlowOrder['status']; returned: boolean; lang: Lang }) {
  const t = TEXT[lang].flow;
  const stages = stageBar(tasks, { status, returned });
  return (
    <ol className="stagebar" aria-label={t.stageBarLabel}>
      {stages.map((s) => {
        const roles = s.waitingRoles.map((r) => t.roles[r]).join(', ');
        const shows = s.state === 'current' || s.state === 'returned' || s.state === 'lost' || s.state === 'parallel';
        const label = `${t.stageN(s.stage)} ${t.stages[s.stage - 1]}: ${t.stateLabel[s.state]}${roles && s.state !== 'done' ? ` · ${t.awaiting(roles)}` : ''}`;
        return (
          <li key={s.stage} className="stage" data-state={s.state} aria-label={label} aria-current={s.state === 'current' || s.state === 'returned' ? 'step' : undefined}>
            <span className="stage-mark" aria-hidden="true">
              {s.state === 'done' ? <CheckIcon /> : s.state === 'lost' ? <XIcon /> : s.state === 'returned' ? '!' : s.stage}
            </span>
            <span className="stage-name" aria-hidden="true">{t.stageShort[s.stage - 1]}</span>
            {shows && <span className="stage-sub" aria-hidden="true">{t.stateLabel[s.state]}{roles ? ` · ${roles}` : ''}</span>}
          </li>
        );
      })}
    </ol>
  );
}
