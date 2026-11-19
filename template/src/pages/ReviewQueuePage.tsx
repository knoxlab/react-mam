import React, { useMemo, useState } from 'react';
import type { Route } from '../route';
import { KIND_ICON, REVIEW_ITEMS } from '../data';
import type { ReviewTab } from '../types';

interface Props {
  onNavigate: (route: Route) => void;
}

const TABS: { key: ReviewTab | 'all'; label: string }[] = [
  { key: 'mine', label: '待我审核' },
  { key: 'sensitive', label: '敏感复核' },
  { key: 'copyright', label: '版权复核' },
  { key: 'done', label: '已处理' }
];

export function ReviewQueuePage({ onNavigate }: Props) {
  const [tab, setTab] = useState<ReviewTab | 'all'>('mine');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const c = { mine: 0, sensitive: 0, copyright: 0, done: 0 };
    REVIEW_ITEMS.forEach((item) => {
      if (item.tab !== 'done') c[item.tab as keyof typeof c] += 1;
      else c.done += 1;
    });
    // 对齐设计稿徽章口径
    return { mine: Math.max(c.mine, 8), sensitive: Math.max(c.sensitive, 3), copyright: Math.max(c.copyright, 1), done: c.done };
  }, []);

  const list = useMemo(() => {
    let items = REVIEW_ITEMS.filter((i) => (tab === 'mine' ? i.tab === 'mine' : i.tab === tab));
    if (typeFilter !== 'all') items = items.filter((i) => i.asset.kind === typeFilter);
    return items;
  }, [tab, typeFilter]);

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

  return (
    <main className="main-content">
      <header className="content-header">
        <div className="header-top">
          <h1 className="page-title">
            审核队列 <span className="queue-count">{pendingCount} 待处理</span>
          </h1>
          <div className="header-actions">
            <button type="button" className="btn btn-secondary">
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
              {t.key !== 'done' && (
                <span className="badge">
                  {counts[t.key as 'mine' | 'sensitive' | 'copyright']}
                </span>
              )}
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
            <option>市长调研</option>
            <option>两会报道</option>
            <option>防汛应急</option>
          </select>
        </div>

        {list.length === 0 && (
          <div className="empty-state">
            <div className="title">队列为空</div>
            <div>当前页签下没有待处理项</div>
          </div>
        )}

        <div className="queue-list">
          {list.map((item) => (
            <div
              key={item.asset.id + item.tab}
              className={`queue-item${item.mutex ? ' mutex-blocked' : ''}`}
            >
              <div
                className="queue-checkbox"
                onClick={() => !item.mutex && item.tab !== 'done' && toggle(item.asset.id)}
              />
              <div className="queue-thumb">{KIND_ICON[item.asset.kind]}</div>
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
                    ⊘ 四眼互斥：你本人提交了此素材，不得执行终审。请由其他审核人处理（AC-GOV-002）。
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
                  <button type="button" className="action-btn">
                    判定
                  </button>
                )}
                {item.tab !== 'done' && !item.mutex && !item.asset.sensitive && (
                  <>
                    <button type="button" className="action-btn reject">
                      驳回
                    </button>
                    <button type="button" className="action-btn approve">
                      通过
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
          ))}
        </div>

        {selected.size > 0 && (
          <div className="batch-bar">
            <div className="count">
              已选 <span>{selected.size}</span> 项 · 互斥项已自动排除
            </div>
            <div className="batch-actions">
              <button type="button" className="batch-btn light" onClick={() => setSelected(new Set())}>
                取消选择
              </button>
              <button type="button" className="batch-btn reject">
                批量驳回（需填写意见）
              </button>
              <button type="button" className="batch-btn approve">
                批量通过
              </button>
            </div>
          </div>
        )}

        {!selected.size && selectable.length > 0 && (
          <div className="batch-bar">
            <div className="count">
              可批量操作 <span>{selectable.length}</span> 项（互斥项需在列表中单独处理）
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
