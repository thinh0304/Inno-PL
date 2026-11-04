import { useEffect, useMemo, useState } from 'react';
import type { AppHost } from '@reflexify/agentflow-sdk';
import { makeApi } from './api.js';
import type { ThemeMode } from './kit.js';
import type { ScreenHost } from './mount.js';
import { DanhSachDon } from './screens/DanhSachDon.js';
import { DonHang } from './screens/DonHang.js';
import { MyTasksScreen } from './screens/MyTasksScreen.js';
import type { Lang } from './text.js';

export interface AppProps { host: ScreenHost; lang: Lang; locale: string; theme: ThemeMode }

/** Chọn màn theo đường dẫn của module: `/` danh sách, `/don/new` đơn mới, `/don/<id>` một đơn, `/viec` việc của bạn. */
export function App({ host, lang }: AppProps) {
  const [path, setPath] = useState('/');
  useEffect(() => host.onLocationChange(setPath), [host]);
  // Các màn gọi API qua host.api; một host chỉ để thử màn (không có api) thì chỉ vẽ được khung.
  const api = useMemo(() => ((host as unknown as AppHost).api ? makeApi(host as unknown as AppHost) : null), [host]);
  if (!api) return null;

  const clean = path.split(/[?#]/)[0] ?? '/';
  const go = (to: string) => host.navigate(to);
  const match = /^\/don\/([^/]+)$/.exec(clean);
  if (match?.[1] === 'new') return <DonHang key="new" api={api} lang={lang} id={null} onBack={() => go('/')} onCreated={(id) => go(`/don/${id}`)} />;
  if (match?.[1]) return <DonHang key={match[1]} api={api} lang={lang} id={match[1]} onBack={() => go('/')} onCreated={() => {}} />;
  if (clean === '/viec') return <MyTasksScreen api={api} lang={lang} onBack={() => go('/')} onOpen={(id) => go(`/don/${id}`)} />;
  return <DanhSachDon api={api} lang={lang} onOpen={(id) => go(`/don/${id}`)} onNew={() => go('/don/new')} onMyTasks={() => go('/viec')} />;
}
