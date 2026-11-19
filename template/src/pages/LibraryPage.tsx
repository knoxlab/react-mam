import React, { useMemo, useState } from 'react';
import type { Route } from '../route';
import { ASSETS, KIND_ICON, KIND_LABEL, LEVEL_LABEL, STATUS_KEY, STATUS_LABEL } from '../data';
import type { MediaAsset, SearchMode, ViewMode } from '../types';

interface Props {
  kind?: string;
  onNavigate: (route: Route) => void;
}

const TYPE_CHIPS = [
  { key: 'all', label: '全部' },
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'audio', label: '音频' },
  { key: 'model3d', label: '三维模型' },
  { key: 'document', label: '文档' }
];

const STATUS_CHIPS = [
  { key: 'editing', label: '编目中' },
  { key: 'review', label: '待审核' },
  { key: 'approved', label: '已通过' },
  { key: 'archived', label: '已归档' }
];

const DIMENSIONS = [
  { key: 'event', label: '事件', options: ['全部', '市长调研', '两会报道', '防汛应急'] },
  { key: 'channel', label: '栏目', options: ['全部', '政务要闻', '民生关注', '专题报道'] },
  { key: 'topic', label: '专题', options: ['全部', '高新区建设', '优化营商环境', '文化惠民'] },
  { key: 'time', label: '时间', options: ['全部', '今日', '本周', '本月', '自定义'] },
  { key: 'place', label: '地点', options: ['全部', '高新区', '老城区', '滨江新区'] },
  { key: 'persons', label: '人物', options: ['全部', '张市长', '李副市长', '园区主任'] },
  { key: 'subject', label: '主题', options: ['全部', '经济发展', '民生保障', '生态保护'] }
];

function AssetCard({
  asset,
  selected,
  onToggle,
  onOpen
}: {
  asset: MediaAsset;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <article
      className={`asset-card${selected ? ' selected' : ''}`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
    >
      <div
        className="asset-checkbox"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      />
      <div className="asset-thumbnail">
        <span>{KIND_ICON[asset.kind]}</span>
        <div className="asset-badges">
          <span className={`asset-badge badge-${STATUS_KEY[asset.status]}`}>
            {STATUS_LABEL[asset.status]}
          </span>
          <span className={`badge-level level-${asset.security}`}>
            {LEVEL_LABEL[asset.security]}
          </span>
        </div>
      </div>
      <div className="asset-info">
        <div className="asset-title">{asset.title}</div>
        <div className="asset-tags">
          {asset.tags.slice(0, 3).map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
        {asset.copyright === 'pending' && (
          <div className="copyright-flag">版权未确认 · 仅内部可见</div>
        )}
        <div className="asset-meta">
          <div className="meta-row">
            <span>{asset.id}</span>
            <span>{asset.size}</span>
          </div>
          <div className="meta-row">
            <span>{asset.uploader}</span>
            <span>{(asset.capturedAt || asset.uploadedAt).slice(0, 10)}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

export function LibraryPage({ kind, onNavigate }: Props) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('keyword');
  const [typeKey, setTypeKey] = useState(kind || 'all');
  const [statusKey, setStatusKey] = useState('all');
  const [view, setView] = useState<ViewMode>('grid');
  const [groupTopic, setGroupTopic] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dims, setDims] = useState<Record<string, string>>(() =>
    Object.fromEntries(DIMENSIONS.map((d) => [d.key, '全部']))
  );

  const filtered = useMemo(() => {
    let list = ASSETS.slice();
    if (typeKey !== 'all') list = list.filter((a) => a.kind === typeKey);
    if (statusKey !== 'all') list = list.filter((a) => a.status === statusKey);
    if (dims.event && dims.event !== '全部') list = list.filter((a) => a.event === dims.event);
    if (dims.channel && dims.channel !== '全部') list = list.filter((a) => a.channel === dims.channel);
    if (dims.topic && dims.topic !== '全部') list = list.filter((a) => a.topic === dims.topic);
    if (dims.place && dims.place !== '全部') list = list.filter((a) => a.place === dims.place);
    if (dims.subject && dims.subject !== '全部') list = list.filter((a) => a.subject === dims.subject);
    if (dims.persons && dims.persons !== '全部')
      list = list.filter((a) => a.persons.includes(dims.persons));
    const q = query.trim();
    if (q) {
      list = list.filter((a) => {
        const hay = [
          a.title,
          a.id,
          a.description,
          a.event,
          a.channel,
          a.topic || '',
          a.place,
          a.subject,
          ...a.tags,
          ...a.persons
        ].join(' ');
        if (mode === 'semantic') {
          // 演示：语义模式按关键词命中 + 标题模糊
          return hay.includes(q) || a.title.includes(q.slice(0, 2));
        }
        return hay.includes(q);
      });
    }
    return list;
  }, [query, mode, typeKey, statusKey, dims]);

  const grouped = useMemo(() => {
    if (!groupTopic) return null;
    const map = new Map<string, MediaAsset[]>();
    filtered.forEach((a) => {
      const key = a.topic || '未分专题';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return Array.from(map.entries());
  }, [groupTopic, filtered]);

  const timelineGroups = useMemo(() => {
    const map = new Map<string, MediaAsset[]>();
    filtered.forEach((a) => {
      const key = (a.capturedAt || a.uploadedAt).slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderCards = (list: MediaAsset[]) => (
    <div className="asset-grid">
      {list.map((a) => (
        <AssetCard
          key={a.id}
          asset={a}
          selected={selected.has(a.id)}
          onToggle={() => toggle(a.id)}
          onOpen={() => onNavigate({ name: 'detail', id: a.id })}
        />
      ))}
    </div>
  );

  return (
    <>
      <aside className="directory-panel">
        <div className="directory-header">
          <span>栏目目录</span>
          <span className="directory-hint">L2 配置</span>
        </div>
        <div className="directory-tree">
          <div className="tree-group-label">事件</div>
          <div className={`tree-item${!dims.event || dims.event === '全部' ? ' active' : ''}`}
            onClick={() => setDims((d) => ({ ...d, event: '全部' }))}
          >
            全部事件 <span className="tree-badge">487</span>
          </div>
          {['市长调研', '两会报道', '防汛应急'].map((e) => (
            <div
              key={e}
              className={`tree-item level-2${dims.event === e ? ' active' : ''}`}
              onClick={() => setDims((d) => ({ ...d, event: e }))}
            >
              {e} <span className="tree-badge">{e === '市长调研' ? 32 : e === '两会报道' ? 128 : 56}</span>
            </div>
          ))}

          <div className="tree-group-label">栏目</div>
          {['政务要闻', '民生关注', '专题报道'].map((c) => (
            <div
              key={c}
              className={`tree-item${dims.channel === c ? ' active' : ''}`}
              onClick={() => setDims((d) => ({ ...d, channel: d.channel === c ? '全部' : c }))}
            >
              {c} <span className="tree-badge">{c === '政务要闻' ? 203 : c === '民生关注' ? 145 : 139}</span>
            </div>
          ))}

          <div className="tree-group-label">专题</div>
          {['高新区建设', '优化营商环境', '文化惠民'].map((t) => (
            <div
              key={t}
              className={`tree-item${dims.topic === t ? ' active' : ''}`}
              onClick={() => setDims((d) => ({ ...d, topic: d.topic === t ? '全部' : t }))}
            >
              {t} <span className="tree-badge">{t === '高新区建设' ? 48 : t === '优化营商环境' ? 36 : 22}</span>
            </div>
          ))}
        </div>
      </aside>

      <main className="main-content">
        <header className="content-header">
          <div className="header-top">
            <h1 className="page-title">媒资库</h1>
            <div className="header-actions">
              <button type="button" className="btn btn-secondary">
                导出
              </button>
              <button type="button" className="btn btn-secondary" disabled={selected.size === 0}>
                批量操作{selected.size > 0 ? ` (${selected.size})` : ''}
              </button>
              <button type="button" className="btn btn-primary">
                上传素材
              </button>
            </div>
          </div>

          <div className="search-section">
            <div className="search-bar">
              <div className="search-input-wrapper">
                <input
                  className="search-input"
                  placeholder="搜索素材名称、标签、ID、描述、事件、人物、地点、主题..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="search-mode-toggle">
                <button
                  type="button"
                  className={`search-mode-btn${mode === 'keyword' ? ' active' : ''}`}
                  onClick={() => setMode('keyword')}
                >
                  关键词
                </button>
                <button
                  type="button"
                  className={`search-mode-btn${mode === 'semantic' ? ' active' : ''}`}
                  onClick={() => setMode('semantic')}
                >
                  智能检索
                </button>
              </div>
              <button type="button" className="btn btn-secondary">
                高级搜索
              </button>
            </div>

            {mode === 'semantic' && (
              <div className="semantic-hint">
                智能检索模式：支持自然语言描述（如“去年防汛演练的现场视频”），按语义相关度排序；
                <strong>检索结果已按你的权限前置过滤，无权内容不会出现</strong>（FR-GOV-004）。
              </div>
            )}

            <div className="filter-chips">
              {TYPE_CHIPS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={`filter-chip${typeKey === c.key ? ' active' : ''}`}
                  onClick={() => setTypeKey(c.key)}
                >
                  {c.label}
                </button>
              ))}
              {STATUS_CHIPS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={`filter-chip${statusKey === c.key ? ' active' : ''}`}
                  onClick={() => setStatusKey(statusKey === c.key ? 'all' : c.key)}
                >
                  {c.label}
                </button>
              ))}
              <button
                type="button"
                className={`filter-chip${statusKey === 'all' && typeKey === 'all' ? ' active' : ''}`}
                onClick={() => {
                  setStatusKey('all');
                  setTypeKey('all');
                  setQuery('');
                  setDims(Object.fromEntries(DIMENSIONS.map((d) => [d.key, '全部'])));
                }}
              >
                重置
              </button>
            </div>

            <div className="dimensions-panel">
              <div className="dimensions-header">
                <span>七维筛选</span>
                <span className="hint">
                  事件 / 栏目 / 专题 / 时间 / 地点 / 人物 / 主题 — 抽样素材可按七个维度定位（AC-GOV-001）
                </span>
              </div>
              <div className="dimensions-grid">
                {DIMENSIONS.map((d) => (
                  <div key={d.key} className="dimension-field">
                    <label>{d.label}</label>
                    <select
                      value={dims[d.key] || '全部'}
                      onChange={(e) => setDims((prev) => ({ ...prev, [d.key]: e.target.value }))}
                    >
                      {d.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>

        <div className="content-area">
          <div className="toolbar">
            <div className="toolbar-left">
              <span className="result-count">共 {filtered.length} 个素材</span>
            </div>
            <div className="toolbar-right">
              <button
                type="button"
                className={`group-toggle${groupTopic ? ' active' : ''}`}
                onClick={() => setGroupTopic((v) => !v)}
              >
                专题聚合
              </button>
              <div className="view-toggle">
                {(['grid', 'list', 'timeline'] as ViewMode[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`view-btn${view === v ? ' active' : ''}`}
                    onClick={() => setView(v)}
                  >
                    {v === 'grid' ? '网格' : v === 'list' ? '列表' : '时间轴'}
                  </button>
                ))}
              </div>
              <select className="sort-select" defaultValue="最新上传">
                <option>最新上传</option>
                <option>最早上传</option>
                <option>名称 A-Z</option>
                <option>文件大小</option>
              </select>
            </div>
          </div>

          {filtered.length === 0 && (
            <div className="empty-state">
              <div className="title">无匹配结果</div>
              <div>调整筛选条件或清空搜索后重试</div>
            </div>
          )}

          {view === 'grid' && !groupTopic && renderCards(filtered)}

          {view === 'grid' &&
            groupTopic &&
            grouped?.map(([topic, list]) => (
              <div key={topic} className="group-block">
                <div className="group-title">
                  {topic === '未分专题' ? '未分专题' : `专题：${topic}`}
                  <span className="count">{list.length} 个素材</span>
                </div>
                {renderCards(list)}
              </div>
            ))}

          {view === 'list' && (
            <div className="asset-list">
              {filtered.map((a) => (
                <div
                  key={a.id}
                  className={`asset-list-item${selected.has(a.id) ? ' selected' : ''}`}
                  onClick={() => onNavigate({ name: 'detail', id: a.id })}
                >
                  <div
                    className="list-checkbox"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(a.id);
                    }}
                  />
                  <div className="list-thumbnail">{KIND_ICON[a.kind]}</div>
                  <div className="list-content">
                    <div className="list-title">{a.title}</div>
                    <div className="list-meta">
                      <span>{a.id}</span>
                      <span>{KIND_LABEL[a.kind]}</span>
                      <span>{a.size}</span>
                      <span>{a.uploader}</span>
                      <span>{a.event}</span>
                    </div>
                  </div>
                  <span className={`asset-badge badge-${STATUS_KEY[a.status]}`}>
                    {STATUS_LABEL[a.status]}
                  </span>
                  <span className={`badge-level level-${a.security}`}>{LEVEL_LABEL[a.security]}</span>
                </div>
              ))}
            </div>
          )}

          {view === 'timeline' && (
            <div className="timeline-view">
              {timelineGroups.map(([date, list]) => (
                <div key={date}>
                  <div className="timeline-date">{date}</div>
                  <div className="timeline-items">{renderCards(list)}</div>
                </div>
              ))}
            </div>
          )}

          <div className="pagination" style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 32 }}>
            <button type="button" className="action-btn" disabled>
              上一页
            </button>
            <button type="button" className="action-btn" style={{ background: 'var(--color-accent)', color: '#fff', borderColor: 'var(--color-accent)' }}>
              1
            </button>
            <button type="button" className="action-btn">
              2
            </button>
            <button type="button" className="action-btn">
              3
            </button>
            <button type="button" className="action-btn">
              下一页
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
