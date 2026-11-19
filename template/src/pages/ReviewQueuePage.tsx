import React, { useMemo, useState } from 'react';
import type { Route } from '../route';
import type { MediaAsset } from '../types';
import { buildReviewItems, performReview, type DataSource } from '../api';
import { KindThumb } from '../KindThumb';

interface Props {
  onNavigate: (route: Route) => void;
  assets: MediaAsset[];
  loading: boolean;
  source: DataSource;
  /** 操作成功后刷新目录 */
  onRefresh?: () => void;
}

type TabKey = 'mine' | 'sensitive' | 'copyright' | 'done';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'mine', label: '待我审核' },
  { key: 'sensitive', label: '敏感复核' },
  { key: 'copyright', label: '版权复核' },
  { key: 'done', label: '已处理' }
];

export function ReviewQueuePage({ onNavigate, assets, loading, source, onRefresh }: Props) {
  const [tab, setTab] = useState<TabKey>('mine');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState('');
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const showToast = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 3200);
  };

  const allItems = useMemo(
    () =>
      buildReviewItems(assets).map((item) => {
        const extra = item as typeof item & { tabs?: string[] };
        const tabs =
          extra.tabs ??
          (
            [
              'mine',
              item.asset.sensitive ? 'sensitive' : null,
              item.asset.copyright === 'pending' ? 'copyright' : null
            ].filter(Boolean) as string[]
          );
        return { ...item, tabs };
      }),
    [assets]
  );

  const doneItems = useMemo(
    () =>
      assets
        .filter((a) => a.status === 'approved' || a.status === 'archived')
        .slice(0, 8)
        .map((asset) => ({
          asset,
          submitter: asset.uploader,
          cataloger: '—',
          wait: '完成',
          waitSub: '已留痕',
          mutex: false,
          flags: [
            {
              text: `已${asset.status === 'approved' ? '通过' : '归档'}`,
              kind: 'verdict' as const
            }
          ],
          tab: 'done' as const,
          tabs: ['done']
        })),
    [assets]
  );

  const counts = useMemo(() => {
    const inTab = (i: { tab?: string; tabs?: string[] }, key: string) =>
      i.tabs ? i.tabs.includes(key) : i.tab === key;
    return {
      mine: allItems.filter((i) => inTab(i, 'mine')).length,
      sensitive: allItems.filter((i) => inTab(i, 'sensitive')).length,
      copyright: allItems.filter((i) => inTab(i, 'copyright')).length,
      done: doneItems.length
    };
  }, [allItems, doneItems]);

  const list = useMemo(() => {
    const base =
      tab === 'done'
        ? doneItems
        : allItems.filter((i) => (i.tabs ? i.tabs.includes(tab) : i.tab === tab));
    if (typeFilter === 'all') return base;
    return base.filter((i) => i.asset.kind === typeFilter);
  }, [tab, typeFilter, allItems, doneItems]);

  const pendingCount = counts.mine + counts.sensitive + counts.copyright;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectable = list.filter((i) => !i.mutex && i.tab !== 'done');

  async function runAction(
    asset: MediaAsset,
    action: 'approve' | 'reject',
    label: string
  ) {
    const contentId = asset.contentId;
    if (!contentId) {
      showToast('err', `缺少内容 ID，无法${label}`);
      return;
    }
    let comment: string | undefined;
    if (action === 'reject') {
      const input = window.prompt('请填写驳回意见（必填）：', '');
      if (input == null) return;
      if (!input.trim()) {
        showToast('err', '驳回必须填写意见');
        return;
      }
      comment = input.trim();
    } else {
      const ok = window.confirm(`确认${label}素材「${asset.title}」？`);
      if (!ok) return;
    }

    setBusyId(asset.contentId || asset.id);
    const result = await performReview(siteIdFromPage(), contentId, action, comment);
    setBusyId('');
    if (!result.ok) {
      showToast('err', result.error || `${label}失败`);
      return;
    }
    showToast(
      'ok',
      action === 'approve'
        ? `已通过：${asset.title}（状态：已发布 / 编目：已通过）`
        : `已驳回：${asset.title}（状态：草稿 / 编目：编目中）${comment ? ` · ${comment}` : ''}`
    );
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(asset.id);
      return next;
    });
    onRefresh?.();
  }

  async function runVerdict(asset: MediaAsset) {
    const input = window.prompt('敏感判定输入：通过 / 驳回', '通过');
    if (input == null) return;
    const verdict = input.trim();
    if (verdict !== '通过' && verdict !== '驳回') {
      showToast('err', '请输入「通过」或「驳回」');
      return;
    }
    await runAction(asset, verdict === '通过' ? 'approve' : 'reject', `判定${verdict}`);
  }

  async function batchRun(action: 'approve' | 'reject') {
    const targets = selectable.filter((i) => selected.has(i.asset.id));
    if (targets.length === 0) {
      showToast('err', '请先勾选可审核项');
      return;
    }
    let comment: string | undefined;
    if (action === 'reject') {
      const input = window.prompt(`批量驳回 ${targets.length} 项，填写意见：`, '');
      if (input == null) return;
      if (!input.trim()) {
        showToast('err', '驳回必须填写意见');
        return;
      }
      comment = input.trim();
    } else if (!window.confirm(`批量通过 ${targets.length} 项？`)) {
      return;
    }

    let okCount = 0;
    let failCount = 0;
    for (const item of targets) {
      if (!item.asset.contentId) {
        failCount++;
        continue;
      }
      setBusyId(item.asset.contentId);
      const r = await performReview(siteIdFromPage(), item.asset.contentId, action, comment);
      if (r.ok) okCount++;
      else failCount++;
    }
    setBusyId('');
    showToast(
      failCount === 0 ? 'ok' : 'err',
      `批量${action === 'approve' ? '通过' : '驳回'}完成：成功 ${okCount}${failCount ? `，失败 ${failCount}` : ''}`
    );
    setSelected(new Set());
    onRefresh?.();
  }

  return (
    <main className="main-content">
      {toast && (
        <div
          className="mutex-banner"
          role="status"
          style={{
            margin: '12px 32px 0',
            background:
              toast.kind === 'ok' ? 'rgba(0,179,65,0.08)' : 'rgba(211,47,47,0.08)',
            borderLeftColor:
              toast.kind === 'ok' ? 'var(--color-status-approved)' : 'var(--color-status-reject)',
            color:
              toast.kind === 'ok'
                ? 'var(--color-status-approved-text)'
                : 'var(--color-status-reject)'
          }}
        >
          <strong>{toast.kind === 'ok' ? '成功' : '失败'}</strong>
          <span>{toast.text}</span>
        </div>
      )}

      <header className="content-header">
        <div className="header-top">
          <h1 className="page-title">
            审核队列 <span className="queue-count">{pendingCount} 待处理</span>
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
              {loading ? '加载中…' : source === 'live' ? `API · 待审 ${allItems.length}` : '无数据'}
            </span>
          </h1>
          <div className="header-actions">
            <button type="button" className="btn btn-secondary" onClick={onRefresh}>
              刷新
            </button>
          </div>
        </div>

        <div className="mutex-banner">
          <strong>四眼审批已开启</strong>
          <span>
            你不能审核<strong>本人提交或本人编目</strong>的素材（peerReviewRequired=true，L2 配置）；
            互斥素材在队列中标灰并禁用终审操作，流程日志完整留痕。
          </span>
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
              {t.key !== 'done' && <span className="badge">{counts[t.key]}</span>}
            </button>
          ))}
        </div>
      </header>

      <div className="content-area">
        <div className="filter-bar">
          {[
            { key: 'all', label: '全部' },
            { key: 'image', label: '图片' },
            { key: 'video', label: '视频' },
            { key: 'audio', label: '音频' },
            { key: 'document', label: '文档' }
          ].map((c) => (
            <button
              key={c.key}
              type="button"
              className={`filter-chip${typeFilter === c.key ? ' active' : ''}`}
              onClick={() => setTypeFilter(c.key)}
            >
              {c.label}
            </button>
          ))}
          <select className="filter-select" defaultValue="all">
            <option value="all">等待时长：全部</option>
            <option>超过 4 小时</option>
            <option>超过 1 天</option>
          </select>
          <select className="filter-select" defaultValue="all">
            <option value="all">事件：全部</option>
            {[...new Set(assets.map((a) => a.event).filter((e) => e && e !== '—'))].map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </div>

        {loading && (
          <div className="empty-state">
            <div className="title">正在从后台加载审核队列…</div>
            <div>由 media_asset.workflow_status_s = review 推导</div>
          </div>
        )}

        {!loading && list.length === 0 && (
          <div className="empty-state">
            <div className="title">队列为空</div>
            <div>
              {source === 'live'
                ? '当前筛选下没有待处理项；可在媒资库将素材置为「待审核」后刷新。'
                : '无已发布素材数据。'}
            </div>
          </div>
        )}

        <div className="queue-list">
          {list.map((item) => {
            const cid = item.asset.contentId || '';
            const busy = busyId && (busyId === cid || busyId === item.asset.id);
            return (
              <div
                key={`${item.asset.contentId || item.asset.id}-${item.tab}`}
                className={`queue-item${item.mutex ? ' mutex-blocked' : ''}`}
              >
                <div
                  className="queue-checkbox"
                  onClick={() => !item.mutex && item.tab !== 'done' && toggle(item.asset.id)}
                />
                <div className="queue-thumb">
                  <KindThumb kind={item.asset.kind} size="queue" title={item.asset.title} />
                </div>
                <div className="queue-info">
                  <div className="queue-title">
                    {item.asset.title}
                    {item.flags.map((f) => (
                      <span key={f.text} className={`flag flag-${f.kind}`}>
                        {f.text}
                      </span>
                    ))}
                  </div>
                  <div className="queue-meta">
                    <span>{item.asset.id}</span>
                    <span>提交: {item.submitter}</span>
                    <span>编目: {item.cataloger}</span>
                    <span>事件: {item.asset.event}</span>
                  </div>
                  <div className="queue-flags">
                    {item.flags.map((f) => (
                      <span key={`m-${f.text}`} className={`flag flag-${f.kind}`}>
                        {f.text}
                      </span>
                    ))}
                  </div>
                  {item.mutex && (
                    <span className="mutex-inline">
                      ⊘ 四眼互斥：你本人提交了此素材，不得执行终审（AC-GOV-002）。
                    </span>
                  )}
                </div>
                <div className="queue-wait">
                  {item.wait}
                  <span className="sub">{item.waitSub}</span>
                </div>
                <div className="queue-actions">
                  <button
                    type="button"
                    className="action-btn"
                    onClick={() => onNavigate({ name: 'detail', id: item.asset.id })}
                  >
                    {item.tab === 'done' ? '查看记录' : '查看详情'}
                  </button>

                  {item.tab !== 'done' && item.asset.sensitive && (
                    <button
                      type="button"
                      className="action-btn"
                      disabled={busy || item.mutex || !cid}
                      onClick={() => void runVerdict(item.asset)}
                    >
                      {busy ? '…' : '判定'}
                    </button>
                  )}

                  {item.tab !== 'done' && !item.mutex && !item.asset.sensitive && (
                    <>
                      <button
                        type="button"
                        className="action-btn reject"
                        disabled={busy || !cid}
                        onClick={() => void runAction(item.asset, 'reject', '驳回')}
                      >
                        {busy ? '…' : '驳回'}
                      </button>
                      <button
                        type="button"
                        className="action-btn approve"
                        disabled={busy || !cid}
                        onClick={() => void runAction(item.asset, 'approve', '通过')}
                      >
                        {busy ? '…' : '通过'}
                      </button>
                    </>
                  )}

                  {item.mutex && (
                    <>
                      <button type="button" className="action-btn reject" disabled>
                        驳回
                      </button>
                      <button type="button" className="action-btn approve" disabled>
                        通过
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {selected.size > 0 && (
          <div className="batch-bar">
            <div className="count">
              已选 <span>{selected.size}</span> 项 · 互斥项已自动排除
            </div>
            <div className="batch-actions">
              <button
                type="button"
                className="batch-btn light"
                onClick={() => setSelected(new Set())}
              >
                取消选择
              </button>
              <button
                type="button"
                className="batch-btn reject"
                disabled={!!busyId}
                onClick={() => void batchRun('reject')}
              >
                批量驳回（需填写意见）
              </button>
              <button
                type="button"
                className="batch-btn approve"
                disabled={!!busyId}
                onClick={() => void batchRun('approve')}
              >
                批量通过
              </button>
            </div>
          </div>
        )}

        {!selected.size && selectable.length > 0 && (
          <div className="batch-bar">
            <div className="count">
              可批量操作 <span>{selectable.length}</span> 项（数据来自后台 API）
            </div>
            <div className="batch-actions">
              <button
                type="button"
                className="batch-btn light"
                onClick={() => setSelected(new Set(selectable.map((s) => s.asset.id)))}
              >
                全选可审项
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

/** 从当前页面取 siteId（与 api.siteIdFromLocation 同源，避免循环依赖时内联）。 */
function siteIdFromPage(): string {
  const fromQuery = new URLSearchParams(window.location.search).get('siteId');
  if (fromQuery && fromQuery.trim()) return fromQuery.trim();
  return window.__POWERCMS_SITE_ID__?.trim() || '';
}
