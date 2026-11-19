import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Route } from '../route';
import {
  createMediaAssetDraft,
  loadContentForm,
  siteIdFromLocation,
  uploadMediaFile,
  type ContentFormField,
  type ContentFormNode,
  type UploadedMedia
} from '../api';
import { KIND_LABEL } from '../data';

interface Props {
  onNavigate: (route: Route) => void;
  onSaved?: () => void;
}

function collectTabs(nodes: ContentFormNode[]): { title: string; fields: ContentFormField[] }[] {
  const out: { title: string; fields: ContentFormField[] }[] = [];

  const fieldsOf = (list: ContentFormNode[] | undefined): ContentFormField[] => {
    const fields: ContentFormField[] = [];
    const walk = (items: ContentFormNode[] | undefined) => {
      for (const child of items || []) {
        if (child.elementType === 'FIELD' && child.field) fields.push(child.field);
        else if (child.elementType === 'REPEAT_GROUP') {
          // 关联媒体组在编目页单独展示已上传文件
          if (child.title?.includes('关联媒体') || child.children?.some((c) => c.field?.code?.startsWith('media_'))) {
            // 仍收集子字段便于 media_* 显示
            walk(child.children);
          }
        } else walk(child.children);
      }
    };
    walk(list);
    return fields;
  };

  for (const node of nodes) {
    if (node.elementType === 'TAB') {
      const sections = (node.children || []).filter((c) => c.elementType === 'FORM_SECTION');
      if (sections.length > 0) {
        // 内容分组 TAB 下的每个 FORM_SECTION 作为独立页签（素材编目/七维/治理…）
        for (const sec of sections) {
          out.push({
            title: sec.title || '分组',
            fields: fieldsOf(sec.children)
          });
        }
      } else {
        out.push({ title: node.title || '分组', fields: fieldsOf(node.children) });
      }
    } else if (node.elementType === 'FORM_SECTION') {
      out.push({ title: node.title || '分组', fields: fieldsOf(node.children) });
    } else if (node.elementType === 'FIELD' && node.field) {
      if (!out.length) out.push({ title: '字段', fields: [] });
      out[out.length - 1].fields.push(node.field);
    }
  }

  // 去掉重复字段码（跨 tab 不重复渲染同一 code）
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
    .filter((tab) => tab.fields.length > 0 || out.length === 1);
}

function fieldInitial(field: ContentFormField, media: UploadedMedia | null): string {
  if (field.code === 'workflow_status_s') return 'editing';
  if (field.code === 'asset_kind_s') return media?.kind || 'image';
  if (field.code === 'mime_type_s') return media?.mime || '';
  if (field.code === 'file_size_i') return media ? String(media.size) : '';
  if (field.code === 'uploader_s') return 'admin';
  if (field.code === 'version_s') return 'v1';
  if (field.code === 'copyright_status_s') return 'pending';
  if (field.code === 'security_level_s') return 'internal';
  if (field.code === 'license_s') return 'internal';
  if (field.defaultValue) return field.defaultValue;
  return '';
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
  const id = `f-${field.code}`;
  if (field.fieldType === 'LONG_TEXT') {
    return (
      <textarea
        id={id}
        className="form-textarea"
        value={value}
        required={field.required}
        placeholder={field.helpText || ''}
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
  if (field.code === 'thumbnail_url_s' || field.fieldType === 'IMAGE') {
    return (
      <input
        id={id}
        className="form-input"
        value={value}
        placeholder="预览图资产 UUID（可选）"
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

export function UploadPage({ onNavigate, onSaved }: Props) {
  const siteId = useMemo(() => siteIdFromLocation(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'catalog'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [media, setMedia] = useState<UploadedMedia | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const [form, setForm] = useState<Awaited<ReturnType<typeof loadContentForm>>>(null);
  const [formError, setFormError] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [tabIndex, setTabIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedId, setSavedId] = useState('');

  const tabs = useMemo(() => (form ? collectTabs(form.nodes) : []), [form]);

  useEffect(() => {
    if (step !== 'catalog') return;
    let cancelled = false;
    loadContentForm(siteId, 'media_asset').then((f) => {
      if (cancelled) return;
      if (!f) {
        setFormError('无法加载内容类型表单（content-forms/media_asset）');
        return;
      }
      setForm(f);
      const next: Record<string, string> = {};
      for (const tab of collectTabs(f.nodes)) {
        for (const field of tab.fields) {
          next[field.code] = fieldInitial(field, media);
        }
      }
      // 标题默认用文件名
      if (!next.title_s && media) next.title_s = media.filename.replace(/\.[^.]+$/, '');
      if (media) {
        next.media_title_s = media.filename;
      }
      setValues(next);
    });
    return () => {
      cancelled = true;
    };
  }, [step, siteId, media]);

  const doUpload = useCallback(
    async (picked: File) => {
      if (!siteId) {
        setUploadError('缺少站点 ID，无法上传');
        return;
      }
      setUploading(true);
      setUploadError('');
      const result = await uploadMediaFile(siteId, picked);
      setUploading(false);
      if (!result.ok || !result.media) {
        setUploadError(result.error || '上传失败');
        return;
      }
      setFile(picked);
      setMedia(result.media);
      setStep('catalog');
    },
    [siteId]
  );

  function onPick(files: FileList | null) {
    const f = files && files[0];
    if (!f) return;
    void doUpload(f);
  }

  async function saveDraft() {
    if (!siteId || !media) return;
    const title = (values.title_s || values.title || media.filename).trim();
    if (!values.summary_t?.trim()) {
      setSaveError('请填写必填字段：摘要');
      return;
    }
    if (!values.source_s?.trim()) {
      setSaveError('请填写必填字段：来源');
      return;
    }
    if (!values.asset_code_s?.trim()) {
      setSaveError('请填写必填字段：资产编码');
      return;
    }

    setSaving(true);
    setSaveError('');

    // 组装 fieldValues：TAG 逗号串 → 数组；DATE 保留；media_items 关联
    const fieldValues: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      if (k === 'title' || k === 'media_title_s') continue;
      if (v === '' || v == null) continue;
      const field = tabs.flatMap((t) => t.fields).find((f) => f.code === k);
      if (field?.fieldType === 'TAG') {
        fieldValues[k] = v
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (field?.fieldType === 'INTEGER') {
        fieldValues[k] = Number(v) || 0;
      } else if (field?.fieldType === 'BOOLEAN') {
        fieldValues[k] = v === 'true';
      } else {
        fieldValues[k] = v;
      }
    }
    fieldValues.workflow_status_s = 'editing';
    fieldValues.media_items = [
      {
        media_storage_uri_s: media.assetId,
        media_title_s: media.filename,
        media_kind_s: media.kind,
        media_mime_type_s: media.mime,
        media_file_size_i: media.size
      }
    ];

    const result = await createMediaAssetDraft(siteId, { title, fieldValues });
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.error || '保存失败');
      return;
    }
    setSavedId(result.assetCode || result.contentId || '');
    onSaved?.();
    // 草稿未发布：详情用 content UUID 走管理端 API
    if (result.contentId) {
      onNavigate({ name: 'detail', id: result.contentId });
    } else if (result.assetCode) {
      onNavigate({ name: 'detail', id: result.assetCode });
    } else {
      onNavigate({ name: 'library' });
    }
  }

  const activeFields = tabs[tabIndex]?.fields || [];
  const isMediaGroup = (code: string) =>
    code.startsWith('media_') && code !== 'media_items';

  return (
    <main className="main-content">
      <header className="content-header">
        <div className="header-top">
          <h1 className="page-title">
            {step === 'upload' ? '上传素材' : '素材编目'}
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                background: 'var(--color-section)',
                border: '1px solid var(--color-border)',
                padding: '4px 10px',
                borderRadius: 12
              }}
            >
              {step === 'upload' ? '步骤 1/2 · 选择文件' : '步骤 2/2 · 编目保存'}
            </span>
          </h1>
          <div className="header-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                if (step === 'catalog') setStep('upload');
                else onNavigate({ name: 'library' });
              }}
            >
              {step === 'catalog' ? '重新上传' : '返回媒资库'}
            </button>
            {step === 'catalog' && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveDraft}
                disabled={saving}
              >
                {saving ? '保存中…' : '保存草稿（编目中）'}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="content-area">
        {step === 'upload' && (
          <div
            className={`upload-dropzone${dragOver ? ' is-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              onPick(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
            }}
          >
            <input
              ref={inputRef}
              type="file"
              style={{ display: 'none' }}
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.glb,.gltf,.xlsx,.ppt,.pptx,.txt"
              onChange={(e) => onPick(e.target.files)}
            />
            <div className="upload-drop-icon" aria-hidden="true">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <path
                  d="M24 32V16M24 16l-7 7M24 16l7 7"
                  stroke="#0066CC"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 34v2a4 4 0 004 4h16a4 4 0 004-4v-2"
                  stroke="#0066CC"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="upload-drop-title">
              {uploading ? '正在上传…' : '点击选择文件，或拖拽文件到此处'}
            </div>
            <div className="upload-drop-hint">
              支持图片 / 视频 / 音频 / 文档 / 三维模型 · 上传成功后进入编目页
            </div>
            {uploading && <div className="upload-progress">上传中，请稍候…</div>}
            {uploadError && <div className="login-error">{uploadError}</div>}
          </div>
        )}

        {step === 'catalog' && media && (
          <div className="catalog-layout">
            <div className="catalog-file-bar">
              <div className="catalog-file-info">
                <strong>{media.filename}</strong>
                <span>
                  {KIND_LABEL[media.kind] || media.kind} · {media.mime} ·{' '}
                  {(media.size / 1024).toFixed(1)} KB
                </span>
                <span className="catalog-asset-id">资产 UUID: {media.assetId}</span>
              </div>
              <span className="status-badge-inline">编目中</span>
            </div>

            {formError && <div className="login-error">{formError}</div>}
            {!form && !formError && (
              <div className="empty-state">
                <div className="title">加载内容类型布局…</div>
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
                      aria-selected={tabIndex === i}
                      className={`form-tab${tabIndex === i ? ' active' : ''}`}
                      onClick={() => setTabIndex(i)}
                    >
                      {t.title}
                    </button>
                  ))}
                </div>

                <div className="form-panel" role="tabpanel">
                  <div className="form-grid">
                    {activeFields.map((field) => {
                      if (isMediaGroup(field.code)) {
                        return (
                          <div key={field.code} className="form-field full">
                            <label>关联媒体（已上传）</label>
                            <div className="linked-media-box">
                              <span className="linked-media-name">{media.filename}</span>
                              <span className="linked-media-meta">
                                {media.assetId.slice(0, 8)}… · {KIND_LABEL[media.kind]}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={field.code}
                          className={`form-field${field.fieldType === 'LONG_TEXT' ? ' full' : ''}`}
                        >
                          <label htmlFor={`f-${field.code}`}>
                            {field.name}
                            {field.required && <span className="req">*</span>}
                          </label>
                          <FieldControl
                            field={field}
                            value={values[field.code] ?? ''}
                            onChange={(v) =>
                              setValues((prev) => ({ ...prev, [field.code]: v }))
                            }
                          />
                          {field.helpText && <div className="field-help">{field.helpText}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {saveError && <div className="login-error" style={{ marginTop: 16 }}>{saveError}</div>}
                {savedId && (
                  <div className="gate-note" style={{ marginTop: 16 }}>
                    已保存草稿：{savedId} · 状态「编目中」
                  </div>
                )}

                <div className="catalog-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setStep('upload')}
                    disabled={saving}
                  >
                    上一步
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={saveDraft}
                    disabled={saving}
                  >
                    {saving ? '保存中…' : '保存草稿（编目中）'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
