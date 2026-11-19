import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Route } from './route';
import { DashboardPage } from './pages/DashboardPage';
import { LibraryPage } from './pages/LibraryPage';
import { DetailPage } from './pages/DetailPage';
import { ReviewQueuePage } from './pages/ReviewQueuePage';
import { AiCenterPage } from './pages/AiCenterPage';
import { ASSETS, KIND_LABEL } from './data';

function parseHash(): Route {
  const raw = (window.location.hash || '#/dashboard').replace(/^#\/?/, '');
  const [seg, param] = raw.split('/');
  if (seg === 'library') {
    return { name: 'library', kind: param && param !== 'all' ? param : undefined };
  }
  if (seg === 'detail' && param) return { name: 'detail', id: param };
  if (seg === 'review') return { name: 'review' };
  if (seg === 'ai') return { name: 'ai' };
  return { name: 'dashboard' };
}

function navigate(route: Route) {
  if (route.name === 'dashboard') window.location.hash = '#/dashboard';
  else if (route.name === 'library')
    window.location.hash = route.kind ? `#/library/${route.kind}` : '#/library';
  else if (route.name === 'detail') window.location.hash = `#/detail/${route.id}`;
  else if (route.name === 'review') window.location.hash = '#/review';
  else if (route.name === 'ai') window.location.hash = '#/ai';
}

const NAV_MAIN = [
  { key: 'dashboard', label: '工作台' },
  { key: 'library', label: '媒资库' },
  { key: 'review', label: '审核队列' },
  { key: 'ai', label: 'AI 加工中心' }
] as const;

const NAV_KINDS = [
  { key: 'all', label: '全部素材' },
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'audio', label: '音频' },
  { key: 'model3d', label: '三维模型' },
  { key: 'document', label: '文档' }
];

export function App() {
  const [route, setRoute] = useState<Route>(() => parseHash());

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((next: Route) => navigate(next), []);

  const activeNav = useMemo(() => {
    if (route.name === 'detail') return 'library';
    if (route.name === 'library') return 'library';
    return route.name;
  }, [route]);

  const counts = useMemo(() => {
    const c = { editing: 0, review: 0, approved: 0, archived: 0 };
    ASSETS.forEach((a) => {
      c[a.status] += 1;
    });
    return c;
  }, []);

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title">融媒体媒资中心</div>
        </div>
        <nav className="sidebar-nav">
          {NAV_MAIN.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`nav-item${activeNav === item.key ? ' active' : ''}`}
              onClick={() => {
                if (item.key === 'dashboard') go({ name: 'dashboard' });
                else if (item.key === 'library') go({ name: 'library' });
                else if (item.key === 'review') go({ name: 'review' });
                else go({ name: 'ai' });
              }}
            >
              {item.label}
              {item.key === 'review' && counts.review > 0 ? ` (${counts.review})` : ''}
            </button>
          ))}

          <div className="nav-section-title">分类</div>
          {NAV_KINDS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`nav-item${
                route.name === 'library' && (route.kind || 'all') === item.key ? ' active' : ''
              }`}
              onClick={() =>
                go(item.key === 'all' ? { name: 'library' } : { name: 'library', kind: item.key })
              }
            >
              {item.label}
            </button>
          ))}

          <div className="nav-section-title">管理</div>
          <button type="button" className="nav-item" disabled title="L2 配置包 / 平台管理端">
            权限配置
          </button>
          <button type="button" className="nav-item" disabled title="平台审计日志入口">
            审计日志
          </button>
          <button type="button" className="nav-item" disabled title="平台系统设置入口">
            系统设置
          </button>
        </nav>
      </aside>

      {route.name === 'dashboard' && <DashboardPage onNavigate={go} />}
      {route.name === 'library' && <LibraryPage kind={route.kind} onNavigate={go} />}
      {route.name === 'detail' && <DetailPage id={route.id} onNavigate={go} />}
      {route.name === 'review' && <ReviewQueuePage onNavigate={go} />}
      {route.name === 'ai' && <AiCenterPage onNavigate={go} />}
    </div>
  );
}

export { KIND_LABEL };
