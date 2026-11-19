import React, { useCallback, useEffect, useState } from 'react';
import { AppModal } from './AppModal';
import { copyText, issueShareLink } from '../api';

interface ShareRow {
  id?: string;
  audience?: string;
  expiresAt?: string;
  tokenHint?: string;
  availability?: string;
  downloadCount?: number;
  maxDownloads?: number;
  revoked?: boolean;
}

interface Props {
  open: boolean;
  siteId: string;
  contentId: string;
  assetTitle: string;
  onClose: () => void;
  onIssued?: () => void;
}

const AVAILABILITY: Record<string, string> = {
  ACTIVE: '生效中',
  REVOKED: '已吊销',
  EXPIRED: '已过期',
  EXHAUSTED: '已用完',
  UNAVAILABLE: '资源未发布'
};

/**
 * 生成分享：对齐管理端「内容 → 媒体库 → 签发分享」
 * （已有列表 + 使用方/有效期/次数上限签发 + 一次性完整链接）。
 */
export function ShareModal({ open, siteId, contentId, assetTitle, onClose, onIssued }: Props) {
  const [rows, setRows] = useState<ShareRow[]>([]);
  const [audience, setAudience] = useState('');
  const [days, setDays] = useState('7');
  const [maxDownloads, setMaxDownloads] = useState('');
  const [issuedUrl, setIssuedUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!siteId || !contentId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/sites/${encodeURIComponent(siteId)}/contents/${encodeURIComponent(contentId)}/shares`,
        { headers: { Accept: 'application/json' }, credentials: 'include', cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        setRows(Array.isArray(data) ? data : []);
      } else {
        setRows([]);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [siteId, contentId]);

  useEffect(() => {
    if (!open) return;
    setIssuedUrl('');
    setAudience('');
    setDays('7');
    setMaxDownloads('');
    setError('');
    void load();
  }, [open, load]);

  async function issue() {
    if (!audience.trim()) {
      setError('请填写使用方');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const expiresAt = new Date(Date.now() + Number(days || 7) * 86400000).toISOString();
      const max = maxDownloads.trim() ? Number(maxDownloads.trim()) : undefined;
      const r = await issueShareLink(siteId, contentId, {
        audience: audience.trim(),
        expiresAt,
        maxDownloads: max && Number.isFinite(max) ? max : undefined
      });
      if (!r.ok) {
        setError(r.error || '签发失败');
        return;
      }
      const abs = r.url
        ? r.url.startsWith('http')
          ? r.url
          : `${window.location.origin}${r.url.startsWith('/') ? '' : '/'}${r.url}`
        : `${window.location.origin}/api/v1/delivery/sites/${siteId}/shares/…`;
      setIssuedUrl(abs);
      setAudience('');
      await load();
      onIssued?.();
    } finally {
      setSaving(false);
    }
  }

  async function revoke(row: ShareRow) {
    if (!row.id) return;
    try {
      const res = await fetch(
        `/api/v1/sites/${encodeURIComponent(siteId)}/contents/${encodeURIComponent(
          contentId
        )}/shares/${encodeURIComponent(row.id)}`,
        { method: 'DELETE', credentials: 'include' }
      );
      if (res.ok || res.status === 204) {
        await load();
        onIssued?.();
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <AppModal
      open={open}
      title="签发分享"
      onClose={onClose}
      width={680}
      footer={
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          关闭
        </button>
      }
    >
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
        {assetTitle}。完整链接只在签发成功时出现一次，关闭后只能看到令牌尾号。
      </p>

      <div className="share-table">
        <div className="share-table-head">
          <span>使用方</span>
          <span>失效时间</span>
          <span>次数</span>
          <span>状态</span>
          <span>尾号</span>
          <span>操作</span>
        </div>
        {loading && <div className="share-empty">加载中…</div>}
        {!loading && rows.length === 0 && <div className="share-empty">还没有分享</div>}
        {!loading &&
          rows.map((row, i) => (
            <div key={row.id || i} className="share-table-row">
              <span>{row.audience || '—'}</span>
              <span>{row.expiresAt ? row.expiresAt.replace('T', ' ').slice(0, 16) : '—'}</span>
              <span>
                {row.downloadCount ?? 0}
                {row.maxDownloads ? ` / ${row.maxDownloads}` : ''}
              </span>
              <span>
                {AVAILABILITY[row.availability || ''] ||
                  (row.revoked ? '已吊销' : row.availability || '—')}
              </span>
              <span>{row.tokenHint || '—'}</span>
              <span>
                <button
                  type="button"
                  className="action-btn"
                  disabled={row.revoked || (row.availability && row.availability !== 'ACTIVE')}
                  onClick={() => void revoke(row)}
                >
                  吊销
                </button>
              </span>
            </div>
          ))}
      </div>

      <div className="form-grid" style={{ marginTop: 16 }}>
        <div className="form-field full">
          <label>
            使用方 <span className="req">*</span>
          </label>
          <input
            className="form-input"
            value={audience}
            maxLength={200}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="部门、外部应用或渠道"
          />
        </div>
        <div className="form-field">
          <label>有效期</label>
          <select className="form-select" value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="1">1 天</option>
            <option value="7">7 天</option>
            <option value="30">30 天</option>
          </select>
        </div>
        <div className="form-field">
          <label>次数上限</label>
          <input
            className="form-input"
            type="number"
            min={1}
            value={maxDownloads}
            onChange={(e) => setMaxDownloads(e.target.value)}
            placeholder="留空表示不限次数"
          />
        </div>
      </div>

      {error && (
        <div className="login-error" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving || !audience.trim()}
          onClick={() => void issue()}
        >
          {saving ? '签发中…' : '签发'}
        </button>
      </div>

      {issuedUrl && (
        <div className="gate-note" style={{ marginTop: 16 }}>
          <strong>请立即复制。关闭窗口后无法再次查看完整链接。</strong>
          <div style={{ wordBreak: 'break-all', fontFamily: 'var(--mono)', margin: '8px 0' }}>
            {issuedUrl}
          </div>
          <button
            type="button"
            className="action-btn"
            onClick={() => {
              void copyText(issuedUrl);
            }}
          >
            复制链接
          </button>
        </div>
      )}
    </AppModal>
  );
}
