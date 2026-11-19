import type {
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

export interface MamCatalog {
  source: DataSource;
  assets: MediaAsset[];
  versions: VersionItem[];
  shareLinks: ShareLink[];
  folders: FolderNode[];
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

export async function loadCatalog(siteId: string): Promise<MamCatalog> {
  if (!siteId) {
    return { source: 'empty', assets: [], versions: [], shareLinks: [], folders: [], error: '未注入站点 ID' };
  }
  const [assets, versions, links, folders] = await Promise.all([
    queryRows(siteId, 'media_asset'),
    queryRows(siteId, 'media_version'),
    queryRows(siteId, 'share_link'),
    loadFolders(siteId)
  ]);
  if (assets === null) {
    return {
      source: 'empty',
      assets: [],
      versions: [],
      shareLinks: [],
      folders,
      error: '交付查询失败或无权限'
    };
  }
  const mapped = assets.map(toMediaAsset);
  // 关联素材：同事件/同专题
  for (const asset of mapped) {
    asset.related = mapped
      .filter((other) => other.id !== asset.id)
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
    folders
  };
}

export async function loadAssetByCode(
  siteId: string,
  assetCode: string
): Promise<MediaAsset | null> {
  if (!siteId || !assetCode) return null;
  const catalog = await loadCatalog(siteId);
  return catalog.assets.find((a) => a.id === assetCode) || null;
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
