import React, { useMemo, useState } from 'react';
import type { Route } from '../route';
import { CAPABILITIES } from '../data';
import type { MediaAsset } from '../types';
import type { DataSource } from '../api';

interface Props {
  onNavigate: (route: Route) => void;
  assets: MediaAsset[];
  loading: boolean;
  source: DataSource;
}

type AiTab = 'pending' | 'adopted' | 'ignored' | 'sensitive' | 'tasks';

interface TaskRow {
  id: string;
  type: string;
  badge: string;
  badgeKind: 'ai' | 'base' | 'external';
  assetId: string;
  assetTitle: string;
  at: string;
  preview: string;
  status: 'pending' | 'adopted' | 'ignored' | 'external';
}

function buildTasks(assets: MediaAsset[]): TaskRow[] {
  const rows: TaskRow[] = [];
  assets.forEach((a, idx) => {
    if (a.aiTags.length > 0 || a.tags.length > 0) {
      rows.push({
        id: `tags-${a.id}`,
        type: '标签建议',
        badge: 'AI 辅助 · 建议态',
        badgeKind: 'ai',
        assetId: a.id,
        assetTitle: a.title,
        at: a.uploadedAt || '—',
        preview: `建议标签：${(a.aiTags.length ? a.aiTags : a.tags)
          .slice(0, 4)
          .map((t) => `#${t}`)
          .join(' ')}`,
        status: 'pending'
      });
    }
    if (a.description) {
      rows.push({
        id: `summary-${a.id}`,
        type: '内容摘要',
        badge: '底座能力',
        badgeKind: 'base',
        assetId: a.id,
        assetTitle: a.title,
        at: a.uploadedAt || '—',
        preview: a.description.slice(0, 120) + (a.description.length > 120 ? '……' : ''),
        status: 'pending'
      });
    }
    if (a.kind === 'video' || a.kind === 'audio') {
      rows.push({
        id: `asr-${a.id}`,
        type: '语音转写',
        badge: '底座能力',
        badgeKind: 'base',
        assetId: a.id,
        assetTitle: a.title,
        at: a.uploadedAt || '—',
        preview: '[00:00:12] 转写全文待生成/预览…（支持时间码跳转）',
        status: 'pending'
      });
    }
    if (a.sensitive) {
      rows.push({
        id: `sens-${a.id}`,
        type: '敏感提示复核',
        badge: '人工复核',
        badgeKind: 'ai',
        assetId: a.id,
        assetTitle: a.title,
        at: a.uploadedAt || '—',
        preview: a.sensitiveNote || 'AI 敏感提示进入复核队列，不自动判定。',
        status: 'pending'
      });
    }
    if (idx === 0) {
      rows.push({
        id: 'vision-demo',
        type: '场景 / 人物识别',
        badge: '外部依赖 · P2 · 未接入',
        badgeKind: 'external',
        assetId: a.id,
        assetTitle: a.title,
        at: '—',
        preview:
          '镜头、场景、人物、物体识别依赖外部媒体 AI，当前环境未对接，任务不可创建（规格 7.4 / 10.4）。',
        status: 'external'
      });
    }
  });
  return rows;
}

const TABS: { key: AiTab; label: string }[] = [
  { key: 'pending', label: '待确认建议' },
  { key: 'adopted', label: '已采纳' },
  { key: 'ignored', label: '已忽略' },
  { key: 'sensitive', label: '敏感提示队列' },
  { key: 'tasks', label: '加工任务' }
];

export function AiCenterPage({ onNavigate, assets, loading, source }: Props) {
  const [tab, setTab] = useState<AiTab>('pending');
  const [handled, setHandled] = useState<Record<string, 'adopted' | 'ignored'>>({});

  const baseTasks = useMemo(() => buildTasks(assets), [assets]);

  const list = useMemo(() => {
    return baseTasks.filter((t) => {
      const status = handled[t.id] || t.status;
      if (tab === 'pending') return status === 'pending';
      if (tab === 'adopted') return status === 'adopted';
      if (tab === 'ignored') return status === 'ignored';
      if (tab === 'tasks') return status === 'pending' || status === 'adopted' || status === 'external';
      return false;
    });
  }, [tab, handled, baseTasks]);

  const pendingCount = baseTasks.filter((t) => (handled[t.id] || t.status) === 'pending').length;
  const sensitiveAssets = assets.filter((a) => a.sensitive);

  return (
    <main className="main-content">
      <header className="content-header">
        <div className="header-top">
          <h1 className="page-title">
            AI 加工中心
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: source === 'live' ? 'var(--color-status-approved-text)' : 'var(--color-text-secondary)',
                background: source === 'live' ? 'rgba(0,179,65,0.1)' : 'var(--color-section)',
                border: '1px solid var(--color-border)',
                padding: '4px 10px',
                borderRadius: 12
              }}
            >
              {loading
                ? '加载中…'
                : source === 'live'
                  ? `API · 素材 ${assets.length}`
                  : '无数据'}
            </span>
          </h1>
          <div className="header-actions">
            <span className="policy-status ok">站点 AI 策略已初始化</span>
            <button type="button" className="btn btn-secondary">
              评测集状态
            </button>
            <button type="button" className="btn btn-primary">
              新建加工任务
            </button>
          </div>
        </div>
        <div className="governance-note">
          <strong>治理口径</strong>
          ：AI 产出一律为<strong>建议态</strong>，须人工确认后生效；输出携带来源标识，权限过滤发生在检索与生成之前；
          模型输出不越过人工终审（规格 7.3 / 7.4）。任务列表由后台已发布素材推导。
        </div>
      </header>

      <div className="content-area">
        <div className="section-title">
          能力链状态 <span className="sub">六环节 · 四册一致（规格 7.1）</span>
        </div>
        <div className="capability-grid">
          {CAPABILITIES.map((c) => (
            <div key={c.name} className={`cap-card ${c.kind}`}>
              <div className="cap-name">
                {c.name}
                <span className={`cap-status ${c.kind === 'ok' ? 'on' : 'partial'}`}>{c.status}</span>
              </div>
              <div className="cap-desc">{c.desc}</div>
            </div>
          ))}
        </div>

        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`tab${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {t.key === 'pending' && <span className="badge">{pendingCount}</span>}
              {t.key === 'sensitive' && <span className="badge">{sensitiveAssets.length}</span>}
            </button>
          ))}
        </div>

        {tab === 'sensitive' && (
          <div className="task-list" style={{ marginTop: 16 }}>
            {loading && (
              <div className="empty-state">
                <div className="title">加载中…</div>
              </div>
            )}
            {!loading && sensitiveAssets.length === 0 && (
              <div className="empty-state">
                <div className="title">无敏感提示素材</div>
                <div>后台素材 sensitive_flag_b 为空或未发布。</div>
              </div>
            )}
            {sensitiveAssets.map((a) => (
              <div key={a.id} className="task-item">
                <div className="task-icon">敏</div>
                <div className="task-info">
                  <div className="task-title">
                    敏感提示 · {a.title}
                    <span className="ai-badge">人工复核</span>
                  </div>
                  <div className="task-meta">
                    <span>{a.id}</span>
                    <span>{a.uploader}</span>
                    <span>{a.uploadedAt}</span>
                  </div>
                  <div className="task-preview">{a.sensitiveNote}</div>
                </div>
                <span className="task-status status-pending">队列</span>
                <div className="task-actions">
                  <button
                    type="button"
                    className="action-btn"
                    onClick={() => onNavigate({ name: 'review' })}
                  >
                    去审核队列
                  </button>
                  <button
                    type="button"
                    className="action-btn"
                    onClick={() => onNavigate({ name: 'detail', id: a.id })}
                  >
                    查看详情
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'tasks' && (
          <div className="gate-note" style={{ marginTop: 16 }}>
            加工任务由已发布素材字段推导：标签建议、内容摘要、语音转写、敏感提示。
            场景/人物识别依赖外部媒体 AI，未接入前不可创建。
          </div>
        )}

        {tab !== 'sensitive' && tab !== 'tasks' && (
          <div className="task-list" style={{ marginTop: 16 }}>
            {loading && (
              <div className="empty-state">
                <div className="title">正在从后台加载 AI 任务…</div>
              </div>
            )}
            {!loading && list.length === 0 && (
              <div className="empty-state">
                <div className="title">暂无记录</div>
                <div>{source === 'live' ? '该页签下没有任务。' : '无已发布素材。'}</div>
              </div>
            )}
            {list.map((t) => {
              const status = handled[t.id] || t.status;
              return (
                <div
                  key={t.id}
                  className="task-item"
                  style={status === 'external' ? { opacity: 0.75, borderStyle: 'dashed' } : undefined}
                >
                  <div className="task-icon">
                    {t.type.includes('标签')
                      ? '标'
                      : t.type.includes('摘要')
                        ? '摘'
                        : t.type.includes('转写')
                          ? '写'
                          : t.type.includes('敏感')
                            ? '敏'
                            : '视'}
                  </div>
                  <div className="task-info">
                    <div className="task-title">
                      {t.type}
                      <span
                        className="ai-badge"
                        style={
                          t.badgeKind === 'external'
                            ? {
                                background: 'rgba(255,157,0,0.15)',
                                color: 'var(--color-status-progress-text)'
                              }
                            : undefined
                        }
                      >
                        {t.badge}
                      </span>
                    </div>
                    <div className="task-meta">
                      <span>{t.assetId}</span>
                      <span>{t.assetTitle}</span>
                      <span>{t.at}</span>
                    </div>
                    <div className="task-preview">{t.preview}</div>
                  </div>
                  <span
                    className={`task-status ${
                      status === 'adopted'
                        ? 'status-adopted'
                        : status === 'ignored' || status === 'external'
                          ? 'status-ignored'
                          : 'status-pending'
                    }`}
                  >
                    {status === 'adopted'
                      ? '已采纳'
                      : status === 'ignored'
                        ? '已忽略'
                        : status === 'external'
                          ? '未接入'
                          : '待确认'}
                  </span>
                  <div className="task-actions">
                    {status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          className="action-btn approve"
                          onClick={() => setHandled((h) => ({ ...h, [t.id]: 'adopted' }))}
                        >
                          采纳
                        </button>
                        <button
                          type="button"
                          className="action-btn"
                          onClick={() => setHandled((h) => ({ ...h, [t.id]: 'ignored' }))}
                        >
                          忽略
                        </button>
                      </>
                    ) : status === 'external' ? (
                      <button type="button" className="action-btn" disabled>
                        发起
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="action-btn"
                        onClick={() => onNavigate({ name: 'detail', id: t.assetId })}
                      >
                        查看素材
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="section-title" style={{ marginTop: 28 }}>
          知识库与问答 <span className="sub">来源引用门禁开启（citationGateMode）</span>
        </div>
        <div className="kb-panel">
          <div className="kb-info">
            <div className="name">政务资讯知识库</div>
            <div className="desc">
              经授权与治理的新闻稿件、政策文件与专题资料；索引可见范围与资产 ACL 同源。
              当前台素材 {assets.length} 条（API）。
            </div>
          </div>
          <div className="kb-stats">
            <div className="kb-stat">
              <div className="num">{assets.length}</div>
              <div className="label">当前素材</div>
            </div>
            <div className="kb-stat">
              <div className="num">{pendingCount}</div>
              <div className="label">待确认建议</div>
            </div>
            <div className="kb-stat">
              <div className="num">{sensitiveAssets.length}</div>
              <div className="label">敏感提示</div>
            </div>
          </div>
          <button type="button" className="btn btn-primary">
            进入问答
          </button>
        </div>
        <div className="citation-note">
          问答与摘要必须携带<strong>来源资产标识与版本</strong>；无法定位来源时显式提示“来源不可确认”，
          无来源结论不得作为业务依据（规格 0.3 / 7.3）。
        </div>
      </div>
    </main>
  );
}
