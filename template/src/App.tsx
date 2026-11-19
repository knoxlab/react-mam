import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { fetchCurrentUser, type CurrentUser } from './api';

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

type RailItem = {
  id: string;
  label: string;
  icon: string;
  disabled?: boolean;
  title?: string;
  active?: boolean;
  badge?: number;
  onClick?: () => void;
};

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
  const [visibleCount, setVisibleCount] = useState<number>(99);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [flyoutTop, setFlyoutTop] = useState(52);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [userReady, setUserReady] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const moreBtnRef = useRef<HTMLButtonElement | null>(null);
  const flyoutRef = useRef<HTMLDivElement | null>(null);
  const siteId = useMemo(() => siteIdFromLocation(), []);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser().then((u) => {
      if (cancelled) return;
      setCurrentUser(u.authenticated ? u : null);
      setUserReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const handleUserChange = useCallback((u: CurrentUser | null) => {
    setCurrentUser(u && u.authenticated ? u : null);
  }, []);

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

  const goMain = useCallback(
    (key: string) => {
      if (key === 'dashboard') go({ name: 'dashboard' });
      else if (key === 'library') go({ name: 'library' });
      else if (key === 'upload') go({ name: 'upload' });
      else if (key === 'review') go({ name: 'review' });
      else if (key === 'ai') go({ name: 'ai' });
    },
    [go]
  );

  const goKind = useCallback(
    (key: string) => go(key === 'all' ? { name: 'library' } : { name: 'library', kind: key }),
    [go]
  );

  /** 收起态扁平图标列表（主功能 + 分类 + 管理 + 刷新） */
  const railItems: RailItem[] = useMemo(() => {
    const main: RailItem[] = NAV_MAIN.map((item) => ({
      id: item.key,
      label: item.label,
      icon: item.icon,
      active: activeNav === item.key,
      badge: item.key === 'review' && reviewCount > 0 ? reviewCount : undefined,
      onClick: () => goMain(item.key)
    }));
    const kinds: RailItem[] = NAV_KINDS.map((item) => {
      const libKind = route.name === 'library' && route.kind ? route.kind : 'all';
      return {
        id: `kind-${item.key}`,
        label: item.label,
        icon: item.icon,
        active: route.name === 'library' && libKind === item.key,
        onClick: () => goKind(item.key)
      };
    });
    const admin: RailItem[] = NAV_ADMIN.map((item) => ({
      id: `adm-${item.label}`,
      label: item.label,
      icon: item.icon,
      disabled: item.disabled,
      title: item.title
    }));
    const refresh: RailItem[] = [
      { id: 'refresh', label: '刷新 API 数据', icon: '↻', onClick: reload }
    ];
    return [...main, ...kinds, ...admin, ...refresh];
  }, [
    activeNav,
    reviewCount,
    route,
    goMain,
    goKind,
    reload
  ]);

  const overflow = collapsed && visibleCount < railItems.length;

  // 收起时测量：尽量多放图标，放不下则预留「更多」按钮
  useEffect(() => {
    if (!collapsed) {
      setVisibleCount(99);
      setFlyoutOpen(false);
      return;
    }
    const measure = () => {
      const nav = navRef.current;
      if (!nav) return;
      const moreH = 48;
      const itemH = 40;
      const avail = nav.clientHeight - moreH;
      const max = Math.max(1, Math.floor(avail / itemH));
      setVisibleCount(Math.min(railItems.length, max));
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro && navRef.current) ro.observe(navRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [collapsed, railItems.length]);

  // 点击/焦点离开更多按钮或浮动菜单时自动隐藏
  useEffect(() => {
    if (!flyoutOpen) return;
    const onDocPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (moreBtnRef.current?.contains(t) || flyoutRef.current?.contains(t)) return;
      setFlyoutOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFlyoutOpen(false);
    };
    document.addEventListener('mousedown', onDocPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [flyoutOpen]);

  // 浮动菜单与「更多」按钮垂直对齐（紧邻）
  useEffect(() => {
    if (!flyoutOpen || !moreBtnRef.current || !sidebarRef.current) return;
    const update = () => {
      const btn = moreBtnRef.current?.getBoundingClientRect();
      const side = sidebarRef.current?.getBoundingClientRect();
      if (!btn || !side) return;
      setFlyoutTop(Math.max(0, btn.top - side.top));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [flyoutOpen, visibleCount, overflow, collapsed]);

  /** 焦点离开「更多」或菜单时收起 */
  const handleMoreBlur = (e: React.FocusEvent<HTMLElement>) => {
    const next = e.relatedTarget as Node | null;
    if (!next) {
      setFlyoutOpen(false);
      return;
    }
    if (moreBtnRef.current?.contains(next) || flyoutRef.current?.contains(next)) return;
    setFlyoutOpen(false);
  };

  const handleFlyoutBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (!next) {
      setFlyoutOpen(false);
      return;
    }
    if (flyoutRef.current?.contains(next) || moreBtnRef.current?.contains(next)) return;
    setFlyoutOpen(false);
  };

  const railVisible = collapsed ? railItems.slice(0, visibleCount) : [];
  const railHidden = collapsed ? railItems.slice(visibleCount) : [];

  return (
    <div className={`app-container${collapsed ? ' sidebar-collapsed' : ''}`}>
      <aside
        ref={(el) => {
          sidebarRef.current = el;
        }}
        className={`sidebar${collapsed ? ' is-collapsed' : ''}${flyoutOpen ? ' flyout-open' : ''}`}
      >
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

        <nav
          className="sidebar-nav"
          ref={(el) => {
            navRef.current = el;
          }}
        >
          {/* 展开态：完整文字菜单 */}
          {!collapsed && (
            <>
              {NAV_MAIN.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`nav-item${activeNav === item.key ? ' active' : ''}`}
                  onClick={() => goMain(item.key)}
                >
                  <span className="nav-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="nav-label">{item.label}</span>
                  {item.key === 'review' && reviewCount > 0 ? (
                    <span className="nav-count">({reviewCount})</span>
                  ) : null}
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
                  onClick={() => goKind(item.key)}
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

          {/* 收起态：尽量多图标；放不下时显示「更多」 */}
          {collapsed &&
            railVisible.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nav-item${item.active ? ' active' : ''}`}
                disabled={item.disabled}
                title={item.label}
                onClick={item.onClick}
              >
                <span className="nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="nav-label">{item.label}</span>
                {item.badge ? <span className="nav-dot" aria-label={`${item.badge}`} /> : null}
              </button>
            ))}

          {collapsed && overflow && (
            <button
              ref={moreBtnRef}
              type="button"
              className={`nav-item nav-more-btn${flyoutOpen ? ' active' : ''}`}
              title="更多菜单"
              aria-expanded={flyoutOpen}
              aria-haspopup="menu"
              onClick={() => setFlyoutOpen(true)}
              onMouseEnter={() => setFlyoutOpen(true)}
              onFocus={() => setFlyoutOpen(true)}
              onBlur={handleMoreBlur}
            >
              <span className="nav-icon" aria-hidden="true">
                ⋯
              </span>
              <span className="nav-label">更多</span>
            </button>
          )}
        </nav>

        {/* 收起且放不下时：浮动菜单紧邻「更多」，仅展示其余项 */}
        {collapsed && overflow && (
          <div
            ref={flyoutRef}
            className={`sidebar-flyout${flyoutOpen ? ' is-open' : ''}`}
            role="menu"
            aria-label="更多导航"
            style={{ top: flyoutTop }}
            onMouseEnter={() => setFlyoutOpen(true)}
            onMouseLeave={() => setFlyoutOpen(false)}
            onBlur={handleFlyoutBlur}
            tabIndex={-1}
          >
            <div className="flyout-section">其余 {railHidden.length} 项</div>
            <div className="flyout-group">
              {railHidden.map((item) => (
                <button
                  key={`fo-${item.id}`}
                  type="button"
                  className={`flyout-item${item.active ? ' active' : ''}`}
                  disabled={item.disabled}
                  title={item.title || item.label}
                  onClick={() => {
                    item.onClick?.();
                    setFlyoutOpen(false);
                  }}
                >
                  <span className="flyout-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="flyout-label">{item.label}</span>
                  {item.badge ? <span className="flyout-badge">{item.badge}</span> : null}
                </button>
              ))}
              {railHidden.length === 0 && <div className="flyout-empty">无更多项</div>}
            </div>
          </div>
        )}

        <SidebarUser
          user={currentUser}
          userReady={userReady}
          onUserChange={handleUserChange}
          onAuthChanged={reload}
          collapsed={collapsed}
          onExpand={toggleCollapsed}
        />
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
          currentUser={currentUser}
          onRefresh={reload}
        />
      )}
      {route.name === 'review' && (
        <ReviewQueuePage
          onNavigate={go}
          assets={catalog.assets}
          loading={loading}
          source={catalog.source}
          onRefresh={reload}
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
