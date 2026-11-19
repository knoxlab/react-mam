import React, { useEffect, useMemo, useState } from 'react';
import type { Route } from '../route';
import {
  CURRENT_USER,
  KIND_LABEL,
  LEVEL_LABEL,
  STATUS_KEY,
  STATUS_LABEL
} from '../data';
import type { MediaAsset, ShareLink, VersionItem } from '../types';
import { loadContentOperations, siteIdFromLocation, type ContentOperation, type DataSource } from '../api';
import { KindThumb } from '../KindThumb';

interface Props {
  id: string;
  onNavigate: (route: Route) => void;
  asset: MediaAsset | null;
  assets: MediaAsset[];
  versions: VersionItem[];
  shareLinks: ShareLink[];
  loading: boolean;
  source: DataSource;
  detailStatus?: 'ok' | 'not-found' | 'unauthorized' | 'error' | 'loading';
  detailMessage?: string;
}

export function DetailPage({
  id,
  onNavigate,
  asset,
  assets,
  versions,
  shareLinks,
  loading,
  source,
  detailStatus,
  detailMessage
}: Props) {
  const [adopted, setAdopted] = useState<Set<string>>(new Set());
  const [operations, setOperations] = useState<ContentOperation[]>([]);
  const [opsLoading, setOpsLoading] = useState(false);
  const [opsError, setOpsError] = useState('');
  const siteId = useMemo(() => siteIdFromLocation(), []);

  const contentKey = asset?.contentId || (asset && /^[0-9a-f-]{36}$/i.test(id) ? id : '') || '';

  useEffect(() => {
    if (!contentKey) {
      setOperations([]);
      setOpsError('');
      return;
    }
    let cancelled = false;
    setOpsLoading(true);
    setOpsError('');
    loadContentOperations(siteId, contentKey)
      .then((ops) => {
        if (cancelled) return;
        setOperations(ops);
        if (ops.length === 0) setOpsError('后台暂无该内容的版本或审计记录');
      })
      .catch(() => {
        if (!cancelled) setOpsError('操作记录加载失败');
      })
      .finally(() => {
        if (!cancelled) setOpsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [siteId, contentKey]);

  const related = useMemo(() => {
    if (!asset) return [];
    return assets
      .filter((a) => a.id !== asset.id)
      .map((other) => {
        let type: 'batch' | 'event' | 'similar' = 'similar';
        if (other.event === asset.event && asset.event && asset.event !== '—') type = 'event';
        else if (other.topic && other.topic === asset.topic) type = 'batch';
        return { id: other.id, title: other.title, type, meta: other.id };
      })
      .slice(0, 4);
  }, [asset, assets]);

  if (loading && !asset) {
    return (
      <main className="main-content">
        <div className="content-area">
          <div className="empty-state">
            <div className="title">正在通过 API 加载内容详情…</div>
            <div>
              GET /api/v1/delivery/sites/{"{siteId}"}/contents/query · asset={id}
            </div>
            <div style={{ marginTop: 8, fontSize: 12 }}>
              登录后还将请求 /api/v1/contents/{"{contentId}"}/versions 与 shares
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!asset && detailStatus === 'not-found') {
    return (
      <main className="main-content">
        <div className="content-area">
          <div className="empty-state">
            <div className="title">素材不存在或无权查看</div>
            <div>
              {detailMessage || `编号 ${id} 无对应已发布记录（权限前置过滤）`}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={() => onNavigate({ name: 'library' })}
            >
              返回媒资库
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!asset) {
    return (
      <main className="main-content">
        <div className="content-area">
          <div className="empty-state">
            <div className="title">素材不存在或无权查看</div>
            <div>
              {detailMessage || `编号 ${id} 无对应已发布记录（权限前置过滤）`}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={() => onNavigate({ name: 'library' })}
            >
              返回媒资库
            </button>
          </div>
        </div>
      </main>
    );
  }

  const canFinalReview = !CURRENT_USER.isSubmitter && CURRENT_USER.canReview;
  const mutexBlocked = asset.uploader === CURRENT_USER.name;
  const bannerClass =
    asset.status === 'approved'
      ? 'approved'
      : asset.status === 'review'
        ? 'review'
        : asset.status === 'editing'
          ? 'progress'
          : 'archived';

  const versionList: VersionItem[] =
    versions.length > 0
      ? versions
      : [
          {
            label: asset.version || 'v1',
            current: true,
            note: '当前已发布快照',
            actor: asset.uploader,
            at: asset.uploadedAt,
            change: '发布版本'
          }
        ];

  const linkList: ShareLink[] =
    shareLinks.length > 0
      ? shareLinks
      : [
          {
            name: '暂无分享链接',
            url: '—',
            used: '—',
            expires: '可在管理端签发（到期/限次/吊销）'
          }
        ];

  const aiSuggestions = [
    {
      key: 'tags',
      label: '标签建议',
      badge: 'AI 辅助 · 建议态',
      content: `建议添加标签: ${asset.aiTags.length ? asset.aiTags.map((t) => `#${t}`).join(' ') : (asset.tags.length ? asset.tags.map((t) => `#${t}`).join(' ') : '#待生成')}`,
      disabled: false
    },
    {
      key: 'summary',
      label: '内容摘要',
      badge: '底座能力',
      content: `AI 生成的内容摘要：${asset.description}`,
      disabled: false
    },
    {
      key: 'transcript',
      label: '语音转写',
      badge: '底座能力',
      content:
        asset.kind === 'video' || asset.kind === 'audio'
          ? '[00:00:12] （转写全文支持时间码跳转——底座已具备音视频转写能力，优先于视觉识别展示。）'
          : '（本素材无音频轨。视频/音频素材在此展示转写全文，支持时间码跳转——底座已具备音视频转写能力，优先于视觉识别展示。）',
      disabled: false
    },
    {
      key: 'vision',
      label: '场景 / 人物识别',
      badge: '外部依赖 · P2 · 未接入',
      content:
        '镜头、场景、人物、物体识别依赖外部媒体 AI 能力，当前环境未对接，该功能降级为 P2 且不承诺召回率（规格 10.4 第 3 条）。',
      disabled: true
    }
  ];

  return (
    <div className="detail-page">
      <div className="detail-main-scroll">
        <header className="content-header">
          <div className="breadcrumb">
            <span className="breadcrumb-link" onClick={() => onNavigate({ name: 'library' })}>
              媒资库
            </span>
            <span>›</span>
            <span>{asset.title}</span>
          </div>
          <div className="header-actions" style={{ justifyContent: 'flex-end' }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color:
                  detailStatus === 'ok'
                    ? 'var(--color-status-approved-text)'
                    : 'var(--color-text-secondary)',
                background:
                  detailStatus === 'ok' ? 'rgba(0,179,65,0.1)' : 'var(--color-section)',
                border: '1px solid var(--color-border)',
                padding: '4px 10px',
                borderRadius: 12
              }}
            >
              {loading
                ? '详情 API 加载中…'
                : detailStatus === 'ok'
                  ? `详情 API${detailMessage ? ` · ${detailMessage}` : ''}`
                  : detailMessage || '详情 API'}
            </span>
            <span className="mutex-hint">
              当前身份：{CURRENT_USER.name}（{CURRENT_USER.role}）
              <br />
              四眼审批：提交人与终审人须分离
            </span>
            <button type="button" className="btn btn-secondary">
              编辑
            </button>
            <button type="button" className="btn btn-secondary">
              下载
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={!canFinalReview || mutexBlocked}
              title={mutexBlocked ? '提交人不得终审本人提交素材' : '当前角色无终审权'}
            >
              驳回
            </button>
            <button
              type="button"
              className="btn btn-success"
              disabled={!canFinalReview || mutexBlocked}
              title={
                mutexBlocked
                  ? '提交人不得终审本人提交素材（peerReviewRequired）'
                  : '当前角色无终审权'
              }
            >
              通过审核
            </button>
          </div>
        </header>

        <div className="content-area">
          <div className={`status-banner ${bannerClass}`}>
            <div className="banner-left">
              <span>
                {asset.status === 'approved'
                  ? '✓ 已通过审核'
                  : asset.status === 'review'
                    ? '● 待审核'
                    : asset.status === 'editing'
                      ? '✎ 编目中'
                      : '▣ 已归档'}
              </span>
              <span className={`level-badge level-${asset.security}`}>
                密级：{LEVEL_LABEL[asset.security]}
              </span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 400 }}>
              {asset.uploadedAt} · 上传者: {asset.uploader}
            </span>
          </div>
          <div className="asset-preview">
            <KindThumb kind={asset.kind} size="detail" title={asset.title} />
          </div>

          <section className="metadata-section">
            <h2 className="section-title">基本信息</h2>
            <div className="metadata-grid">
              <div className="metadata-field">
                <div className="field-label">资产 ID</div>
                <div className="field-value">{asset.id}</div>
              </div>
              <div className="metadata-field">
                <div className="field-label">素材类型</div>
                <div className="field-value">
                  {KIND_LABEL[asset.kind]} ({asset.mime})
                </div>
              </div>
              <div className="metadata-field">
                <div className="field-label">标题</div>
                <div className="field-value">{asset.title}</div>
              </div>
              <div className="metadata-field">
                <div className="field-label">文件大小</div>
                <div className="field-value">{asset.size}</div>
              </div>
              <div className="metadata-field">
                <div className="field-label">分辨率/规格</div>
                <div className="field-value">{asset.resolution || '—'}</div>
              </div>
              <div className="metadata-field">
                <div className="field-label">拍摄时间</div>
                <div className="field-value">{asset.capturedAt || '—'}</div>
              </div>
              <div className="metadata-field">
                <div className="field-label">来源</div>
                <div className="field-value">{asset.source}</div>
              </div>
              <div className="metadata-field">
                <div className="field-label">当前版本</div>
                <div className="field-value">{asset.version}（不可变快照）</div>
              </div>
              <div className="metadata-field">
                <div className="field-label">上传者</div>
                <div className="field-value">{asset.uploader}</div>
              </div>
              <div className="metadata-field">
                <div className="field-label">上传时间</div>
                <div className="field-value">{asset.uploadedAt}</div>
              </div>
              <div className="metadata-field full">
                <div className="field-label">描述</div>
                <div className="field-value">{asset.description}</div>
              </div>
              <div className="metadata-field full">
                <div className="field-label">标签</div>
                <div className="tags-input">
                  {asset.tags.map((t) => (
                    <span key={t} className="tag-removable">
                      {t} ×
                    </span>
                  ))}
                  <span className="tag-add">+ 添加标签</span>
                </div>
              </div>
            </div>
          </section>

          <section className="version-section">
            <h2 className="section-title">版本历史</h2>
            <div className="version-list">
              {versionList.map((v, idx) => (
                <div key={`${v.label}-${idx}`} className={`version-item${v.current ? ' current' : ''}`}>
                  <span className="version-tag">
                    {v.label}
                    {v.current ? ' · 当前' : ''}
                  </span>
                  <div className="version-info">
                    {v.note}
                    <div className="meta">
                      {v.actor} · {v.at} · 变更：{v.change}
                    </div>
                  </div>
                  <div className="version-actions">
                    <button type="button" className="action-btn">
                      对比差异
                    </button>
                    {!v.current && (
                      <button type="button" className="action-btn">
                        基于此版本新建
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="gate-note">
              回滚以“基于历史版本新建”方式实现，不覆盖历史记录（FR-GOV-003）。
              {versions.length === 0 ? ' 当前未返回 media_version 业务版本行，显示条目当前快照。' : ''}
            </div>
          </section>

          <section className="ai-section">
            <h2 className="section-title">
              AI 生成建议 <span className="ai-badge">AI 辅助 · 建议态</span>
            </h2>
            {aiSuggestions.map((s) => (
              <div key={s.key} className={`ai-suggestion${s.disabled ? ' external' : ''}`}>
                <div className="suggestion-header">
                  <div className="suggestion-label">
                    {s.label}
                    <span
                      className={s.disabled ? 'external-flag' : 'ai-badge'}
                      style={s.disabled ? undefined : { background: 'rgba(0,102,204,0.08)' }}
                    >
                      {s.badge}
                    </span>
                  </div>
                  <div className="suggestion-actions">
                    {s.disabled ? (
                      <button type="button" className="action-btn" disabled>
                        确认
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="action-btn approve"
                          onClick={() => setAdopted((p) => new Set(p).add(s.key))}
                          disabled={adopted.has(s.key)}
                        >
                          {adopted.has(s.key) ? '已采纳' : s.key === 'tags' ? '全部采纳' : '采纳'}
                        </button>
                        <button type="button" className="action-btn">
                          忽略
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="suggestion-content">{s.content}</div>
              </div>
            ))}
          </section>

          <section className="sensitive-section">
            <h2 className="section-title">敏感提示</h2>
            {asset.sensitive ? (
              <div className="sensitive-item">
                <div className="sensitive-header">
                  <span className="sensitive-label">AI 敏感内容提示</span>
                  <span className="sensitive-flag">提示 · 不自动判定</span>
                </div>
                <div className="sensitive-content">{asset.sensitiveNote}</div>
                <div className="sensitive-verdict">
                  <span>
                    <span className="label">判定人：</span>
                    <span className="value">—（待人工判定）</span>
                  </span>
                </div>
                <div className="sensitive-note">
                  判定结果已留痕；提示记录与人工判定均可在审计日志中按对象检索（FR-GOV-007 / FR-GOV-017）。
                </div>
              </div>
            ) : (
              <div className="gate-note">
                当前素材无敏感提示记录。AI 敏感检测结果仅进入人工复核队列，不自动终审、不自动阻断（FR-GOV-017）。
              </div>
            )}
          </section>

          <section className="audit-section">
            <h2 className="section-title">
              操作记录
              <span className="sub">
                {opsLoading
                  ? '加载中…'
                  : operations.length > 0
                    ? `后台 API · ${operations.length} 条`
                    : opsError || '无记录'}
              </span>
            </h2>
            {opsLoading && (
              <div className="empty-state">
                <div className="title">正在从后台加载操作记录…</div>
                <div>GET /api/v1/contents/{"{contentId}"}/versions + dashboard/activity</div>
              </div>
            )}
            {!opsLoading && operations.length === 0 && (
              <div className="empty-state">
                <div className="title">暂无操作记录</div>
                <div>{opsError || '创建、保存、发布等操作后此处会显示后台记录。'}</div>
              </div>
            )}
            {!opsLoading && operations.length > 0 && (
              <div className="audit-timeline">
                {operations.map((a, idx) => (
                  <div key={`${a.at}-${a.action}-${idx}`} className="audit-item">
                    <div className="audit-header">
                      <div className="audit-action">
                        {a.action}
                        <span
                          className="ai-badge"
                          style={{
                            marginLeft: 8,
                            background:
                              a.source === 'audit'
                                ? 'rgba(233,30,99,0.1)'
                                : 'rgba(0,102,204,0.1)',
                            color:
                              a.source === 'audit'
                                ? 'var(--color-status-review-text)'
                                : 'var(--color-accent)'
                          }}
                        >
                          {a.source === 'audit' ? '审计' : '版本'}
                        </span>
                      </div>
                      <div className="audit-time">{a.at || '—'}</div>
                    </div>
                    <div className="audit-details">
                      <span className="audit-user">{a.actor}</span> {a.detail}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="gate-note">
              记录来自后台 <strong>内容版本</strong>（GET /contents/{"{id}"}/versions）与
              <strong>站点审计</strong>（dashboard/activity 中 objectId 命中本条目），
              按时间倒序展示（FR-GOV-007）。
            </div>
          </section>
        </div>
      </div>

      <aside className="detail-sidebar">
        <div className="sidebar-section">
          <h3 className="sidebar-section-title">快速信息</h3>
          <div className="info-row">
            <span className="info-label">状态</span>
            <span
              className="info-value"
              style={{
                color:
                  asset.status === 'approved'
                    ? 'var(--color-status-approved-text)'
                    : asset.status === 'review'
                      ? 'var(--color-status-review-text)'
                      : 'inherit'
              }}
            >
              {STATUS_LABEL[asset.status]}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">密级</span>
            <span className="info-value">
              <span className={`level-badge level-${asset.security}`}>
                {LEVEL_LABEL[asset.security]}
              </span>
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">版权状态</span>
            <span className="info-value">
              {asset.copyright === 'confirmed'
                ? '已确认'
                : asset.copyright === 'third-party'
                  ? '第三方授权'
                  : '未确认'}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">可见范围</span>
            <span className="info-value">{asset.visibleRange}</span>
          </div>
          <div className="info-row">
            <span className="info-label">使用次数</span>
            <span className="info-value">{asset.useCount}</span>
          </div>
          <div className="info-row">
            <span className="info-label">下载次数</span>
            <span className="info-value">{asset.downloadCount}</span>
          </div>
          {asset.copyright === 'pending' && (
            <div className="copyright-warn">版权未确认 · 仅内部可见 · 不得对外授权</div>
          )}
        </div>

        <div className="sidebar-section">
          <h3 className="sidebar-section-title">版权信息</h3>
          <div className="info-row">
            <span className="info-label">版权所有</span>
            <span className="info-value">{asset.copyrightOwner}</span>
          </div>
          <div className="info-row">
            <span className="info-label">授权范围</span>
            <span className="info-value">{asset.license}</span>
          </div>
          <div className="info-row">
            <span className="info-label">授权期限</span>
            <span className="info-value">{asset.licenseUntil || '—'}</span>
          </div>
          <div className="gate-note">
            授权由<strong>发布门卫校验 + 人工终审</strong>执行，不作为 ACL 自动拦截依据（规格 5.4 / 10.4）。
            版权口径的“授权期限”≠ ACL 有效期。
          </div>
        </div>

        <div className="sidebar-section">
          <h3 className="sidebar-section-title">分享链接</h3>
          {linkList.map((s, idx) => (
            <div key={`${s.name}-${idx}`} className="share-link-item">
              <strong>{s.name}</strong>
              <div className="share-link-url">{s.url}</div>
              <div className="share-link-meta">
                <span className={s.expired ? 'expired' : undefined}>{s.used}</span>
                <span>{s.expires}</span>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: 4 }}>
            + 生成分享链接（到期/限次）
          </button>
          <div className="gate-note">
            有效期授权通过分享链接承载：支持到期、限次、吊销（规格 5.4 第 3 条方案 c）。
          </div>
        </div>

        <div className="sidebar-section">
          <h3 className="sidebar-section-title">分类归属（七维）</h3>
          <div className="info-row">
            <span className="info-label">事件</span>
            <span className="info-value">{asset.event}</span>
          </div>
          <div className="info-row">
            <span className="info-label">栏目</span>
            <span className="info-value">{asset.channel}</span>
          </div>
          <div className="info-row">
            <span className="info-label">专题</span>
            <span className="info-value">{asset.topic || '—'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">时间</span>
            <span className="info-value">
              {(asset.capturedAt || asset.uploadedAt || '').slice(0, 10) || '—'}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">地点</span>
            <span className="info-value">{asset.place}</span>
          </div>
          <div className="info-row">
            <span className="info-label">人物</span>
            <span className="info-value">{asset.persons.length ? asset.persons.join('、') : '—'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">主题</span>
            <span className="info-value">{asset.subject}</span>
          </div>
          <div className="gate-note">七维均可反查检索（FR-GOV-011 / AC-GOV-001）。</div>
        </div>

        <div className="sidebar-section">
          <div className="action-section">
            <div className="action-title">操作</div>
            <div className="action-buttons">
              <button type="button" className="btn btn-secondary" style={{ width: '100%' }}>
                下载原文件
              </button>
              <button type="button" className="btn btn-secondary" style={{ width: '100%' }}>
                添加到专题
              </button>
              <button type="button" className="btn btn-secondary" style={{ width: '100%' }}>
                复制链接
              </button>
              <button type="button" className="btn btn-secondary" style={{ width: '100%' }}>
                导出元数据
              </button>
            </div>
          </div>
        </div>

        <div className="sidebar-section">
          <h3 className="sidebar-section-title">相关素材</h3>
          {related.map((r) => (
            <div
              key={r.id}
              className="related-item"
              onClick={() => onNavigate({ name: 'detail', id: r.id })}
            >
              <div className="related-title">
                {r.title}
                <span className={`related-type ${r.type === 'similar' ? 'similar' : 'same'}`}>
                  {r.type === 'similar' ? '语义相似' : r.type === 'event' ? '同事件' : '同批次'}
                </span>
              </div>
              <div className="related-meta">{r.meta}</div>
            </div>
          ))}
          {related.length === 0 && <div className="gate-note">暂无关联素材。</div>}
          <div className="gate-note">
            语义相似查找受权限前置过滤约束（FR-GOV-015 / 7.2）。
          </div>
        </div>
      </aside>
    </div>
  );
}
