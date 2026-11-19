import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Route } from '../route';
import {
  KIND_LABEL,
  METRICS,
  STATUS_KEY,
  STATUS_LABEL
} from '../data';
import type { ActivityItem, MediaAsset, WorkflowStatus } from '../types';
import { workflowCounts, type DataSource } from '../api';
import { KindThumb } from '../KindThumb';

interface Props {
  onNavigate: (route: Route) => void;
  assets: MediaAsset[];
  loading: boolean;
  source: DataSource;
  error?: string;
  activities: ActivityItem[];
  activityTotal: number;
  activityStatus: 'ok' | 'unauthorized' | 'error';
  activityMessage?: string;
}

type FilterKey = 'kind' | 'status' | 'time' | 'more';

interface FilterOption {
  value: string;
  label: string;
}

const KIND_OPTIONS: FilterOption[] = [
  { value: '', label: '全部类型' },
  ...Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))
];

const STATUS_OPTIONS: FilterOption[] = [
  { value: '', label: '全部状态' },
  ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))
];

const TIME_OPTIONS: FilterOption[] = [
  { value: '', label: '全部时间' },
  { value: 'today', label: '今日' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' }
];

const MORE_OPTIONS: FilterOption[] = [
  { value: '', label: '不限' },
  { value: 'public', label: '密级：公开' },
  { value: 'internal', label: '密级：内部' },
  { value: 'sensitive', label: '密级：敏感' },
  { value: 'copyright_pending', label: '版权未确认' },
  { value: 'sensitive_flag', label: '有敏感提示' }
];

function daysAgo(dateStr: string): number | null {
  if (!dateStr) return null;
  const t = Date.parse(dateStr.replace(' ', 'T'));
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 86400000;
}

function AssetCard({ asset, onClick }: { asset: MediaAsset; onClick: () => void }) {
  return (
    <article className="asset-card" onClick={onClick} role="button" tabIndex={0}>
      <div className="asset-thumbnail">
        <KindThumb kind={asset.kind} size="grid" title={asset.title} />
        <div className="asset-badges">
          <span className={`asset-badge badge-${STATUS_KEY[asset.status]}`}>
            {STATUS_LABEL[asset.status]}
          </span>
        </div>
      </div>
      <div className="asset-info">
        <div className="asset-title">{asset.title}</div>
        <div className="asset-meta">
          <div className="meta-row">
            <span>ID: {asset.id}</span>
            <span>{asset.size}</span>
          </div>
          <div className="meta-row">
            <span>上传者: {asset.uploader}</span>
            <span>{(asset.uploadedAt || '').slice(0, 10) || '—'}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function FilterDropdown({
  id,
  label,
  options,
  value,
  open,
  onToggle,
  onSelect
}: {
  id: FilterKey;
  label: string;
  options: FilterOption[];
  value: string;
  open: boolean;
  onToggle: (key: FilterKey | null) => void;
  onSelect: (key: FilterKey, value: string) => void;
}) {
  const active = value !== '';
  const current = options.find((o) => o.value === value);
  return (
    <div className="filter-dropdown">
      <button
        type="button"
        className={`action-btn filter-btn${active ? ' is-active' : ''}${open ? ' is-open' : ''}`}
        onClick={() => onToggle(open ? null : id)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {active ? current?.label || label : label}
        <span className="filter-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <ul className="filter-menu" role="listbox" aria-label={label}>
          {options.map((opt) => (
            <li key={opt.value || '__all__'}>
              <button
                type="button"
                role="option"
                aria-selected={value === opt.value}
                className={`filter-option${value === opt.value ? ' selected' : ''}`}
                onClick={() => onSelect(id, opt.value)}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DashboardPage({
  onNavigate,
  assets,
  loading,
  source,
  error,
  activities,
  activityTotal,
  activityStatus,
  activityMessage
}: Props) {
  const [query, setQuery] = useState('');
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [time, setTime] = useState('');
  const [more, setMore] = useState('');
  const filterBarRef = useRef<HTMLDivElement>(null);

  const counts = useMemo(() => workflowCounts(assets), [assets]);
  const recent = useMemo(() => assets.slice(0, 4), [assets]);

  useEffect(() => {
    if (!openFilter) return;
    const onDoc = (e: MouseEvent) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target as Node)) {
        setOpenFilter(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenFilter(null);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [openFilter]);

  const filtered = useMemo(() => {
    // 有筛选或搜索时在全量 assets 上过滤；否则展示最近 4 条
    const hasFilter = !!(kind || status || time || more || query.trim());
    const pool = hasFilter ? assets : recent;
    let list = pool;

    if (kind) list = list.filter((a) => a.kind === kind);
    if (status) list = list.filter((a) => a.status === status);

    if (time) {
      list = list.filter((a) => {
        const d = daysAgo(a.capturedAt || a.uploadedAt);
        if (d == null) return false;
        if (time === 'today') return d <= 1;
        if (time === 'week') return d <= 7;
        if (time === 'month') return d <= 31;
        return true;
      });
    }

    if (more) {
      list = list.filter((a) => {
        if (more === 'public') return a.security === 'public';
        if (more === 'internal') return a.security === 'internal';
        if (more === 'sensitive') return a.security === 'sensitive';
        if (more === 'copyright_pending') return a.copyright === 'pending';
        if (more === 'sensitive_flag') return a.sensitive === true;
        return true;
      });
    }

    const q = query.trim();
    if (q) {
      list = list.filter(
        (a) =>
          a.title.includes(q) ||
          a.id.includes(q) ||
          a.tags.some((t) => t.includes(q)) ||
          a.event.includes(q)
      );
    }

    // 无筛选时保持「最近上传」语义（最多 4 条）；有筛选时返回匹配结果
    return hasFilter ? list.slice(0, 12) : list;
  }, [query, kind, status, time, more, assets, recent]);

  const hasAnyFilter = !!(kind || status || time || more || query.trim());

  const handleSelect = (key: FilterKey, value: string) => {
    if (key === 'kind') setKind(value);
    else if (key === 'status') setStatus(value);
    else if (key === 'time') setTime(value);
    else if (key === 'more') setMore(value);
    setOpenFilter(null);
  };

  const clearFilters = () => {
    setKind('');
    setStatus('');
    setTime('');
    setMore('');
    setQuery('');
    setOpenFilter(null);
  };

  const cards: { key: WorkflowStatus; label: string; count: number; status: string }[] = [
    { key: 'editing', label: '编目中', count: counts.editing, status: '待编目' },
    { key: 'review', label: '待审核', count: counts.review, status: '需要审核' },
    { key: 'approved', label: '已通过', count: counts.approved, status: '可用素材' },
    { key: 'archived', label: '已归档', count: counts.archived, status: '历史素材' }
  ];

  return (
    <main className="main-content">
      <header className="content-header">
        <div className="header-top">
          <h1 className="page-title">
            工作台
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color:
                  source === 'live'
                    ? 'var(--color-status-approved-text)'
                    : 'var(--color-text-secondary)',
                background: source === 'live' ? 'rgba(0,179,65,0.1)' : 'var(--color-section)',
                border: '1px solid var(--color-border)',
                padding: '4px 10px',
                borderRadius: 12
              }}
            >
              {loading ? '加载中…' : source === 'live' ? `API · ${assets.length} 条` : error || '无数据'}
            </span>
          </h1>
          <div className="header-actions">
            <button type="button" className="btn btn-secondary">
              批量操作
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onNavigate({ name: 'upload' })}
            >
              上传素材
            </button>
          </div>
        </div>

        <div className="workflow-summary">
          {cards.map((c) => (
            <div
              key={c.key}
              className={`workflow-card ${STATUS_KEY[c.key]}`}
              onClick={() => onNavigate({ name: 'library' })}
              role="button"
              tabIndex={0}
            >
              <div className="workflow-label">{c.label}</div>
              <div className="workflow-count">{c.count.toLocaleString()}</div>
              <div className="workflow-status">{c.status}</div>
            </div>
          ))}
        </div>

        <div className="metrics-summary">
          {METRICS.map((m) => (
            <div key={m.label} className="metric-card">
              <div className="metric-label">{m.label}</div>
              <div className="metric-values">
                <span className="metric-current">{m.current}</span>
                <span className="metric-baseline">{m.baseline}</span>
                <span className={`metric-delta${m.down ? ' down' : ''}`}>{m.delta}</span>
              </div>
            </div>
          ))}
        </div>
      </header>

      <div className="content-area">
        <div className="search-bar" ref={filterBarRef}>
          <div className="search-input-wrapper">
            <input
              className="search-input"
              placeholder="搜索素材名称、标签、描述..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <FilterDropdown
            id="kind"
            label="类型"
            options={KIND_OPTIONS}
            value={kind}
            open={openFilter === 'kind'}
            onToggle={setOpenFilter}
            onSelect={handleSelect}
          />
          <FilterDropdown
            id="status"
            label="状态"
            options={STATUS_OPTIONS}
            value={status}
            open={openFilter === 'status'}
            onToggle={setOpenFilter}
            onSelect={handleSelect}
          />
          <FilterDropdown
            id="time"
            label="时间"
            options={TIME_OPTIONS}
            value={time}
            open={openFilter === 'time'}
            onToggle={setOpenFilter}
            onSelect={handleSelect}
          />
          <FilterDropdown
            id="more"
            label="更多筛选"
            options={MORE_OPTIONS}
            value={more}
            open={openFilter === 'more'}
            onToggle={setOpenFilter}
            onSelect={handleSelect}
          />
          {hasAnyFilter && (
            <button type="button" className="action-btn" onClick={clearFilters}>
              清空
            </button>
          )}
        </div>

        <h2 className="section-title">
          {hasAnyFilter ? '筛选结果' : '最近上传'}
          {hasAnyFilter && (
            <span className="sub">{filtered.length} 条匹配</span>
          )}
        </h2>
        {loading && (
          <div className="empty-state">
            <div className="title">正在从后台加载素材…</div>
            <div>GET /api/v1/delivery/sites/{"{siteId}"}/contents/query?contentType=media_asset</div>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            <div className="title">{hasAnyFilter ? '无匹配结果' : '暂无已发布素材'}</div>
            <div>
              {hasAnyFilter
                ? '调整类型/状态/时间/更多筛选条件后重试。'
                : error ||
                  '请在管理端录入并发布 media_asset 内容后，此处将显示 API 实时数据。'}
            </div>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="asset-grid">
            {filtered.map((a) => (
              <AssetCard
                key={a.contentId || a.id}
                asset={a}
                onClick={() => onNavigate({ name: 'detail', id: a.id })}
              />
            ))}
          </div>
        )}

        <h2 className="section-title" style={{ marginTop: 28 }}>
          最近活动
          <span className="sub">
            {loading
              ? '加载中…'
              : activityStatus === 'ok'
                ? `审计事件 · 共 ${activityTotal} 条`
                : activityStatus === 'unauthorized'
                  ? '需登录'
                  : activityMessage || '不可用'}
          </span>
        </h2>
        {loading && (
          <div className="empty-state">
            <div className="title">正在从后台加载活动…</div>
            <div>GET /api/v1/sites/{"{siteId}"}/dashboard/activity</div>
          </div>
        )}
        {!loading && activityStatus === 'ok' && activities.length === 0 && (
          <div className="empty-state">
            <div className="title">暂无活动记录</div>
            <div>审计事件为空；在管理端执行创建/发布等操作后此处会更新。</div>
          </div>
        )}
        {!loading && activityStatus === 'unauthorized' && (
          <div className="empty-state">
            <div className="title">活动流需登录查看</div>
            <div>
              {activityMessage ||
                'GET /api/v1/sites/{siteId}/dashboard/activity 需要站点 read 权限。请先登录管理端再打开本页。'}
            </div>
          </div>
        )}
        {!loading && activityStatus === 'error' && activities.length === 0 && (
          <div className="empty-state">
            <div className="title">活动接口不可用</div>
            <div>{activityMessage || error || '请稍后重试'}</div>
          </div>
        )}
        {!loading && activities.length > 0 && (
          <div className="activity-list">
            {activities.map((item, idx) => (
              <div key={`${item.time}-${idx}`} className="activity-item">
                <div
                  className="activity-icon"
                  style={{ background: item.iconBg, color: item.iconColor }}
                >
                  {item.icon}
                </div>
                <div className="activity-details">
                  <div className="activity-action">
                    {item.action}
                    {item.badge && <span className="activity-badge">{item.badge}</span>}
                  </div>
                  <div className="activity-description">{item.description}</div>
                  <div className="activity-time">{item.time}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate({ name: 'review' })}
          >
            进入审核队列
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate({ name: 'ai' })}
          >
            进入 AI 加工中心
          </button>
        </div>

        <div className="gate-note" style={{ marginTop: 16 }}>
          类型快捷入口：
          {Object.entries(KIND_LABEL).map(([k, v]) => (
            <button
              key={k}
              type="button"
              className="action-btn"
              style={{ marginRight: 8, marginTop: 4 }}
              onClick={() => onNavigate({ name: 'library', kind: k })}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
