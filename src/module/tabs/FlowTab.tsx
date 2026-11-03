import { stageBar } from '../../flow/board';
import { ActionPanel } from '../ActionPanel.js';
import { closedReason, returnedInfo } from '../flow-view.js';
import { AlertIcon } from '../icons.js';
import { formatDateTime } from '../format.js';
import type { TabProps } from '../OrderPage.js';
import { TaskCard } from '../TaskCard.js';
import { TEXT } from '../text.js';

/** The flow tab (mockup `renderWorkflow`, `renderBoard`): where the order stands, the board, and this person's work. */
export function FlowTab({ hook, lang, locale, theme, flow, contracts }: TabProps) {
  const t = TEXT[lang].flow;
  const { order } = hook.draft;
  if (flow.state === 'loading') {
    return <div className="panel skeleton" aria-busy="true" aria-label={TEXT[lang].loading}>
      {[0, 1, 2].map((i) => <div key={i} className="skeleton-row"><span className="af-skeleton" style={{ width: '50%' }} /></div>)}
    </div>;
  }
  if (flow.state === 'forbidden' || flow.state === 'failed') {
    return (
      <div className="state" role={flow.state === 'failed' ? 'alert' : 'status'}>
        <span className="state-icon danger"><AlertIcon /></span>
        <h2>{flow.state === 'forbidden' ? t.forbidden : t.loadFailed}</h2>
        {flow.state === 'failed' && <button type="button" className="af-button secondary" onClick={flow.reload}>{TEXT[lang].retry}</button>}
      </div>
    );
  }
  if (flow.tasks.length === 0) {
    return (
      <div className="state" role="status">
        <p>{t.empty}</p>
        <button type="button" className="af-button secondary" onClick={flow.reload}>{t.reload}</button>
      </div>
    );
  }

  const nameOf = (code: string) => hook.config.taskSlas.find((s) => s.taskCode === code)?.name ?? code.toUpperCase();
  const person = (user: string | null) => (user ? hook.staff.find((s) => s.user === user)?.name ?? t.unknownPerson : null);
  const { returned, by } = returnedInfo(flow.events, order.status);
  const columns = stageBar(flow.tasks, { status: order.status, returned });
  const now = new Date().toISOString();
  const closed = order.status === 'close_lost' || order.status === 'done';

  return (
    <div className="flow">
      {order.status === 'close_lost' && <div className="banner" data-tone="danger" role="status">{t.closedLost(closedReason(flow.events))}</div>}
      {order.status === 'done' && <div className="banner" data-tone="ok" role="status">{t.completedBanner}</div>}
      {by && (
        <div className="banner" data-tone="danger" role="status">
          {t.returnedBanner(person(by.actor) ?? t.system, formatDateTime(by.at), by.task_code?.toUpperCase() ?? '', by.reason)}
        </div>
      )}
      {!closed && <ActionPanel hook={hook} flow={flow} contracts={contracts} lang={lang} locale={locale} theme={theme} name={nameOf} />}
      <section className="board" aria-label={t.boardLabel}>
        {columns.map((stage) => (
          <div key={stage.stage} className="bcol" data-state={stage.state}>
            <h3 className="bhead">
              <span className="bnum">{stage.stage}</span>
              <span>{t.stages[stage.stage - 1]}</span>
              <span className="count">{t.count(stage.finished, stage.total)}</span>
            </h3>
            {flow.tasks.filter((task) => task.stage === stage.stage).map((task) => (
              <TaskCard key={task.id} task={task} name={nameOf(task.task_code)} tasks={flow.tasks} customerPrepays={order.customer_prepays}
                holder={person(task.claimedBy)} busy={flow.busy === task.id} now={now} lang={lang} />
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
