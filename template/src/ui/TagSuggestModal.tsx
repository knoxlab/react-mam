import React, { useEffect, useMemo, useState } from 'react';
import { AppModal } from './AppModal';
import { loadFieldValues, saveFieldPatch } from '../api';
import type { MediaAsset } from '../types';

interface Props {
  open: boolean;
  contentId: string;
  asset: MediaAsset;
  /** 站内已加载素材，用于汇总系统标签池 */
  assets: MediaAsset[];
  onClose: () => void;
  onSaved: () => void;
}

function uniqueTags(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of list) {
    const v = (t || '').trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

/**
 * 添加标签弹窗：
 * - 按内容自动提示（AI 标签 + 同事件/主题标签）
 * - 站内已有标签池多选
 * - 支持自定义输入
 */
export function TagSuggestModal({ open, contentId, asset, assets, onClose, onSaved }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(asset.tags));
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [poolSource, setPoolSource] = useState<'asset' | 'site'>('asset');

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(asset.tags));
    setCustom('');
    setError('');
    setPoolSource('asset');
    if (!contentId) return;
    void loadFieldValues(contentId).then((fields) => {
      const fromDb = Array.isArray(fields.tags_ss)
        ? (fields.tags_ss as unknown[]).map(String)
        : [];
      if (fromDb.length) setSelected(new Set([...asset.tags, ...fromDb]));
    });
  }, [open, contentId, asset.tags]);

  /** 内容自动提示：AI 标签 + 同事件/同主题/同栏目素材标签 */
  const suggestions = useMemo(() => {
    const list: { tag: string; reason: string; score: number }[] = [];
    const push = (tag: string, reason: string, score: number) => {
      const t = (tag || '').trim();
      if (!t) return;
      const exist = list.find((x) => x.tag === t);
      if (exist) {
        if (score > exist.score) {
          exist.score = score;
          exist.reason = reason;
        }
        return;
      }
      list.push({ tag: t, reason, score });
    };

    asset.aiTags.forEach((t) => push(t, 'AI 建议', 100));
    asset.tags.forEach((t) => push(t, '当前已有', 90));

    assets.forEach((other) => {
      if (other.id === asset.id) return;
      let score = 0;
      let reason = '站内素材';
      if (other.event && other.event === asset.event && asset.event && asset.event !== '—') {
        score = 80;
        reason = `同事件 · ${asset.event}`;
      } else if (other.subject && other.subject === asset.subject && asset.subject && asset.subject !== '—') {
        score = 70;
        reason = `同主题 · ${asset.subject}`;
      } else if (other.channel && other.channel === asset.channel && asset.channel && asset.channel !== '—') {
        score = 60;
        reason = `同栏目 · ${asset.channel}`;
      } else if (other.topic && asset.topic && other.topic === asset.topic) {
        score = 75;
        reason = `同专题 · ${asset.topic}`;
      } else {
        return;
      }
      other.tags.forEach((t) => push(t, reason, score));
      other.aiTags.forEach((t) => push(t, `${reason}（AI）`, score - 5));
    });

    return list.sort((a, b) => b.score - a.score).slice(0, 24);
  }, [asset, assets]);

  /** 站内全部标签池 */
  const systemPool = useMemo(() => {
    const all: string[] = [];
    assets.forEach((a) => {
      all.push(...a.tags, ...a.aiTags);
    });
    // 也并入建议中的理由标签
    suggestions.forEach((s) => all.push(s.tag));
    return uniqueTags(all).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [assets, suggestions]);

  const visiblePool = poolSource === 'site' ? systemPool : uniqueTags(suggestions.map((s) => s.tag));
  const reasonMap = useMemo(() => {
    const m = new Map<string, string>();
    suggestions.forEach((s) => m.set(s.tag, s.reason));
    return m;
  }, [suggestions]);

  function toggle(tag: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function addCustom() {
    const parts = custom
      .split(/[,，\s]+/)
      .map((s) => s.replace(/^#/, '').trim())
      .filter(Boolean);
    if (!parts.length) return;
    setSelected((prev) => new Set([...prev, ...parts]));
    setCustom('');
  }

  async function save() {
    if (!contentId) {
      setError('缺少内容 ID');
      return;
    }
    const tags = uniqueTags(Array.from(selected));
    setSaving(true);
    setError('');
    const r = await saveFieldPatch(contentId, { tags_ss: tags }, '添加/更新标签');
    setSaving(false);
    if (!r.ok) {
      setError(r.error || '保存失败');
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <AppModal
      open={open}
      title="添加标签"
      onClose={onClose}
      width={600}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void save()}
            disabled={saving || selected.size === 0}
          >
            {saving ? '保存中…' : `保存（${selected.size} 个标签）`}
          </button>
        </>
      }
    >
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
        素材：<strong style={{ color: 'var(--color-text-primary)' }}>{asset.title}</strong>
        <br />
        根据内容自动提示，或从系统已有标签中选择；也可自定义输入。
      </div>

      {/* 已选 */}
      <div className="form-field" style={{ marginBottom: 14 }}>
        <label>已选标签（{selected.size}）</label>
        <div className="tag-pool">
          {selected.size === 0 && (
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>尚未选择</span>
          )}
          {Array.from(selected).map((t) => (
            <button
              key={t}
              type="button"
              className="tag-chip selected"
              onClick={() => toggle(t)}
              title="点击移除"
            >
              #{t} ×
            </button>
          ))}
        </div>
      </div>

      {/* 自定义 */}
      <div className="form-field" style={{ marginBottom: 14 }}>
        <label>自定义标签</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="form-input"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="输入标签后回车或点添加（可用逗号分隔多个）"
          />
          <button type="button" className="action-btn" onClick={addCustom}>
            添加
          </button>
        </div>
      </div>

      {/* 来源切换 */}
      <div className="form-field" style={{ marginBottom: 10 }}>
        <label>标签来源</label>
        <div className="search-mode-toggle" style={{ width: 'fit-content' }}>
          <button
            type="button"
            className={`search-mode-btn${poolSource === 'asset' ? ' active' : ''}`}
            onClick={() => setPoolSource('asset')}
          >
            内容建议
          </button>
          <button
            type="button"
            className={`search-mode-btn${poolSource === 'site' ? ' active' : ''}`}
            onClick={() => setPoolSource('site')}
          >
            系统已有标签（{systemPool.length}）
          </button>
        </div>
      </div>

      <div className="form-field">
        <label>
          {poolSource === 'asset' ? '按内容自动提示' : '系统标签池'}
          <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>
            （点击选择/取消）
          </span>
          {poolSource === 'asset' && (
            <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>
              {' '}
              · 含 AI 标签与同事件/主题素材标签
            </span>
          )}
        </label>
        <div className="tag-pool">
          {visiblePool.length === 0 && (
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              暂无可选标签，可自定义输入
            </span>
          )}
          {visiblePool.map((t) => {
            const on = selected.has(t);
            const reason = reasonMap.get(t);
            return (
              <button
                key={t}
                type="button"
                className={`tag-chip${on ? ' selected' : ''}`}
                onClick={() => toggle(t)}
                title={reason || (on ? '点击取消' : '点击添加')}
              >
                #{t}
                {reason && poolSource === 'asset' && (
                  <span className="tag-chip-reason">{reason}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="login-error" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
    </AppModal>
  );
}
