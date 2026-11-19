import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Route } from './route';
import { DashboardPage } from './pages/DashboardPage';
import { LibraryPage } from './pages/LibraryPage';
import { DetailPage } from './pages/DetailPage';
import { ReviewQueuePage } from './pages/ReviewQueuePage';
import { AiCenterPage } from './pages/AiCenterPage';
import { loadCatalog, siteIdFromLocation, workflowCounts, type MamCatalog } from './api';
import type { MediaAsset } from './types';

function parseHash(): Route {
  const raw = (window.location.hash || '#/dashboard').replace(/^#\/?/, '');
  const [seg, param] = raw.split('/');
  if (seg === 'library') {
    return { name: 'library', kind: param && param !== 'all' ? param : undefined };
  }
  if (seg === 'detail' && param) return { name: 'detail', id: decodeURIComponent(param) };
  if (seg === 'review') return { name: 'review' };
  if (seg === 'ai') return { name: 'ai' };
  return { name: 'dashboard' };
}

function navigate(route: Route) {
  if (route.name === 'dashboard') window.location.hash = '#/dashboard';
  else if (route.name === 'library')
    window.location.hash = route.kind ? `#/library/${route.kind}` : '#/library';
  else if (route.name === 'detail')
    window.location.hash = `#/detail/${encodeURIComponent(route.id)}`;
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

const EMPTY: MamCatalog = {
  source: 'empty',
  assets: [],
  versions: [],
  shareLinks: [],
  folders: []
};

export function App() {
  const [route, setRoute] = useState<Route>(() => parseHash());
  const [catalog, setCatalog] = useState<MamCatalog>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const siteId = useMemo(() => siteIdFromLocation(), []);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadCatalog(siteId)
      .then((next) => {
        if (!cancelled) setCatalog(next);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [siteId, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const go = useCallback((next: Route) => navigate(next), []);

  const activeNav = useMemo(() => {
    if (route.name === 'detail') return 'library';
    if (route.name === 'library') return 'library';
    return route.name;
  }, [route]);

  const counts = useMemo(() => workflowCounts(catalog.assets), [catalog.assets]);
  const reviewCount = counts.review;

  const assetForRoute: MediaAsset | null = useMemo(() => {
    if (route.name !== 'detail') return null;
    return catalog.assets.find((a) => a.id === route.id) || null;
  }, [route, catalog.assets]);

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title">融媒体媒资中心</div>
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--mono)'
            }}
          >
            {loading
              ? '加载中…'
              : catalog.source === 'live'
                ? `API 实时 · ${catalog.assets.length} 条`
                : catalog.source === 'empty'
                  ? `无数据${catalog.error ? `（${catalog.error}）` : ''}`
                  : '演示数据'}
          </div>
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
              {item.key === 'review' && reviewCount > 0 ? ` (${reviewCount})` : ''}
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

          <div className="nav-section-title">数据</div>
          <button type="button" className="nav-item" onClick={reload}>
            刷新 API 数据
          </button>
        </nav>
      </aside>

      {route.name === 'dashboard' && (
        <DashboardPage
          onNavigate={go}
          assets={catalog.assets}
          loading={loading}
          source={catalog.source}
          error={catalog.error}
        />
      )}
      {route.name === 'library' && (
        <LibraryPage
          kind={route.kind}
          onNavigate={go}
          assets={catalog.assets}
          folders={catalog.folders}
          loading={loading}
          source={catalog.source}
          error={catalog.error}
        />
      )}
      {route.name === 'detail' && (
        <DetailPage
          id={route.id}
          onNavigate={go}
          asset={assetForRoute}
          assets={catalog.assets}
          versions={catalog.versions}
          shareLinks={catalog.shareLinks}
          loading={loading}
          source={catalog.source}
        />
      )}
      {route.name === 'review' && (
        <ReviewQueuePage
          onNavigate={go}
          assets={catalog.assets}
          loading={loading}
          source={catalog.source}
        />
      )}
      {route.name === 'ai' && (
        <AiCenterPage
          onNavigate={go}
          assets={catalog.assets}
          loading={loading}
          source={catalog.source}
        />
      )}
    </div>
  );
}
