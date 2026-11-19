import type {
  ActivityItem,
  AssetKind,
  CopyrightStatus,
  MediaAsset,
  ReviewItem,
  SecurityLevel,
  ShareLink,
  VersionItem,
  WorkflowStatus
} from './types';

export type DataSource = 'live' | 'seed' | 'empty';

export interface ActivityFeed {
  items: ActivityItem[];
  total: number;
  /** unauthorized = 未登录/无站点 read 权限；error = 网络或 5xx；ok = 成功 */
  status: 'ok' | 'unauthorized' | 'error';
  message?: string;
}

export interface MamCatalog {
  source: DataSource;
  assets: MediaAsset[];
  versions: VersionItem[];
  shareLinks: ShareLink[];
  folders: FolderNode[];
  activities: ActivityItem[];
  activityTotal: number;
  activityStatus: ActivityFeed['status'];
  activityMessage?: string;
  error?: string;
}

export interface FolderNode {
  id: string;
  title: string;
  path: string;
  count?: number;
}

export function siteIdFromLocation(): string {
  const fromQuery = new URLSearchParams(window.location.search).get('siteId');
  if (fromQuery && fromQuery.trim()) return fromQuery.trim();
  return window.__POWERCMS_SITE_ID__?.trim() || '';
}

// ---- 认证（侧栏用户区） ----

export interface CurrentUser {
  authenticated: boolean;
  username?: string;
  displayName?: string;
  userId?: string;
  roles?: string[];
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  try {
    const res = await fetch('/api/v1/auth/me', {
      headers: { Accept: 'application/json' },
      credentials: 'include',
      cache: 'no-store'
    });
    if (!res.ok) return { authenticated: false };
    const basic = (await res.json()) as { authenticated?: boolean; username?: string };
    if (!basic.authenticated) return { authenticated: false };
    let displayName = basic.username || '';
    let userId = '';
    let roles: string[] = [];
    try {
      const meRes = await fetch('/api/v1/me', {
        headers: { Accept: 'application/json' },
        credentials: 'include',
        cache: 'no-store'
      });
      if (meRes.ok) {
        const me = (await meRes.json()) as {
          displayName?: string;
          username?: string;
          userId?: string;
          organizationRoles?: string[];
        };
        displayName = me.displayName || me.username || displayName;
        userId = me.userId || '';
        roles = me.organizationRoles || [];
      }
    } catch {
      /* me 可选 */
    }
    return {
      authenticated: true,
      username: basic.username,
      displayName: displayName || basic.username,
      userId,
      roles
    };
  } catch {
    return { authenticated: false };
  }
}

export async function login(
  username: string,
  password: string
): Promise<{ ok: boolean; error?: string; user?: CurrentUser }> {
  try {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      let message = `登录失败（HTTP ${res.status}）`;
      try {
        const body = (await res.json()) as { message?: string };
        if (body.message) message = body.message;
      } catch {
        /* ignore */
      }
      return { ok: false, error: message };
    }
    const user = await fetchCurrentUser();
    return { ok: true, user };
  } catch {
    return { ok: false, error: '网络错误，无法登录' };
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });
  } catch {
    /* ignore */
  }
}

export function avatarText(user: CurrentUser | null): string {
  if (!user) return '?';
  const name = (user.displayName || user.username || '').trim();
  if (!name) return '?';
  return name.slice(0, 1).toUpperCase();
}

// ---- 上传与编目 ----

export interface ContentFormField {
  code: string;
  name: string;
  fieldType: string;
  required?: boolean;
  helpText?: string;
  defaultValue?: string;
  readOnly?: boolean;
  options?: { value: string; label: string }[];
}

export interface ContentFormNode {
  elementType: 'TAB' | 'FORM_SECTION' | 'FIELD' | 'REPEAT_GROUP';
  title?: string;
  field?: ContentFormField | null;
  children?: ContentFormNode[];
}

export interface ContentForm {
  code: string;
  name: string;
  nodes: ContentFormNode[];
}

export async function loadContentForm(
  siteId: string,
  code = 'media_asset'
): Promise<ContentForm | null> {
  try {
    const res = await fetch(
      `/api/v1/delivery/sites/${encodeURIComponent(siteId)}/content-forms/${encodeURIComponent(code)}`,
      {
        headers: { Accept: 'application/json' },
        credentials: 'include',
        cache: 'no-store'
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as ContentForm;
    if (!data || !Array.isArray(data.nodes)) return null;
    return data;
  } catch {
    return null;
  }
}

export interface UploadedMedia {
  assetId: string;
  knoxMediaId?: string | null;
  status?: string;
  filename: string;
  mime: string;
  size: number;
  kind: AssetKind;
}

function kindFromMime(mime: string, filename: string): AssetKind {
  const m = (mime || '').toLowerCase();
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (m.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext))
    return 'image';
  if (m.startsWith('video/') || ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) return 'video';
  if (m.startsWith('audio/') || ['mp3', 'wav', 'aac', 'm4a', 'ogg'].includes(ext)) return 'audio';
  if (['glb', 'gltf', 'fbx', 'obj'].includes(ext) || m.includes('model')) return 'model3d';
  return 'document';
}

/** 上传媒体文件 → 返回资产 UUID（供 media_items 引用）。 */
export async function uploadMediaFile(
  siteId: string,
  file: File
): Promise<{ ok: boolean; media?: UploadedMedia; error?: string }> {
  if (!siteId) return { ok: false, error: '缺少站点 ID' };
  const fd = new FormData();
  fd.append('file', file, file.name);
  try {
    const res = await fetch(`/api/v1/sites/${encodeURIComponent(siteId)}/media/knox/upload`, {
      method: 'POST',
      credentials: 'include',
      body: fd
    });
    if (!res.ok) {
      let message = `上传失败（HTTP ${res.status}）`;
      try {
        const body = (await res.json()) as { message?: string };
        if (body.message) message = body.message;
      } catch {
        /* ignore */
      }
      return { ok: false, error: message };
    }
    const data = (await res.json()) as {
      assetId?: string;
      knoxMediaId?: string | null;
      status?: string;
    };
    if (!data.assetId) return { ok: false, error: '上传响应缺少 assetId' };
    return {
      ok: true,
      media: {
        assetId: data.assetId,
        knoxMediaId: data.knoxMediaId,
        status: data.status,
        filename: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        kind: kindFromMime(file.type, file.name)
      }
    };
  } catch {
    return { ok: false, error: '网络错误，上传失败' };
  }
}

export async function loadContentTypeId(siteId: string, code = 'media_asset'): Promise<string> {
  try {
    const res = await fetch(`/api/v1/sites/${encodeURIComponent(siteId)}/content-types`, {
      headers: { Accept: 'application/json' },
      credentials: 'include',
      cache: 'no-store'
    });
    if (!res.ok) return '';
    const list = (await res.json()) as Array<{ id?: string; code?: string }>;
    return list.find((x) => x.code === code)?.id || '';
  } catch {
    return '';
  }
}

export interface CreateDraftResult {
  ok: boolean;
  contentId?: string;
  assetCode?: string;
  error?: string;
}

/** 保存草稿：创建 media_asset，workflow_status_s 固定为 editing（编目中）。 */
export async function createMediaAssetDraft(
  siteId: string,
  input: {
    title: string;
    fieldValues: Record<string, unknown>;
  }
): Promise<CreateDraftResult> {
  if (!siteId) return { ok: false, error: '缺少站点 ID' };
  const contentTypeId = await loadContentTypeId(siteId, 'media_asset');
  if (!contentTypeId) return { ok: false, error: '未找到 media_asset 内容类型' };

  const fields: Record<string, unknown> = {
    ...input.fieldValues,
    workflow_status_s: 'editing'
  };
  const assetCode =
    (typeof fields.asset_code_s === 'string' && fields.asset_code_s) ||
    `MA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`;
  fields.asset_code_s = assetCode;
  if (!fields.version_s) fields.version_s = 'v1';

  try {
    const res = await fetch(`/api/v1/sites/${encodeURIComponent(siteId)}/contents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: input.title || assetCode,
        contentTypeId,
        fieldValues: JSON.stringify(fields)
      })
    });
    if (!res.ok) {
      let message = `保存失败（HTTP ${res.status}）`;
      try {
        const body = (await res.json()) as { message?: string; details?: unknown[] };
        if (body.message) message = body.message;
      } catch {
        /* ignore */
      }
      return { ok: false, error: message };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, contentId: data.id, assetCode };
  } catch {
    return { ok: false, error: '网络错误，保存失败' };
  }
}

interface ContentRow {
  id?: string;
  title?: string;
  status?: string;
  viewCount?: number;
  createdAt?: string;
  updatedAt?: string;
  fields?: Record<string, unknown>;
  [key: string]: unknown;
}

function rowFields(row: ContentRow): Record<string, unknown> {
  const fields = row.fields && typeof row.fields === 'object' ? { ...row.fields } : {};
  for (const [key, value] of Object.entries(row)) {
    if (!(key in fields)) fields[key] = value;
  }
  return fields;
}

function text(fields: Record<string, unknown>, key: string): string {
  const value = fields[key];
  if (value == null) return '';
  return String(value);
}

function list(fields: Record<string, unknown>, key: string): string[] {
  const value = fields[key];
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[,，]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function number(fields: Record<string, unknown>, key: string): number {
  const value = fields[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function bool(fields: Record<string, unknown>, key: string): boolean {
  const value = fields[key];
  return value === true || value === 'true' || value === 1 || value === '1';
}

function oneOf<T extends string>(value: string, allowed: T[], fallback: T): T {
  return (allowed as string[]).includes(value) ? (value as T) : fallback;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const KINDS: AssetKind[] = ['image', 'video', 'audio', 'model3d', 'document'];
const STATUSES: WorkflowStatus[] = ['editing', 'review', 'approved', 'archived'];
const LEVELS: SecurityLevel[] = ['public', 'internal', 'sensitive'];
const COPYRIGHTS: CopyrightStatus[] = ['confirmed', 'pending', 'third-party'];

function licenseLabel(value: string): string {
  switch (value) {
    case 'internal':
      return '内部使用';
    case 'all-rights':
      return '保留所有权利';
    case 'cc-by':
      return 'CC BY';
    case 'public-domain':
      return '公有领域';
    default:
      return value || '—';
  }
}

export function toMediaAsset(row: ContentRow): MediaAsset {
  const fields = rowFields(row);
  const bytes = number(fields, 'file_size_i');
  const copyright = oneOf(text(fields, 'copyright_status_s'), COPYRIGHTS, 'pending');
  const security = oneOf(text(fields, 'security_level_s'), LEVELS, 'internal');
  const assetCode = text(fields, 'asset_code_s') || text(row, 'id');
  const related: MediaAsset['related'] = [];
  return {
    id: assetCode,
    contentId: text(row, 'id'),
    title: text(row, 'title') || text(fields, 'title_s') || assetCode,
    kind: oneOf(text(fields, 'asset_kind_s'), KINDS, 'document'),
    status: oneOf(text(fields, 'workflow_status_s'), STATUSES, 'editing'),
    security,
    copyright,
    copyrightOwner: text(fields, 'copyright_owner_s') || '—',
    license: licenseLabel(text(fields, 'license_s')),
    licenseUntil: text(fields, 'license_until_dt')
      ? `至 ${text(fields, 'license_until_dt').slice(0, 10)}`
      : undefined,
    size: formatBytes(bytes),
    resolution: text(fields, 'resolution_s') || undefined,
    mime: text(fields, 'mime_type_s') || '—',
    source: text(fields, 'source_s') || '—',
    version: text(fields, 'version_s') || 'v1',
    uploader: text(fields, 'uploader_s') || '—',
    uploadedAt: (text(row, 'updatedAt') || text(row, 'createdAt') || '').replace('T', ' ').slice(0, 16),
    capturedAt: text(fields, 'captured_at_dt')
      ? text(fields, 'captured_at_dt').replace('T', ' ').slice(0, 16)
      : undefined,
    description: text(fields, 'summary_t') || text(fields, 'body_t') || '',
    tags: list(fields, 'tags_ss'),
    aiTags: list(fields, 'ai_tags_ss'),
    event: text(fields, 'event_s') || '—',
    channel: text(fields, 'channel_s') || '—',
    topic: text(fields, 'topic_group_s') || undefined,
    place: text(fields, 'place_s') || '—',
    persons: list(fields, 'persons_ss'),
    subject: text(fields, 'subject_s') || '—',
    sensitive: bool(fields, 'sensitive_flag_b'),
    sensitiveNote: bool(fields, 'sensitive_flag_b')
      ? 'AI 敏感提示：进入人工复核队列，不自动判定、不阻断（FR-GOV-017）。'
      : undefined,
    useCount: number(row, 'viewCount'),
    downloadCount: number(fields, 'download_count_i'),
    visibleRange: copyright === 'pending' ? '仅内部' : security === 'sensitive' ? '受限成员' : '全部成员',
    contentRowId: text(row, 'id'),
    related
  };
}

async function queryRows(
  siteId: string,
  contentType: string,
  status = 'PUBLISHED'
): Promise<ContentRow[] | null> {
  const url =
    `/api/v1/delivery/sites/${encodeURIComponent(siteId)}/contents/query` +
    `?contentType=${encodeURIComponent(contentType)}&limit=50&orderBy=updatedAt&status=${encodeURIComponent(status)}`;
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      credentials: 'include',
      cache: 'no-store'
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as ContentRow[]) : null;
  } catch {
    return null;
  }
}

async function loadFolders(siteId: string): Promise<FolderNode[]> {
  try {
    const response = await fetch(
      `/api/v1/delivery/sites/${encodeURIComponent(siteId)}/folders`,
      {
        headers: { Accept: 'application/json' },
        credentials: 'include',
        cache: 'no-store'
      }
    );
    if (!response.ok) return [];
    const data: unknown = await response.json();
    if (!Array.isArray(data)) return [];
    return data.map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: String(item.id ?? ''),
        title: String(item.title ?? item.name ?? ''),
        path: String(item.path ?? ''),
        count: typeof item.count === 'number' ? item.count : undefined
      };
    });
  } catch {
    return [];
  }
}

function toVersion(row: ContentRow): VersionItem {
  const fields = rowFields(row);
  const label = text(fields, 'version_label_s') || text(fields, 'version_s') || 'v1';
  return {
    label,
    note: text(fields, 'change_note_t') || text(fields, 'summary_t') || '版本快照',
    actor: text(fields, 'actor_s') || text(fields, 'uploader_s') || '系统',
    at: (text(row, 'updatedAt') || text(row, 'createdAt') || '').replace('T', ' ').slice(0, 19),
    change: list(fields, 'changed_fields_ss').join('、') || text(fields, 'version_label_s') || '字段变更'
  };
}

function toShareLink(row: ContentRow): ShareLink {
  const fields = rowFields(row);
  const expires = text(fields, 'expires_at_dt');
  const revoked = bool(fields, 'revoked_b');
  const expired = expires ? new Date(expires).getTime() < Date.now() : false;
  return {
    name: text(row, 'title') || text(fields, 'audience_s') || '分享链接',
    url: text(fields, 'token_hint_s')
      ? `https://media.local/s/${text(fields, 'token_hint_s')}…`
      : '—',
    used: `限次 ${number(fields, 'used_count_i')}/${number(fields, 'max_downloads_i') || '∞'}`,
    expires: expires ? `到期 ${expires.slice(0, 10)}` : '长期',
    expired: revoked || expired
  };
}

const ACTION_LABELS: Record<string, string> = {
  'POST createContent': '创建素材',
  'POST updateContent': '更新素材',
  'POST publishContent': '发布素材',
  'POST updateStatus': '变更状态',
  'POST submitContent': '提交审核',
  'POST approve': '审核通过',
  'POST reject': '审核驳回',
  'POST saveVersion': '保存版本',
  'POST revertVersion': '恢复版本',
  'POST upload': '上传素材',
  'POST download': '下载素材',
  'POST createFolder': '创建栏目',
  'POST updateFolder': '更新栏目',
  'PUT updateContent': '编辑素材',
  'DELETE deleteContent': '删除素材',
  'POST login': '登录',
  'POST logout': '登录',
  'POST import': '导入站点包'
};

function actionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  // POST createContent → 创建内容 等兜底
  const m = action.match(/^(POST|PUT|PATCH|GET|DELETE)\s+(\w+)/);
  if (m) {
    const verb = m[1];
    const name = m[2];
    const verbMap: Record<string, string> = {
      POST: '创建/执行',
      PUT: '更新',
      PATCH: '更新',
      GET: '查看',
      DELETE: '删除'
    };
    return `${verbMap[verb] || verb} ${name}`;
  }
  return action;
}

function activityIcon(action: string): { icon: string; bg: string; color: string } {
  const a = action.toLowerCase();
  if (a.includes('create') || a.includes('upload'))
    return { icon: '↑', bg: 'rgba(0,102,204,0.1)', color: '#0066CC' };
  if (a.includes('approve') || a.includes('publish') || a.includes('status'))
    return { icon: '✓', bg: 'rgba(0,179,65,0.1)', color: '#00B341' };
  if (a.includes('reject') || a.includes('delete'))
    return { icon: '!', bg: 'rgba(211,47,47,0.08)', color: '#D32F2F' };
  if (a.includes('update') || a.includes('save') || a.includes('revert'))
    return { icon: '✎', bg: 'rgba(255,157,0,0.1)', color: '#B36B00' };
  if (a.includes('submit') || a.includes('review'))
    return { icon: '…', bg: 'rgba(233,30,99,0.1)', color: '#E91E63' };
  return { icon: '•', bg: 'rgba(26,26,26,0.05)', color: '#5A5A5A' };
}

interface ActivityRow {
  occurredAt?: string;
  actor?: string;
  actorName?: string;
  action?: string;
  objectType?: string;
  objectId?: string;
  title?: string;
  result?: string;
}

function toActivityItem(row: ActivityRow): ActivityItem {
  const action = row.action || '操作';
  const icon = activityIcon(action);
  const who = row.actorName || row.actor || '系统';
  const title =
    row.title ||
    (row.objectType && row.objectType !== 'ContentController'
      ? row.objectType
      : row.objectType === 'ContentController'
        ? '内容条目'
        : row.objectId
          ? String(row.objectId).slice(0, 8)
          : '');
  const time = (row.occurredAt || '').replace('T', ' ').slice(0, 19);
  const result = row.result && row.result !== 'SUCCESS' ? ` · ${row.result}` : '';
  return {
    icon: icon.icon,
    iconBg: icon.bg,
    iconColor: icon.color,
    action: `${who} ${actionLabel(action)}${result}`,
    description: title ? `对象：${title}` : '站点审计事件',
    time: `${time}${row.objectId ? ` · ${String(row.objectId).slice(0, 8)}` : ''}`
  };
}

/** 最近活动：审计事件流，需站点 read 权限（管理端会话 Cookie）。 */
export async function loadActivities(siteId: string, limit = 50): Promise<ActivityFeed> {
  if (!siteId) {
    return { items: [], total: 0, status: 'error', message: '未注入站点 ID' };
  }
  try {
    const response = await fetch(
      `/api/v1/sites/${encodeURIComponent(siteId)}/dashboard/activity?limit=${limit}`,
      {
        headers: { Accept: 'application/json' },
        credentials: 'include',
        cache: 'no-store'
      }
    );
    if (response.status === 401 || response.status === 403) {
      return {
        items: [],
        total: 0,
        status: 'unauthorized',
        message: '需登录管理端（站点 read 权限）后查看审计活动流'
      };
    }
    if (!response.ok) {
      return { items: [], total: 0, status: 'error', message: `活动接口 HTTP ${response.status}` };
    }
    const data = (await response.json()) as { items?: ActivityRow[]; total?: number };
    const rows = Array.isArray(data.items) ? data.items : [];
    // UI 只展示最近 12 条有意义事件
    return {
      items: rows.map(toActivityItem).slice(0, 12),
      total: typeof data.total === 'number' ? data.total : rows.length,
      status: 'ok'
    };
  } catch {
    return { items: [], total: 0, status: 'error', message: '活动接口网络错误' };
  }
}

export async function loadCatalog(siteId: string): Promise<MamCatalog> {
  if (!siteId) {
    return {
      source: 'empty',
      assets: [],
      versions: [],
      shareLinks: [],
      folders: [],
      activities: [],
      activityTotal: 0,
      activityStatus: 'error',
      activityMessage: '未注入站点 ID',
      error: '未注入站点 ID'
    };
  }
  const [publishedRows, versions, links, folders, activityFeed, adminAssets] = await Promise.all([
    queryRows(siteId, 'media_asset'),
    queryRows(siteId, 'media_version'),
    queryRows(siteId, 'share_link'),
    loadFolders(siteId),
    loadActivities(siteId, 50),
    loadAdminMediaAssets(siteId)
  ]);
  const base = {
    activities: activityFeed.items,
    activityTotal: activityFeed.total,
    activityStatus: activityFeed.status,
    activityMessage: activityFeed.message
  };
  if (publishedRows === null && adminAssets.length === 0) {
    return {
      source: 'empty',
      assets: [],
      versions: [],
      shareLinks: [],
      folders,
      ...base,
      error: '交付查询失败或无权限'
    };
  }

  // 已发布（交付）+ 管理端草稿/未发布（登录后），按 contentId 合并去重
  const mapped: MediaAsset[] = [];
  const seen = new Set<string>();
  for (const row of publishedRows || []) {
    const a = toMediaAsset(row);
    const key = a.contentId || a.id;
    if (seen.has(key)) continue;
    seen.add(key);
    mapped.push(a);
  }
  for (const a of adminAssets) {
    const key = a.contentId || a.id;
    if (!key || seen.has(key)) continue;
    // 同 asset_code 已在已发布列表时跳过（避免重复卡片）
    if (mapped.some((p) => p.id === a.id && p.contentId !== a.contentId)) {
      // 允许多条同码草稿并存；仅当 admin 与 published contentId 不同且 code 相同且 published 已有 → 仍加入（草稿）
    }
    seen.add(key);
    mapped.push(a);
  }

  for (const asset of mapped) {
    asset.related = mapped
      .filter((other) => other.contentId !== asset.contentId && other.id !== asset.id)
      .map((other) => {
        let type: 'batch' | 'event' | 'similar' = 'similar';
        if (other.event === asset.event && asset.event && asset.event !== '—') type = 'event';
        else if (other.topic && other.topic === asset.topic) type = 'batch';
        return {
          id: other.id,
          title: other.title,
          type,
          meta: `${other.id}${type === 'similar' ? ' · 语义相关' : ''}`
        };
      })
      .slice(0, 4);
  }

  return {
    source: mapped.length > 0 ? 'live' : 'empty',
    assets: mapped,
    versions: (versions ?? []).map(toVersion),
    shareLinks: (links ?? []).map(toShareLink),
    folders,
    ...base
  };
}

/**
 * 管理端拉取 media_asset 全部条目（含 DRAFT），从最新版本 fieldValues 还原字段。
 * 未登录/无权限时返回 []（前台仅显示已发布）。
 */
async function loadAdminMediaAssets(siteId: string): Promise<MediaAsset[]> {
  try {
    const ctId = await loadContentTypeId(siteId, 'media_asset');
    if (!ctId) return [];
    const listRes = await fetch(
      `/api/v1/sites/${encodeURIComponent(siteId)}/content-types/${encodeURIComponent(ctId)}/contents`,
      { headers: { Accept: 'application/json' }, credentials: 'include', cache: 'no-store' }
    );
    if (!listRes.ok) return [];
    const list = (await listRes.json()) as Array<{
      id?: string;
      title?: string;
      status?: string;
      updatedAt?: string;
      createdAt?: string;
    }>;
    if (!Array.isArray(list) || list.length === 0) return [];

    const rows = await Promise.all(
      list.map(async (item): Promise<ContentRow | null> => {
        if (!item.id) return null;
        try {
          const vRes = await fetch(`/api/v1/contents/${encodeURIComponent(item.id)}/versions`, {
            headers: { Accept: 'application/json' },
            credentials: 'include',
            cache: 'no-store'
          });
          let fields: Record<string, unknown> = {};
          if (vRes.ok) {
            const vers = (await vRes.json()) as AdminVersionRow[];
            const latest = (vers || [])[0];
            if (latest?.fieldValues) fields = parseFieldValues(latest.fieldValues);
          }
          // 内容状态映射：DRAFT 且无 workflow 字段时视为编目中
          if (!fields.workflow_status_s && item.status === 'DRAFT') {
            fields.workflow_status_s = 'editing';
          }
          if (!fields.asset_code_s && item.title) {
            // 保留可读编码兜底
            fields.asset_code_s = fields.asset_code_s || '';
          }
          return {
            id: item.id,
            title: item.title,
            status: item.status,
            updatedAt: item.updatedAt || item.createdAt,
            createdAt: item.createdAt,
            fields
          };
        } catch {
          return null;
        }
      })
    );

    return rows
      .filter((r): r is ContentRow => r != null)
      .map((row) => {
        const asset = toMediaAsset(row);
        const code = text(rowFields(row), 'asset_code_s');
        if (code) asset.id = code;
        // 草稿 contentId 供详情路由
        asset.contentId = text(row, 'id');
        return asset;
      });
  } catch {
    return [];
  }
}

export async function loadAssetByCode(
  siteId: string,
  assetCode: string
): Promise<MediaAsset | null> {
  if (!siteId || !assetCode) return null;
  const detail = await loadAssetDetail(siteId, assetCode);
  return detail.asset;
}

export type DetailStatus = 'ok' | 'not-found' | 'unauthorized' | 'error' | 'loading';

export interface ContentOperation {
  action: string;
  at: string;
  actor: string;
  detail: string;
  /** version = 版本历史；audit = 审计事件 */
  source: 'version' | 'audit';
}

/** 详情「操作记录」：内容版本历史 + 站点审计中 objectId 命中的事件（均来自后台）。 */
export async function loadContentOperations(
  siteId: string,
  contentId: string
): Promise<ContentOperation[]> {
  if (!contentId) return [];
  const ops: ContentOperation[] = [];

  // 1) 版本历史（GET /contents/{id}/versions）
  try {
    const res = await fetch(`/api/v1/contents/${encodeURIComponent(contentId)}/versions`, {
      headers: { Accept: 'application/json' },
      credentials: 'include',
      cache: 'no-store'
    });
    if (res.ok) {
      const list = (await res.json()) as AdminVersionRow[];
      for (const row of list || []) {
        const at = (row.createdAt || '').replace('T', ' ').slice(0, 19);
        const actor = row.createdByName || row.createdBy || '系统';
        let action = '保存版本';
        if (row.published) action = '发布';
        else if (row.revertedFrom != null) action = `恢复自 v${row.revertedFrom}`;
        else if (/初始/.test(row.note || '')) action = '创建内容';
        else if (/提交|审核/.test(row.note || '')) action = row.note || '提交审核';
        else if (row.note) action = row.note;
        ops.push({
          action,
          at,
          actor,
          detail: `版本 v${row.version}${row.published ? ' · 发布版本' : ''}${row.note ? ` · ${row.note}` : ''}`,
          source: 'version'
        });
      }
    }
  } catch {
    /* ignore */
  }

  // 2) 站点审计中绑定到本内容的事件（objectId 匹配）
  if (siteId) {
    try {
      const res = await fetch(
        `/api/v1/sites/${encodeURIComponent(siteId)}/dashboard/activity?limit=100`,
        {
          headers: { Accept: 'application/json' },
          credentials: 'include',
          cache: 'no-store'
        }
      );
      if (res.ok) {
        const data = (await res.json()) as {
          items?: {
            occurredAt?: string;
            actorName?: string;
            actor?: string;
            action?: string;
            objectId?: string;
            objectType?: string;
            title?: string;
            result?: string;
          }[];
        };
        for (const item of data.items || []) {
          if (!item.objectId || item.objectId !== contentId) continue;
          ops.push({
            action: item.action || '操作',
            at: (item.occurredAt || '').replace('T', ' ').slice(0, 19),
            actor: item.actorName || item.actor || '系统',
            detail: `${item.objectType || '对象'}${item.title ? ` · ${item.title}` : ''}${
              item.result && item.result !== 'SUCCESS' ? ` · ${item.result}` : ''
            }`,
            source: 'audit'
          });
        }
      }
    } catch {
      /* ignore */
    }
  }

  // 去重：同 action+at 优先 audit
  const seen = new Set<string>();
  ops.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return ops.filter((op) => {
    const key = `${op.at}|${op.action}|${op.actor}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface AssetDetailResult {
  asset: MediaAsset | null;
  versions: VersionItem[];
  shareLinks: ShareLink[];
  status: DetailStatus;
  message?: string;
  /** content UUID（后台条目主键），用于版本/分享等写读接口。 */
  contentId?: string;
}

/**
 * 审核操作：通过版本快照更新 workflow_status_s + 内容发布状态。
 * approve → approved + PUBLISHED；reject → editing + DRAFT。
 */
export async function performReview(
  siteId: string,
  contentId: string,
  action: 'approve' | 'reject',
  comment?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!siteId || !contentId) return { ok: false, error: '缺少站点或内容 ID' };

  // 1) 读取当前 fieldValues（最新版本）
  let fieldValues = '{}';
  try {
    const verRes = await fetch(`/api/v1/contents/${encodeURIComponent(contentId)}/versions`, {
      headers: { Accept: 'application/json' },
      credentials: 'include',
      cache: 'no-store'
    });
    if (verRes.ok) {
      const list = (await verRes.json()) as AdminVersionRow[];
      if (list?.[0]?.fieldValues) fieldValues = list[0].fieldValues;
    }
  } catch {
    /* keep {} */
  }

  // 2) 更新 workflow_status_s 并保存新版本
  const workflow = action === 'approve' ? 'approved' : 'editing';
  let fields: Record<string, unknown> = {};
  try {
    fields = parseFieldValues(fieldValues);
  } catch {
    fields = {};
  }
  fields.workflow_status_s = workflow;
  const note =
    action === 'approve'
      ? `审核通过${comment ? `：${comment}` : ''}`
      : `驳回${comment ? `：${comment}` : ''}`;

  try {
    const save = await fetch(`/api/v1/contents/${encodeURIComponent(contentId)}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        fieldValues: JSON.stringify(fields),
        note
      })
    });
    if (!save.ok) {
      let msg = `保存版本失败（HTTP ${save.status}）`;
      try {
        const b = (await save.json()) as { message?: string };
        if (b.message) msg = b.message;
      } catch {
        /* ignore */
      }
      return { ok: false, error: msg };
    }
  } catch {
    return { ok: false, error: '网络错误，保存版本失败' };
  }

  // 3) 内容状态：通过 → PUBLISHED；驳回 → DRAFT
  const contentStatus = action === 'approve' ? 'PUBLISHED' : 'DRAFT';
  try {
    const res = await fetch(`/api/v1/contents/${encodeURIComponent(contentId)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: contentStatus })
    });
    if (!res.ok && res.status !== 204) {
      let msg = `更新内容状态失败（HTTP ${res.status}）`;
      try {
        const b = (await res.json()) as { message?: string };
        if (b.message) msg = b.message;
      } catch {
        /* ignore */
      }
      return { ok: false, error: msg };
    }
  } catch {
    return { ok: false, error: '网络错误，更新内容状态失败' };
  }

  return { ok: true };
}

interface AdminVersionRow {
  id?: string;
  version?: number;
  fieldValues?: string;
  note?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
  published?: boolean;
  revertedFrom?: number;
}

function parseFieldValues(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function toVersionFromAdmin(row: AdminVersionRow): VersionItem {
  const label = row.version != null ? `v${row.version}` : 'v1';
  const note = row.note || (row.published ? '发布版本' : '版本快照');
  return {
    label,
    current: row.published === true,
    note,
    actor: row.createdByName || row.createdBy || '系统',
    at: (row.createdAt || '').replace('T', ' ').slice(0, 19),
    change:
      row.revertedFrom != null
        ? `恢复自 v${row.revertedFrom}`
        : row.published
          ? '发布'
          : note
  };
}

function toShareFromAdmin(row: Record<string, unknown>): ShareLink {
  const expires = text(row, 'expires_at_dt') || text(row, 'expiresAt');
  const revoked = bool(row, 'revoked_b') || bool(row, 'revoked');
  const expired = expires ? new Date(expires).getTime() < Date.now() : false;
  const max = number(row, 'max_downloads_i') || number(row, 'maxDownloads');
  const used = number(row, 'used_count_i') || number(row, 'usedCount');
  const hint = text(row, 'token_hint_s') || text(row, 'tokenHint');
  return {
    name: text(row, 'title') || text(row, 'audience_s') || text(row, 'audience') || '分享链接',
    url: hint ? `https://media.local/s/${hint}…` : '—',
    used: max ? `限次 ${used}/${max}` : used ? `已用 ${used}` : '限次 —',
    expires: expires ? `到期 ${expires.slice(0, 10)}` : '长期',
    expired: revoked || expired
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assetFromAdminFields(
  contentId: string,
  title: string,
  fields: Record<string, unknown>
): MediaAsset {
  const row: ContentRow = {
    id: contentId,
    title,
    status: 'DRAFT',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fields
  };
  const asset = toMediaAsset(row);
  asset.contentId = contentId;
  asset.contentRowId = contentId;
  return asset;
}

/**
 * 内容详情 API：
 * 1) UUID → 管理端 GET /contents/{id} + versions（支持草稿）
 * 2) 资产编码 → 交付查询（已发布）；未命中再回退管理端列表
 * 3) 已登录时增强 shares
 */
export async function loadAssetDetail(
  siteId: string,
  assetCode: string
): Promise<AssetDetailResult> {
  const empty: AssetDetailResult = {
    asset: null,
    versions: [],
    shareLinks: [],
    status: 'loading'
  };
  if (!siteId || !assetCode) {
    return { ...empty, status: 'error', message: '缺少站点或资产编码' };
  }

  let asset: MediaAsset | null = null;
  let contentId = '';
  let versions: VersionItem[] = [];
  let shareLinks: ShareLink[] = [];
  let status: DetailStatus = 'ok';
  let message: string | undefined;

  if (UUID_RE.test(assetCode)) {
    // 直接按 content UUID 拉详情（草稿/未发布）
    contentId = assetCode;
    try {
      const res = await fetch(`/api/v1/contents/${encodeURIComponent(contentId)}`, {
        headers: { Accept: 'application/json' },
        credentials: 'include',
        cache: 'no-store'
      });
      if (res.status === 401 || res.status === 403) {
        return { ...empty, status: 'unauthorized', message: '草稿详情需登录管理端' };
      }
      if (res.status === 404) {
        return { ...empty, status: 'not-found', message: '内容不存在' };
      }
      if (!res.ok) {
        return { ...empty, status: 'error', message: `详情接口 HTTP ${res.status}` };
      }
      const meta = (await res.json()) as { id?: string; title?: string; contentTypeId?: string };
      const verRes = await fetch(`/api/v1/contents/${encodeURIComponent(contentId)}/versions`, {
        headers: { Accept: 'application/json' },
        credentials: 'include',
        cache: 'no-store'
      });
      let fields: Record<string, unknown> = {};
      if (verRes.ok) {
        const list = (await verRes.json()) as AdminVersionRow[];
        versions = (list || []).map(toVersionFromAdmin);
        versions.sort((a, b) => {
          const na = parseInt(a.label.replace(/\D/g, ''), 10) || 0;
          const nb = parseInt(b.label.replace(/\D/g, ''), 10) || 0;
          return nb - na;
        });
        if (versions.length > 0) versions[0] = { ...versions[0], current: true };
        const latest = (list || [])[0];
        if (latest?.fieldValues) fields = parseFieldValues(latest.fieldValues);
      }
      asset = assetFromAdminFields(contentId, meta.title || assetCode, fields);
      // 若有 asset_code 字段，优先用它作为路由 id 展示
      const code = text(fields, 'asset_code_s');
      if (code) asset.id = code;
    } catch {
      return { ...empty, status: 'error', message: '详情请求失败' };
    }
  } else {
    // 资产编码：交付查询（已发布）
    const rows = await queryRows(siteId, 'media_asset');
    if (rows === null) {
      return { ...empty, status: 'error', message: '交付查询失败' };
    }
    const row =
      rows.find((r) => {
        const f = rowFields(r);
        return text(f, 'asset_code_s') === assetCode || text(r, 'id') === assetCode;
      }) || null;

    if (row) {
      asset = toMediaAsset(row);
      contentId = text(row, 'id');
      asset.contentId = contentId;
      asset.related = [];
    } else {
      // 回退：管理端按类型列出并匹配 versions 中的 asset_code（草稿）
      try {
        const ctId = await loadContentTypeId(siteId, 'media_asset');
        if (ctId) {
          const listRes = await fetch(
            `/api/v1/sites/${encodeURIComponent(siteId)}/content-types/${encodeURIComponent(ctId)}/contents`,
            { headers: { Accept: 'application/json' }, credentials: 'include', cache: 'no-store' }
          );
          if (listRes.ok) {
            const list = (await listRes.json()) as Array<{ id?: string; title?: string }>;
            for (const item of list) {
              if (!item.id) continue;
              const vRes = await fetch(`/api/v1/contents/${encodeURIComponent(item.id)}/versions`, {
                headers: { Accept: 'application/json' },
                credentials: 'include',
                cache: 'no-store'
              });
              if (!vRes.ok) continue;
              const vers = (await vRes.json()) as AdminVersionRow[];
              const latest = vers?.[0];
              if (!latest?.fieldValues) continue;
              const fields = parseFieldValues(latest.fieldValues);
              if (text(fields, 'asset_code_s') === assetCode) {
                contentId = item.id;
                versions = vers.map(toVersionFromAdmin);
                versions.sort((a, b) => {
                  const na = parseInt(a.label.replace(/\D/g, ''), 10) || 0;
                  const nb = parseInt(b.label.replace(/\D/g, ''), 10) || 0;
                  return nb - na;
                });
                if (versions.length > 0) versions[0] = { ...versions[0], current: true };
                asset = assetFromAdminFields(item.id, item.title || assetCode, fields);
                break;
              }
            }
          }
        }
      } catch {
        /* fallthrough */
      }
      if (!asset) {
        return { ...empty, status: 'not-found', message: '无对应素材（含未发布草稿）' };
      }
    }
  }

  // 分享链接（需登录，尽力而为）
  if (contentId) {
    try {
      const shareRes = await fetch(
        `/api/v1/sites/${encodeURIComponent(siteId)}/contents/${encodeURIComponent(contentId)}/shares`,
        { headers: { Accept: 'application/json' }, credentials: 'include', cache: 'no-store' }
      );
      if (shareRes.ok) {
        const data: unknown = await shareRes.json();
        if (Array.isArray(data)) {
          shareLinks = (data as Record<string, unknown>[]).map(toShareFromAdmin);
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (versions.length === 0 && asset) {
    versions = [
      {
        label: asset.version || 'v1',
        current: true,
        note: '当前快照',
        actor: asset.uploader,
        at: asset.uploadedAt,
        change: '详情加载'
      }
    ];
  }

  // 关联素材（仅已发布列表）
  try {
    const rows = await queryRows(siteId, 'media_asset');
    if (rows && asset) {
      const mappedAll = rows.map(toMediaAsset);
      asset.related = mappedAll
        .filter((other) => other.id !== asset!.id)
        .map((other) => {
          let type: 'batch' | 'event' | 'similar' = 'similar';
          if (other.event === asset!.event && asset!.event && asset!.event !== '—') type = 'event';
          else if (other.topic && other.topic === asset!.topic) type = 'batch';
          return {
            id: other.id,
            title: other.title,
            type,
            meta: `${other.id}${type === 'similar' ? ' · 语义相关' : ''}`
          };
        })
        .slice(0, 4);
    }
  } catch {
    /* ignore */
  }

  return {
    asset,
    versions,
    shareLinks,
    status,
    message,
    contentId
  };
}

/** 由素材列表推导审核队列（工作流状态=待审核）。 */
export function buildReviewItems(assets: MediaAsset[]): ReviewItem[] {
  return assets
    .filter((a) => a.status === 'review')
    .map((asset) => {
      const flags: ReviewItem['flags'] = [{ text: `等待 ${asset.uploadedAt || '—'}`, kind: 'wait' }];
      if (asset.sensitive) flags.push({ text: 'AI 敏感提示', kind: 'sensitive' });
      if (asset.copyright === 'pending') flags.push({ text: '版权未确认', kind: 'copyright' });
      if (asset.copyright === 'confirmed' && !asset.sensitive) flags.push({ text: '可终审', kind: 'verdict' });
      // 待我审核 = 全部待审；敏感/版权为专项页签（同一 item 可多页签命中，调用方过滤）
      const tabs: Array<'mine' | 'sensitive' | 'copyright'> = ['mine'];
      if (asset.sensitive) tabs.push('sensitive');
      if (asset.copyright === 'pending') tabs.push('copyright');
      return {
        asset,
        submitter: asset.uploader,
        cataloger: '—',
        wait: asset.uploadedAt ? asset.uploadedAt.slice(11, 16) || '近期' : '—',
        waitSub: 'SLA 内',
        mutex: false,
        flags,
        tab: tabs.includes('sensitive') && asset.sensitive
          ? 'sensitive'
          : tabs.includes('copyright') && asset.copyright === 'pending'
            ? 'copyright'
            : 'mine',
        tabs
      } as ReviewItem & { tabs: typeof tabs };
    });
}

/** 工作台四态计数：优先用已加载素材，不足时用设计基线补齐展示。 */
export function workflowCounts(assets: MediaAsset[]) {
  const c = { editing: 0, review: 0, approved: 0, archived: 0 };
  assets.forEach((a) => {
    c[a.status] += 1;
  });
  const hasData = assets.length > 0;
  return {
    editing: hasData ? c.editing : 0,
    review: hasData ? c.review : 0,
    approved: hasData ? c.approved : 0,
    archived: hasData ? c.archived : 0,
    live: hasData
  };
}
