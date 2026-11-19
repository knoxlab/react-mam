import React, { useMemo, useState } from 'react';
import type { Route } from '../route';
import { AI_TASKS, CAPABILITIES } from '../data';
import type { AiTab } from '../types';

interface Props {
  onNavigate: (route: Route) => void;
}

const TABS: { key: AiTab; label: string; badge?: number }[] = [
  { key: 'pending', label: '待确认建议', badge: 5 },
  { key: 'adopted', label: '已采纳' },
  { key: 'ignored', label: '已忽略' },
  { key: 'sensitive', label: '敏感提示队列', badge: 3 },
  { key: 'tasks', label: '加工任务' }
];

export function AiCenterPage({ onNavigate }: Props) {
  const [tab, setTab] = useState<AiTab>('pending');
  const [handled, setHandled] = useState<Record<string, 'adopted' | 'ignored'>>({});

  const list = useMemo(() => {
    return AI_TASKS.filter((t) => {
      const status = handled[t.id] || t.status;
      if (tab === 'pending') return status === 'pending';
      if (tab === 'adopted') return status === 'adopted';
      if (tab === 'ignored') return status === 'ignored';
      if (tab === 'sensitive') return false;
      if (tab === 'tasks') return status === 'pending' || status === 'adopted';
      return false;
    });
  }, [tab, handled]);

  const pendingCount = AI_TASKS.filter((t) => (handled[t.id] || t.status) === 'pending').length;

  return (
    <main className="main-content">
      <header className="content-header">
        <div className="header-top">
          <h1 className="page-title">AI 加工中心</h1>
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
          模型输出不越过人工终审（规格 7.3 / 7.4）。知识库问答未完成索引初始化前，问答类验收判定为“未就绪”。
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
              {t.badge && t.key !== 'pending' && <span className="badge">{t.badge}</span>}
            </button>
          ))}
        </div>

        {tab === 'sensitive' && (
          <div className="task-list" style={{ marginTop: 16 }}>
            {[
              {
                id: 's1',
                title: '敏感提示 · 政策解读补充材料',
                meta: ['MA-2026-11-030', '赵编辑', '待人工判定'],
                preview: 'AI 提示：涉政策内部表述需复核。提示不自动判定、不阻断（FR-GOV-017）。'
              },
              {
                id: 's2',
                title: '敏感提示 · 教育改革成果展示',
                meta: ['MA-2026-11-007', '吴记者', '已判定：通过（脱敏后可用）'],
                preview: '未成年人影像合规提示；判定结果已留痕。'
              },
              {
                id: 's3',
                title: '敏感提示 · 防汛应急演练现场视频',
                meta: ['MA-2026-11-021', '王记者', '已判定：通过'],
                preview: '政务活动表述提示；判定结果已留痕。'
              }
            ].map((item) => (
              <div key={item.id} className="task-item">
                <div className="task-icon">敏</div>
                <div className="task-info">
                  <div className="task-title">
                    {item.title}
                    <span className="ai-badge">人工复核</span>
                  </div>
                  <div className="task-meta">
                    {item.meta.map((m) => (
                      <span key={m}>{m}</span>
                    ))}
                  </div>
                  <div className="task-preview">{item.preview}</div>
                </div>
                <span className="task-status status-pending">队列</span>
                <div className="task-actions">
                  <button type="button" className="action-btn" onClick={() => onNavigate({ name: 'review' })}>
                    去审核队列
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'tasks' && (
          <div className="gate-note" style={{ marginTop: 16 }}>
            加工任务由管理端 AI 策略驱动：转写、摘要、标签建议、相似查找、文案辅助生成（建议态）。
            场景/人物识别依赖外部媒体 AI，未接入前不可创建。敏感提示任务进入复核队列，不自动判定。
          </div>
        )}

        {tab !== 'sensitive' && tab !== 'tasks' && (
          <div className="task-list" style={{ marginTop: 16 }}>
            {list.length === 0 && (
              <div className="empty-state">
                <div className="title">暂无记录</div>
                <div>该页签下没有任务</div>
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
                    {t.type.includes('标签') ? '标' : t.type.includes('摘要') ? '摘' : t.type.includes('转写') ? '写' : t.type.includes('文案') ? '文' : '视'}
                  </div>
                  <div className="task-info">
                    <div className="task-title">
                      {t.type}
                      <span
                        className="ai-badge"
                        style={
                          t.badgeKind === 'external'
                            ? { background: 'rgba(255,157,0,0.15)', color: 'var(--color-status-progress-text)' }
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
                    {status === 'adopted' ? '已采纳' : status === 'ignored' ? '已忽略' : status === 'external' ? '未接入' : '待确认'}
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
                      <button type="button" className="action-btn">
                        查看审计
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
              经授权与治理的新闻稿件、政策文件与专题资料；索引可见范围与资产 ACL 同源，变更实时生效。
            </div>
          </div>
          <div className="kb-stats">
            <div className="kb-stat">
              <div className="num">2,418</div>
              <div className="label">已索引文档</div>
            </div>
            <div className="kb-stat">
              <div className="num">100%</div>
              <div className="label">权限同源覆盖</div>
            </div>
            <div className="kb-stat">
              <div className="num">今日 36</div>
              <div className="label">问答次数</div>
            </div>
          </div>
          <button type="button" className="btn btn-primary">
            进入问答
          </button>
        </div>
        <div className="citation-note">
          问答与摘要必须携带<strong>来源资产标识与版本</strong>；无法定位来源时显式提示“来源不可确认”，
          无来源结论不得作为业务依据（规格 0.3 / 7.3）。AI 调用全链路留痕，可按主体/对象/时间在审计日志检索。
        </div>
      </div>
    </main>
  );
}
