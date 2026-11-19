import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppModal } from './AppModal';
import {
  loadContentForm,
  loadFieldValues,
  saveFieldPatch,
  uploadMediaFile,
  type ContentFormField,
  type ContentFormNode
} from '../api';
import { KindThumb } from '../KindThumb';

interface MediaItemRow {
  media_storage_uri_s: string;
  media_title_s?: string;
  media_kind_s?: string;
  media_mime_type_s?: string;
  media_file_size_i?: number;
  media_thumbnail_url_s?: string;
}

function parseMediaItems(raw: unknown): MediaItemRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => x && typeof x === 'object')
    .map((x) => {
      const row = x as Record<string, unknown>;
      const uri = String(row.media_storage_uri_s || row.storage_uri_s || '');
      return {
        media_storage_uri_s: uri,
        media_title_s: String(row.media_title_s || row.title_s || ''),
        media_kind_s: String(row.media_kind_s || ''),
        media_mime_type_s: String(row.media_mime_type_s || ''),
        media_file_size_i: Number(row.media_file_size_i || row.file_size_i || 0) || 0,
        media_thumbnail_url_s: String(row.media_thumbnail_url_s || row.thumbnail_url_s || '')
      };
    })
    .filter((r) => r.media_storage_uri_s || r.media_title_s);
}

/** 与 UploadPage 相同的表单页签解析。 */
function collectTabs(nodes: ContentFormNode[]): { title: string; fields: ContentFormField[] }[] {
  const out: { title: string; fields: ContentFormField[] }[] = [];
  const fieldsOf = (list: ContentFormNode[] | undefined): ContentFormField[] => {
    const fields: ContentFormField[] = [];
    const walk = (items: ContentFormNode[] | undefined) => {
      for (const child of items || []) {
        if (child.elementType === 'FIELD' && child.field) fields.push(child.field);
        else walk(child.children);
      }
    };
    walk(list);
    return fields;
  };
  for (const node of nodes) {
    if (node.elementType === 'TAB') {
      const sections = (node.children || []).filter((c) => c.elementType === 'FORM_SECTION');
      if (sections.length > 0) {
        for (const sec of sections) {
          out.push({ title: sec.title || '分组', fields: fieldsOf(sec.children) });
        }
      } else {
        out.push({ title: node.title || '分组', fields: fieldsOf(node.children) });
      }
    } else if (node.elementType === 'FORM_SECTION') {
      out.push({ title: node.title || '分组', fields: fieldsOf(node.children) });
    }
  }
  const seen = new Set<string>();
  return out
    .map((tab) => ({
      ...tab,
      fields: tab.fields.filter((f) => {
        if (seen.has(f.code)) return false;
        seen.add(f.code);
        return true;
      })
    }))
    .filter((tab) => tab.fields.length > 0);
}

function FieldControl({
  field,
  value,
  onChange
}: {
  field: ContentFormField;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = `edit-${field.code}`;
  if (field.fieldType === 'LONG_TEXT') {
    return (
      <textarea
        id={id}
        className="form-textarea"
        value={value}
        required={field.required}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
      />
    );
  }
  if (field.fieldType === 'ENUM' || field.fieldType === 'BOOLEAN') {
    const options =
      field.options && field.options.length
        ? field.options
        : field.fieldType === 'BOOLEAN'
          ? [
              { value: 'false', label: '否' },
              { value: 'true', label: '是' }
            ]
          : [];
    return (
      <select
        id={id}
        className="form-select"
        value={value}
        required={field.required}
        onChange={(e) => onChange(e.target.value)}
      >
        {!field.required && <option value="">—</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.fieldType === 'TAG') {
    return (
      <input
        id={id}
        className="form-input"
        value={value}
        placeholder="多个标签用逗号分隔"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (field.fieldType === 'DATE_TIME') {
    return (
      <input
        id={id}
        className="form-input"
        type="datetime-local"
        value={value ? value.slice(0, 16) : ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (field.fieldType === 'INTEGER') {
    return (
      <input
        id={id}
        className="form-input"
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      id={id}
      className="form-input"
      value={value}
      required={field.required}
      placeholder={field.helpText || ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function toFormValues(
  fields: ContentFormField[],
  current: Record<string, unknown>,
  fallback: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const raw = current[f.code] ?? fallback[f.code] ?? '';
    if (Array.isArray(raw)) out[f.code] = raw.join('，');
    else if (raw == null) out[f.code] = '';
    else out[f.code] = String(raw);
  }
  // 系统标题字段
  if ('title_s' in out || fields.some((f) => f.code === 'title_s')) {
    if (!out.title_s) out.title_s = fallback.title_s || '';
  }
  return out;
}

interface Props {
  open: boolean;
  siteId: string;
  contentId: string;
  assetTitle: string;
  fallback: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}

/** 编辑 → 编目表单弹窗（按 content-forms 布局）。 */
export function CatalogEditModal({
  open,
  siteId,
  contentId,
  assetTitle,
  fallback,
  onClose,
  onSaved
}: Props) {
  const [form, setForm] = useState<Awaited<ReturnType<typeof loadContentForm>>>(null);
  const [error, setError] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [tabIndex, setTabIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [mediaItems, setMediaItems] = useState<MediaItemRow[]>([]);
  const [mediaDirty, setMediaDirty] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaMsg, setMediaMsg] = useState('');
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceIndexRef = useRef<number>(-1);

  const tabs = useMemo(() => (form ? collectTabs(form.nodes) : []), [form]);
  const isMediaTab = tabs[tabIndex]?.title?.includes('关联媒体') || false;

  useEffect(() => {
    if (!open || !contentId) return;
    let cancelled = false;
    setForm(null);
    setError('');
    setSaveError('');
    setTabIndex(0);
    setMediaItems([]);
    setMediaDirty(false);
    setMediaMsg('');
    Promise.all([loadContentForm(siteId, 'media_asset'), loadFieldValues(contentId)]).then(
      ([f, fields]) => {
        if (cancelled) return;
        if (!f) {
          setError('无法加载编目表单布局');
          return;
        }
        setForm(f);
        const allFields = collectTabs(f.nodes).flatMap((t) => t.fields);
        setValues(toFormValues(allFields, fields, fallback));
        setMediaItems(parseMediaItems(fields.media_items));
      }
    );
    return () => {
      cancelled = true;
    };
  }, [open, siteId, contentId, fallback]);

  function removeMedia(index: number) {
    setMediaItems((prev) => prev.filter((_, i) => i !== index));
    setMediaDirty(true);
    setMediaMsg('已移除，保存后生效');
  }

  function pickReplace(index: number) {
    replaceIndexRef.current = index;
    replaceInputRef.current?.click();
  }

  async function handleReplaceFile(file: File) {
    const idx = replaceIndexRef.current;
    if (idx < 0 || !siteId) return;
    setMediaBusy(true);
    setMediaMsg('上传替换文件…');
    try {
      const r = await uploadMediaFile(siteId, file);
      if (!r.ok || !r.media) {
        setMediaMsg(r.error || '上传失败');
        return;
      }
      setMediaItems((prev) =>
        prev.map((m, i) =>
          i === idx
            ? {
                ...m,
                media_storage_uri_s: r.media!.assetId,
                media_title_s: file.name,
                media_kind_s: r.media!.kind,
                media_mime_type_s: r.media!.mime,
                media_file_size_i: r.media!.size
              }
            : m
        )
      );
      setMediaDirty(true);
      setMediaMsg(`已替换：${file.name}（保存后生效）`);
    } finally {
      setMediaBusy(false);
      replaceIndexRef.current = -1;
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  }

  async function handleAddFile(file: File) {
    if (!siteId) return;
    setMediaBusy(true);
    setMediaMsg('上传新媒体…');
    try {
      const r = await uploadMediaFile(siteId, file);
      if (!r.ok || !r.media) {
        setMediaMsg(r.error || '上传失败');
        return;
      }
      setMediaItems((prev) => [
        ...prev,
        {
          media_storage_uri_s: r.media!.assetId,
          media_title_s: file.name,
          media_kind_s: r.media!.kind,
          media_mime_type_s: r.media!.mime,
          media_file_size_i: r.media!.size
        }
      ]);
      setMediaDirty(true);
      setMediaMsg(`已添加：${file.name}（保存后生效）`);
    } finally {
      setMediaBusy(false);
      if (addInputRef.current) addInputRef.current.value = '';
    }
  }

  const activeFields = tabs[tabIndex]?.fields || [];
  const fieldCodes = new Set(activeFields.map((f) => f.code));

  async function save() {
    if (!contentId) return;
    const requiredMissing = activeFields.some(
      (f) => f.required && f.code !== 'workflow_status_s' && !(values[f.code] || '').trim()
    );
    // 检查全部页签必填
    const allRequired = tabs.flatMap((t) => t.fields).filter((f) => f.required);
    for (const f of allRequired) {
      if (f.code === 'workflow_status_s') continue;
      if (!(values[f.code] || '').trim()) {
        setSaveError(`请填写必填字段：${f.name}`);
        const idx = tabs.findIndex((t) => t.fields.some((x) => x.code === f.code));
        if (idx >= 0) setTabIndex(idx);
        return;
      }
    }
    void requiredMissing;

    setSaving(true);
    setSaveError('');
    const patch: Record<string, unknown> = {};
    const allFields = tabs.flatMap((t) => t.fields);
    for (const f of allFields) {
      const v = values[f.code] ?? '';
      if (f.fieldType === 'TAG') {
        patch[f.code] = v
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (f.fieldType === 'INTEGER') {
        patch[f.code] = Number(v) || 0;
      } else if (f.fieldType === 'BOOLEAN') {
        patch[f.code] = v === 'true';
      } else if (v !== '') {
        patch[f.code] = v;
      }
    }
    // 标题同步 title_s / 保留 content title 由后端
    if (values.title_s) patch.title_s = values.title_s;
    // 关联媒体（若做过移除/替换则写回）
    if (mediaDirty) {
      patch.media_items = mediaItems
        .filter((m) => m.media_storage_uri_s)
        .map((m) => ({
          media_storage_uri_s: m.media_storage_uri_s,
          media_title_s: m.media_title_s || '',
          media_kind_s: m.media_kind_s || '',
          media_mime_type_s: m.media_mime_type_s || '',
          media_file_size_i: m.media_file_size_i || 0,
          ...(m.media_thumbnail_url_s ? { media_thumbnail_url_s: m.media_thumbnail_url_s } : {})
        }));
    }

    const r = await saveFieldPatch(
      contentId,
      patch,
      mediaDirty ? '编辑编目信息（含关联媒体）' : '编辑编目信息'
    );
    setSaving(false);
    if (!r.ok) {
      setSaveError(r.error || '保存失败');
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <AppModal
      open={open}
      title={`编辑编目 · ${assetTitle}`}
      onClose={onClose}
      width={720}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        </>
      }
    >
      {error && <div className="login-error">{error}</div>}
      {!form && !error && (
        <div className="empty-state" style={{ padding: 24 }}>
          <div className="title">加载编目表单…</div>
          <div>GET .../content-forms/media_asset</div>
        </div>
      )}
      {form && (
        <>
          <div className="form-tabs" role="tablist">
            {tabs.map((t, i) => (
              <button
                key={t.title + i}
                type="button"
                role="tab"
                className={`form-tab${tabIndex === i ? ' active' : ''}`}
                onClick={() => setTabIndex(i)}
              >
                {t.title}
              </button>
            ))}
          </div>
          <div className="form-grid" style={{ marginTop: 16 }}>
            {/* 关联媒体列表（该页签） */}
            {isMediaTab && (
              <div className="form-field full">
                <label>
                  关联媒体列表
                  <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>
                    （共 {mediaItems.length} 个，可移除 / 替换）
                  </span>
                </label>
                {mediaItems.length === 0 && (
                  <div className="gate-note">暂无关联媒体。可点「添加媒体」上传原件。</div>
                )}
                <div className="media-list">
                  {mediaItems.map((m, idx) => (
                    <div key={`${m.media_storage_uri_s}-${idx}`} className="media-list-item">
                      <div className="media-list-thumb">
                        <KindThumb
                          kind={m.media_kind_s || 'document'}
                          size="list"
                          title={m.media_title_s}
                        />
                      </div>
                      <div className="media-list-info">
                        <div className="media-list-title">
                          {m.media_title_s || m.media_storage_uri_s.slice(0, 12) + '…'}
                        </div>
                        <div className="media-list-meta">
                          <span>{m.media_kind_s || '—'}</span>
                          <span>{m.media_mime_type_s || '—'}</span>
                          <span>
                            {m.media_file_size_i
                              ? `${(m.media_file_size_i / 1024).toFixed(1)} KB`
                              : '—'}
                          </span>
                        </div>
                        <div className="media-list-meta">
                          <span style={{ fontFamily: 'var(--mono)', wordBreak: 'break-all' }}>
                            {m.media_storage_uri_s || '—'}
                          </span>
                        </div>
                      </div>
                      <div className="media-list-actions">
                        <button
                          type="button"
                          className="action-btn"
                          disabled={mediaBusy}
                          onClick={() => pickReplace(idx)}
                        >
                          替换
                        </button>
                        <button
                          type="button"
                          className="action-btn"
                          style={{
                            color: 'var(--color-status-reject)',
                            borderColor: 'var(--color-status-reject)'
                          }}
                          disabled={mediaBusy}
                          onClick={() => removeMedia(idx)}
                        >
                          移除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    className="action-btn"
                    disabled={mediaBusy}
                    onClick={() => addInputRef.current?.click()}
                  >
                    + 添加媒体
                  </button>
                  {mediaMsg && (
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', alignSelf: 'center' }}>
                      {mediaMsg}
                    </span>
                  )}
                </div>
                <input
                  ref={replaceInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.glb,.gltf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleReplaceFile(f);
                  }}
                />
                <input
                  ref={addInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.glb,.gltf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleAddFile(f);
                  }}
                />
              </div>
            )}

            {/* 其余字段（关联媒体组的子字段不重复渲染） */}
            {activeFields
              .filter(
                (field) =>
                  field.code !== 'media_items' &&
                  !field.code.startsWith('media_storage') &&
                  !field.code.startsWith('media_title') &&
                  !field.code.startsWith('media_kind') &&
                  !field.code.startsWith('media_mime') &&
                  !field.code.startsWith('media_file') &&
                  !field.code.startsWith('media_thumb')
              )
              .map((field) => (
                <div
                  key={field.code}
                  className={`form-field${field.fieldType === 'LONG_TEXT' ? ' full' : ''}`}
                >
                  <label htmlFor={`edit-${field.code}`}>
                    {field.name}
                    {field.required && <span className="req">*</span>}
                  </label>
                  <FieldControl
                    field={field}
                    value={values[field.code] ?? ''}
                    onChange={(v) => setValues((prev) => ({ ...prev, [field.code]: v }))}
                  />
                  {field.helpText && <div className="field-help">{field.helpText}</div>}
                </div>
              ))}
            {/* 非媒体页签时若字段为空集提示 */}
            {!isMediaTab && activeFields.length === 0 && (
              <div className="form-field full">
                <div className="gate-note">本页签无普通字段，可在「关联媒体」管理原件。</div>
              </div>
            )}
            {void fieldCodes}
          </div>
          {saveError && (
            <div className="login-error" style={{ marginTop: 12 }}>
              {saveError}
            </div>
          )}
        </>
      )}
    </AppModal>
  );
}
