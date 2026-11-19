export type AssetKind = 'image' | 'video' | 'audio' | 'model3d' | 'document';
export type WorkflowStatus = 'editing' | 'review' | 'approved' | 'archived';
export type SecurityLevel = 'public' | 'internal' | 'sensitive';
export type CopyrightStatus = 'confirmed' | 'pending' | 'third-party';
export type ViewMode = 'grid' | 'list' | 'timeline';
export type SearchMode = 'keyword' | 'semantic';
export type ReviewTab = 'mine' | 'sensitive' | 'copyright' | 'done';
export type AiTab = 'pending' | 'adopted' | 'ignored' | 'sensitive' | 'tasks';

export interface MediaAsset {
  id: string;
  title: string;
  kind: AssetKind;
  status: WorkflowStatus;
  security: SecurityLevel;
  copyright: CopyrightStatus;
  copyrightOwner: string;
  license: string;
  licenseUntil?: string;
  size: string;
  resolution?: string;
  mime: string;
  source: string;
  version: string;
  uploader: string;
  uploadedAt: string;
  capturedAt?: string;
  description: string;
  tags: string[];
  aiTags: string[];
  event: string;
  channel: string;
  topic?: string;
  place: string;
  persons: string[];
  subject: string;
  sensitive?: boolean;
  sensitiveNote?: string;
  sensitiveVerdict?: { by: string; result: string; at: string };
  useCount: number;
  downloadCount: number;
  visibleRange: string;
  related?: { id: string; title: string; type: 'batch' | 'event' | 'similar'; meta: string }[];
}

export interface VersionItem {
  label: string;
  current?: boolean;
  note: string;
  actor: string;
  at: string;
  change: string;
}

export interface AuditItem {
  action: string;
  at: string;
  actor: string;
  detail: string;
}

export interface ShareLink {
  name: string;
  url: string;
  used: string;
  expires: string;
  expired?: boolean;
}

export interface ReviewItem {
  asset: MediaAsset;
  submitter: string;
  cataloger: string;
  wait: string;
  waitSub: string;
  mutex?: boolean;
  flags: { text: string; kind: 'wait' | 'sensitive' | 'copyright' | 'mutex' | 'verdict' }[];
  tab: ReviewTab | 'done';
}

export interface AiTask {
  id: string;
  type: string;
  badge: string;
  badgeKind: 'ai' | 'base' | 'external';
  assetId: string;
  assetTitle: string;
  at: string;
  preview: string;
  status: 'pending' | 'adopted' | 'ignored' | 'external';
}

export interface ActivityItem {
  icon: string;
  iconBg: string;
  iconColor: string;
  action: string;
  badge?: string;
  description: string;
  time: string;
}

export interface MetricItem {
  label: string;
  current: string;
  baseline: string;
  delta: string;
  down?: boolean;
}
