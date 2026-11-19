import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Route } from './route';
import { DashboardPage } from './pages/DashboardPage';
import { LibraryPage } from './pages/LibraryPage';
import { DetailPage } from './pages/DetailPage';
import { ReviewQueuePage } from './pages/ReviewQueuePage';
import { AiCenterPage } from './pages/AiCenterPage';
import { UploadPage } from './pages/UploadPage';
import {
  loadAssetDetail,
  loadCatalog,
  siteIdFromLocation,
  workflowCounts,
  type AssetDetailResult,
  type MamCatalog
} from './api';
import type { MediaAsset } from './types';
import { SidebarUser } from './SidebarUser';

function parseHash(): Route {
  const raw = (window.location.hash || '#/dashboard').replace(/^#\/?/, '');
  const [seg, param] = raw.split('/');
  if (seg === 'library') {
    return { name: 'library', kind: param && param !== 'all' ? param : undefined };
  }
  if (seg === 'detail' && param) return { name: 'detail', id: decodeURIComponent(param) };
  if (seg === 'review') return { name: 'review' };
  if (seg === 'ai') return { name: 'ai' };
  if (seg === 'upload') return { name: 'upload' };
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
  else if (route.name === 'upload') window.location.hash = '#/upload';
}

const NAV_MAIN = [
  { key: 'dashboard', label: '工作台', icon: '▦' },
  { key: 'library', label: '媒资库', icon: '▤' },
  { key: 'upload', label: '上传素材', icon: '↑' },
  { key: 'review', label: '审核队列', icon: '✓' },
  { key: 'ai', label: 'AI 加工中心', icon: '✦' }
] as const;

const NAV_KINDS = [
  { key: 'all', label: '全部素材', icon: '☰' },
  { key: 'image', label: '图片', icon: '图' },
  { key: 'video', label: '视频', icon: '视' },
  { key: 'audio', label: '音频', icon: '音' },
  { key: 'model3d', label: '三维模型', icon: '模' },
  { key: 'document', label: '文档', icon: '文' }
];

const NAV_ADMIN = [
  { label: '权限配置', icon: '🔐', disabled: true, title: 'L2 配置包 / 平台管理端' },
  { label: '审计日志', icon: '☰', disabled: true, title: '平台审计日志入口' },
  { label: '系统设置', icon: '⚙', disabled: true, title: '平台系统设置入口' }
];

const EMPTY: MamCatalog = {
  source: 'empty',
  assets: [],
  versions: [],
  shareLinks: [],
  folders: [],
  activities: [],
  activityTotal: 0,
  activityStatus: 'error'
};

const SIDEBAR_KEY = 'mam.sidebar.collapsed';

export function App() {
  const [route, setRoute] = useState<Route>(() => parseHash());
  const [catalog, setCatalog] = useState<MamCatalog>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [detailResult, setDetailResult] = useState<AssetDetailResult | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return sessionStorage.getItem(SIDEBAR_KEY) === '1';
    } catch {
      return false;
    }
  });
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

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const activeNav = useMemo(() => {
    if (route.name === 'detail') return 'library';
    if (route.name === 'library') return 'library';
    if (route.name === 'upload') return 'upload';
    return route.name;
  }, [route]);

  const counts = useMemo(() => workflowCounts(catalog.assets), [catalog.assets]);
  const reviewCount = counts.review;

  const detailKey = route.name === 'detail' ? route.id : '';
  useEffect(() => {
    if (!detailKey) {
      setDetailResult(null);
      setDetailLoading(false);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailResult(null);
    loadAssetDetail(siteId, detailKey)
      .then((res) => {
        if (!cancelled) setDetailResult(res);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [siteId, detailKey, reloadKey]);

  const assetForRoute: MediaAsset | null = useMemo(() => {
    if (route.name !== 'detail') return null;
    if (detailResult?.asset) return detailResult.asset;
    return catalog.assets.find((a) => a.id === route.id) || null;
  }, [route, detailResult, catalog.assets]);

  return (
    <div className={`app-container${collapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className={`sidebar${collapsed ? ' is-collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-header-row">
            <button
              type="button"
              className="sidebar-collapse-btn"
              onClick={toggleCollapsed}
              aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
              title={collapsed ? '展开侧栏' : '收起侧栏'}
            >
              {collapsed ? '»' : '«'}
            </button>
            {!collapsed && (
              <div className="sidebar-title" title="融媒体媒资中心">
                融媒体媒资中心
              </div>
            )}
          </div>
          {!collapsed && (
            <div className="sidebar-status">
              {loading
                ? '加载中…'
                : catalog.source === 'live'
                  ? `API 实时 · ${catalog.assets.length} 条`
                  : catalog.source === 'empty'
                    ? `无数据${catalog.error ? `（${catalog.error}）` : ''}`
                    : '演示数据'}
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {NAV_MAIN.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`nav-item${activeNav === item.key ? ' active' : ''}`}
              title={collapsed ? item.label : undefined}
              onClick={() => {
                if (item.key === 'dashboard') go({ name: 'dashboard' });
                else if (item.key === 'library') go({ name: 'library' });
                else if (item.key === 'upload') go({ name: 'upload' });
                else if (item.key === 'review') go({ name: 'review' });
                else go({ name: 'ai' });
              }}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="nav-label">{item.label}</span>
              {!collapsed && item.key === 'review' && reviewCount > 0 ? (
                <span className="nav-count">({reviewCount})</span>
              ) : null}
              {collapsed && item.key === 'review' && reviewCount > 0 ? (
                <span className="nav-dot" aria-label={`${reviewCount} 待审`} />
              ) : null}
            </button>
          ))}

          {/* 展开态：分类 / 管理 / 数据 */}
          {!collapsed && (
            <>
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
                  <span className="nav-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="nav-label">{item.label}</span>
                </button>
              ))}

              <div className="nav-section-title">管理</div>
              {NAV_ADMIN.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="nav-item"
                  disabled={item.disabled}
                  title={item.title}
                >
                  <span className="nav-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="nav-label">{item.label}</span>
                </button>
              ))}

              <div className="nav-section-title">数据</div>
              <button type="button" className="nav-item" onClick={reload}>
                <span className="nav-icon" aria-hidden="true">
                  ↻
                </span>
                <span className="nav-label">刷新 API 数据</span>
              </button>
            </>
          )}
        </nav>

        {/* 收起态：悬停浮动菜单，展示全部图标+名称 */}
        {collapsed && (
          <div className="sidebar-flyout" role="menu" aria-label="展开导航菜单">
            <div className="flyout-group">
              {NAV_MAIN.map((item) => (
                <button
                  key={`f-${item.key}`}
                  type="button"
                  className={`flyout-item${activeNav === item.key ? ' active' : ''}`}
                  onClick={() => {
                    if (item.key === 'dashboard') go({ name: 'dashboard' });
                    else if (item.key === 'library') go({ name: 'library' });
                    else if (item.key === 'upload') go({ name: 'upload' });
                    else if (item.key === 'review') go({ name: 'review' });
                    else go({ name: 'ai' });
                  }}
                >
                  <span className="flyout-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="flyout-label">{item.label}</span>
                  {item.key === 'review' && reviewCount > 0 && (
                    <span className="flyout-badge">{reviewCount}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flyout-divider" />
            <div className="flyout-section">分类</div>
            <div className="flyout-group">
              {NAV_KINDS.map((item) => (
                <button
                  key={`f-kind-${item.key}`}
                  type="button"
                  className={`flyout-item${
                    route.name === 'library' && (route.kind || 'all') === item.key ? ' active' : ''
                  }`}
                  onClick={() =>
                    go(item.key === 'all' ? { name: 'library' } : { name: 'library', kind: item.key })
                  }
                >
                  <span className="flyout-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="flyout-label">{item.label}</span>
                </button>
              ))}
            </div>

            <div className="flyout-divider" />
            <div className="flyout-section">管理</div>
            <div className="flyout-group">
              {NAV_ADMIN.map((item) => (
                <button
                  key={`f-adm-${item.label}`}
                  type="button"
                  className="flyout-item"
                  disabled={item.disabled}
                >
                  <span className="flyout-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="flyout-label">{item.label}</span>
                </button>
              ))}
            </div>

            <div className="flyout-divider" />
            <div className="flyout-group">
              <button type="button" className="flyout-item" onClick={reload}>
                <span className="flyout-icon" aria-hidden="true">
                  ↻
                </span>
                <span className="flyout-label">刷新 API 数据</span>
              </button>
            </div>
          </div>
        )}

        <SidebarUser onAuthChanged={reload} collapsed={collapsed} onExpand={toggleCollapsed} />
      </aside>

      {route.name === 'dashboard' && (
        <DashboardPage
          onNavigate={go}
          assets={catalog.assets}
          loading={loading}
          source={catalog.source}
          error={catalog.error}
          activities={catalog.activities}
          activityTotal={catalog.activityTotal}
          activityStatus={catalog.activityStatus}
          activityMessage={catalog.activityMessage}
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
          versions={detailResult?.versions ?? catalog.versions}
          shareLinks={detailResult?.shareLinks ?? catalog.shareLinks}
          loading={detailLoading || (loading && !detailResult)}
          source={detailResult?.status === 'ok' ? 'live' : catalog.source}
          detailStatus={detailResult?.status}
          detailMessage={detailResult?.message}
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
      {route.name === 'upload' && (
        <UploadPage onNavigate={go} onSaved={reload} />
      )}
    </div>
  );
}
