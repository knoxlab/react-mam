import React, { useEffect, useMemo, useState } from 'react';
import { AppModal } from './AppModal';
import {
  loadContentForm,
  loadFieldValues,
  saveFieldPatch,
  type ContentFormField,
  type ContentFormNode
} from '../api';

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

  const tabs = useMemo(() => (form ? collectTabs(form.nodes) : []), [form]);

  useEffect(() => {
    if (!open || !contentId) return;
    let cancelled = false;
    setForm(null);
    setError('');
    setSaveError('');
    setTabIndex(0);
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
      }
    );
    return () => {
      cancelled = true;
    };
  }, [open, siteId, contentId, fallback]);

  const activeFields = tabs[tabIndex]?.fields || [];

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

    const r = await saveFieldPatch(contentId, patch, '编辑编目信息');
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
            {activeFields.map((field) => (
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
