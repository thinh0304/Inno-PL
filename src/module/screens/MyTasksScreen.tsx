import { useCallback, useEffect, useState } from 'react';
import type { Api, TaskAct } from '../api.js';
import { TEXT, type Lang } from '../text.js';
import { TaskList, type MyTask } from './ViecCuaBan.js';

export function MyTasksScreen({ api, lang, onBack, onOpen }: { api: Api; lang: Lang; onBack(): void; onOpen(orderId: string): void }) {
  const t = TEXT[lang];
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => api.myTasks().then(setTasks, () => setFailed(true)), [api]);
  useEffect(() => { void load(); }, [load]);
  const act = async (task: MyTask, status: TaskAct, reason: string) => {
    setBusy(true); setFailed(false);
    try { await api.actOnTask(task.id, status, reason); await load(); } catch { setFailed(true); } finally { setBusy(false); }
  };
  return (
    <main className="screen">
      <header className="bar"><button type="button" className="btn" onClick={onBack}>{t.back}</button><h1>{t.myTasks}</h1></header>
      {failed ? <p className="error" role="alert">{t.actionFailed}</p> : null}
      <TaskList tasks={tasks} lang={lang} busy={busy} onAct={(task, s, r) => void act(task, s, r)} onOpen={onOpen} />
    </main>
  );
}
