import React, { useMemo, useState } from 'react';
import type { Route } from '../route';
import {
  ACTIVITIES,
  KIND_ICON,
  KIND_LABEL,
  METRICS,
  STATUS_KEY,
  STATUS_LABEL
} from '../data';
import type { MediaAsset, WorkflowStatus } from '../types';
import { workflowCounts, type DataSource } from '../api';

interface Props {
  onNavigate: (route: Route) => void;
  assets: MediaAsset[];
  loading: boolean;
  source: DataSource;
  error?: string;
}

function AssetCard({ asset, onClick }: { asset: MediaAsset; onClick: () => void }) {
  return (
    <article className="asset-card" onClick={onClick} role="button" tabIndex={0}>
      <div className="asset-thumbnail">
        <span>{KIND_ICON[asset.kind]}</span>
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

export function DashboardPage({ onNavigate, assets, loading, source, error }: Props) {
  const [query, setQuery] = useState('');
  const counts = useMemo(() => workflowCounts(assets), [assets]);
  const recent = useMemo(() => assets.slice(0, 4), [assets]);

  const filtered = useMemo(() => {
    const q = query.trim();
    const pool = q ? assets : recent;
    if (!q) return pool;
    return pool
      .filter(
        (a) =>
          a.title.includes(q) ||
          a.id.includes(q) ||
          a.tags.some((t) => t.includes(q)) ||
          a.event.includes(q)
      )
      .slice(0, 8);
  }, [query, assets, recent]);

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
              onClick={() => onNavigate({ name: 'library' })}
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
        <div className="search-bar">
          <div className="search-input-wrapper">
            <input
              className="search-input"
              placeholder="搜索素材名称、标签、描述..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button type="button" className="action-btn">
            类型
          </button>
          <button type="button" className="action-btn">
            状态
          </button>
          <button type="button" className="action-btn">
            时间
          </button>
          <button type="button" className="action-btn">
            更多筛选
          </button>
        </div>

        <h2 className="section-title">{query ? '搜索结果' : '最近上传'}</h2>
        {loading && (
          <div className="empty-state">
            <div className="title">正在从后台加载素材…</div>
            <div>GET /api/v1/delivery/sites/{"{siteId}"}/contents/query?contentType=media_asset</div>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            <div className="title">{query ? '无匹配结果' : '暂无已发布素材'}</div>
            <div>
              {error
                ? error
                : '请在管理端录入并发布 media_asset 内容后，此处将显示 API 实时数据。'}
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
        </h2>
        {source === 'live' && assets.length > 0 ? (
          <div className="activity-list">
            {assets.slice(0, 5).map((a) => (
              <div key={a.contentId || a.id} className="activity-item">
                <div
                  className="activity-icon"
                  style={{ background: 'rgba(0,102,204,0.1)', color: 'var(--color-accent)' }}
                >
                  {KIND_ICON[a.kind]}
                </div>
                <div className="activity-details">
                  <div className="activity-action">
                    {a.uploader} · {STATUS_LABEL[a.status]}
                    {a.copyright === 'pending' && (
                      <span
                        className="activity-badge"
                        style={{ background: 'rgba(211,47,47,0.1)', color: 'var(--color-status-reject)' }}
                      >
                        版权未确认
                      </span>
                    )}
                  </div>
                  <div className="activity-description">
                    素材「{a.title}」· {a.event !== '—' ? a.event : a.channel}
                  </div>
                  <div className="activity-time">
                    {a.uploadedAt || '—'} · ID: {a.id}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="activity-list">
            {ACTIVITIES.map((item, idx) => (
              <div key={idx} className="activity-item">
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
