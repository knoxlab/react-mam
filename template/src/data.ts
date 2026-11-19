import type {
  ActivityItem,
  AiTask,
  AuditItem,
  MediaAsset,
  MetricItem,
  ReviewItem,
  ShareLink,
  VersionItem
} from './types';

export const CURRENT_USER = {
  name: '张记者',
  role: '记者/编目',
  isSubmitter: true,
  canReview: false
};

export const METRICS: MetricItem[] = [
  { label: '资源利用率', current: '63.2%', baseline: '基线 58.0%', delta: '+5.2pp' },
  { label: '检索效率（有结果占比）', current: '91.5%', baseline: '基线 87.0%', delta: '+4.5pp' },
  { label: '内容加工时长', current: '1.8 日', baseline: '基线 2.5 日', delta: '-0.7 日', down: false },
  { label: '用户满意度', current: '4.3', baseline: '基线 3.9', delta: '+0.4' }
];

export const ACTIVITIES: ActivityItem[] = [
  {
    icon: '✓',
    iconBg: 'rgba(0, 179, 65, 0.1)',
    iconColor: '#00B341',
    action: '陈审核员 审核通过',
    description: '素材 "市长调研产业园区视频" 已通过审核，进入可用媒资库',
    time: '2026-11-19 14:23 · ID: MA-2026-10-156'
  },
  {
    icon: '✎',
    iconBg: 'rgba(255, 157, 0, 0.1)',
    iconColor: '#B36B00',
    action: '刘编目员 完成编目',
    description: '为素材添加标签：#产业发展 #调研活动 #园区建设，并补充元数据',
    time: '2026-11-19 13:45 · ID: MA-2026-11-001'
  },
  {
    icon: 'AI',
    iconBg: 'rgba(0, 102, 204, 0.1)',
    iconColor: '#0066CC',
    action: 'AI 生成建议',
    badge: 'AI 辅助',
    description: '为视频素材生成转写文本、摘要与标签建议，等待人工审核确认',
    time: '2026-11-19 13:12 · ID: MA-2026-11-002'
  },
  {
    icon: '!',
    iconBg: 'rgba(233, 30, 99, 0.1)',
    iconColor: '#E91E63',
    action: '系统提示 需要版权确认',
    description: '素材 "第三方提供的宣传图" 缺少版权信息，已进入人工复核队列',
    time: '2026-11-19 11:08 · ID: MA-2026-11-005'
  },
  {
    icon: '↑',
    iconBg: 'rgba(26, 26, 26, 0.05)',
    iconColor: '#5A5A5A',
    action: '张记者 上传素材',
    description: '上传 3 个图片素材和 1 个视频素材，自动进入编目流程',
    time: '2026-11-19 09:34 · 批次: BATCH-2026-11-19-01'
  }
];

export const ASSETS: MediaAsset[] = [
  {
    id: 'MA-2026-11-001',
    title: '市长调研产业园区现场照片',
    kind: 'image',
    status: 'approved',
    security: 'internal',
    copyright: 'confirmed',
    copyrightOwner: '市新闻中心',
    license: '内部使用',
    licenseUntil: '至 2027-11-19',
    size: '2.4MB',
    resolution: '3840 × 2160',
    mime: 'image/jpeg',
    source: '市新闻中心 · 记者现场采集',
    version: 'v3',
    uploader: '张记者',
    uploadedAt: '2026-11-19 09:34',
    capturedAt: '2026-11-18 10:35',
    description:
      '市长带队调研高新技术产业园区，现场了解企业发展情况，听取园区管委会工作汇报。照片拍摄于园区管理中心会议室。',
    tags: ['产业发展', '调研活动', '园区建设'],
    aiTags: ['高新技术', '企业调研', '政府活动', '经济发展'],
    event: '市长调研',
    channel: '政务要闻',
    topic: '高新区建设',
    place: '高新区',
    persons: ['张市长', '园区主任'],
    subject: '经济发展',
    useCount: 3,
    downloadCount: 1,
    visibleRange: '全部成员',
    related: [
      { id: 'MA-2026-11-002', title: '园区入口实景照片', type: 'batch', meta: 'MA-2026-11-002' },
      { id: 'MA-2026-10-088', title: '高新区企业座谈会', type: 'similar', meta: 'MA-2026-10-088 · 相似度 86%' }
    ]
  },
  {
    id: 'MA-2026-11-002',
    title: '城市建设成果宣传片',
    kind: 'video',
    status: 'approved',
    security: 'public',
    copyright: 'confirmed',
    copyrightOwner: '市融媒体中心',
    license: '内部使用',
    licenseUntil: '至 2028-06-30',
    size: '156MB',
    resolution: '1920 × 1080',
    mime: 'video/mp4',
    source: '市融媒体中心 · 制作部',
    version: 'v2',
    uploader: '李编辑',
    uploadedAt: '2026-11-18 16:20',
    capturedAt: '2026-11-16 09:00',
    description:
      '宣传片围绕老旧小区改造、市政路网升级与公园绿地建设三条主线，展示近三年城市建设阶段性成果。',
    tags: ['城市建设', '宣传片'],
    aiTags: ['城市建设', '民生工程'],
    event: '两会报道',
    channel: '专题报道',
    topic: '高新区建设',
    place: '滨江新区',
    persons: ['李副市长'],
    subject: '民生保障',
    useCount: 12,
    downloadCount: 5,
    visibleRange: '全部成员',
    related: [{ id: 'MA-2026-11-001', title: '市长调研现场照片', type: 'event', meta: '同事件' }]
  },
  {
    id: 'MA-2026-11-003',
    title: '市民采访音频素材',
    kind: 'audio',
    status: 'review',
    security: 'internal',
    copyright: 'pending',
    copyrightOwner: '—',
    license: '内部使用',
    size: '8.7MB',
    mime: 'audio/mpeg',
    source: '外采 · 王记者',
    version: 'v1',
    uploader: '王记者',
    uploadedAt: '2026-11-18 14:12',
    capturedAt: '2026-11-18 11:20',
    description: '老旧小区改造回访市民采访录音，含三位受访者发言片段。',
    tags: ['采访', '民生'],
    aiTags: ['民生', '社区改造'],
    event: '市长调研',
    channel: '民生关注',
    place: '老城区',
    persons: ['受访市民'],
    subject: '民生保障',
    useCount: 0,
    downloadCount: 0,
    visibleRange: '仅内部',
    sensitive: false
  },
  {
    id: 'MA-2026-11-004',
    title: '政策解读文件包',
    kind: 'document',
    status: 'approved',
    security: 'public',
    copyright: 'confirmed',
    copyrightOwner: '市政府办公厅',
    license: '内部使用',
    licenseUntil: '至 2027-12-31',
    size: '1.2MB',
    mime: 'application/pdf',
    source: '市政府办公厅 · 政策处',
    version: 'v1',
    uploader: '赵编辑',
    uploadedAt: '2026-11-17 10:05',
    description: '优化营商环境相关政策解读文件合集，含图文说明与问答。',
    tags: ['政策', '解读'],
    aiTags: ['政策', '营商环境'],
    event: '—',
    channel: '政务要闻',
    topic: '优化营商环境',
    place: '—',
    persons: [],
    subject: '经济发展',
    useCount: 8,
    downloadCount: 3,
    visibleRange: '全部成员'
  },
  {
    id: 'MA-2026-11-005',
    title: '第三方提供的宣传图',
    kind: 'image',
    status: 'review',
    security: 'internal',
    copyright: 'pending',
    copyrightOwner: '待确认',
    license: '内部使用',
    size: '3.8MB',
    mime: 'image/png',
    source: '第三方供稿',
    version: 'v1',
    uploader: '孙记者',
    uploadedAt: '2026-11-17 15:40',
    description: '第三方机构提供的宣传用图，版权凭证尚未归档。',
    tags: ['宣传', '供稿'],
    aiTags: [],
    event: '—',
    channel: '专题报道',
    place: '—',
    persons: [],
    subject: '经济发展',
    useCount: 0,
    downloadCount: 0,
    visibleRange: '仅内部',
    sensitive: false
  },
  {
    id: 'MA-2026-11-006',
    title: '环境保护专题片',
    kind: 'video',
    status: 'approved',
    security: 'public',
    copyright: 'confirmed',
    copyrightOwner: '市生态环境局',
    license: '内部使用',
    size: '204MB',
    resolution: '3840 × 2160',
    mime: 'video/mp4',
    source: '市生态环境局 · 宣教中心',
    version: 'v1',
    uploader: '周编辑',
    uploadedAt: '2026-11-16 09:18',
    description: '生态文明建设专题片，覆盖河道治理、公园绿化与低碳出行。',
    tags: ['环保', '专题'],
    aiTags: ['生态保护'],
    event: '—',
    channel: '专题报道',
    place: '滨江新区',
    persons: [],
    subject: '生态保护',
    useCount: 6,
    downloadCount: 2,
    visibleRange: '全部成员'
  },
  {
    id: 'MA-2026-11-007',
    title: '教育改革成果展示',
    kind: 'image',
    status: 'review',
    security: 'sensitive',
    copyright: 'confirmed',
    copyrightOwner: '市教育局',
    license: '内部使用',
    size: '5.1MB',
    mime: 'image/jpeg',
    source: '市教育局 · 办公室',
    version: 'v1',
    uploader: '吴记者',
    uploadedAt: '2026-11-16 11:02',
    description: '教育改革成果展示图片组，含校园活动与教学现场。',
    tags: ['教育', '改革'],
    aiTags: ['教育'],
    event: '—',
    channel: '民生关注',
    place: '老城区',
    persons: [],
    subject: '民生保障',
    sensitive: true,
    sensitiveNote: '检测到可能涉及未成年人影像，建议人工复核发布口径。提示仅为辅助，不阻断业务流程。',
    sensitiveVerdict: { by: '陈审核员', result: '通过（脱敏后可用）', at: '2026-11-17 10:15' },
    useCount: 1,
    downloadCount: 0,
    visibleRange: '受限成员'
  },
  {
    id: 'MA-2026-11-008',
    title: '文化活动现场录音',
    kind: 'audio',
    status: 'archived',
    security: 'public',
    copyright: 'confirmed',
    copyrightOwner: '市文旅局',
    license: '内部使用',
    size: '15.4MB',
    mime: 'audio/wav',
    source: '市文旅局 · 活动组',
    version: 'v1',
    uploader: '郑记者',
    uploadedAt: '2026-11-15 17:44',
    description: '文化惠民演出现场录音，已归档保留索引与来源，可授权复用。',
    tags: ['文化', '活动'],
    aiTags: ['文化惠民'],
    event: '—',
    channel: '专题报道',
    topic: '文化惠民',
    place: '滨江新区',
    persons: [],
    subject: '民生保障',
    useCount: 4,
    downloadCount: 1,
    visibleRange: '全部成员'
  },
  {
    id: 'MA-2026-11-009',
    title: '会展中心三维场景模型',
    kind: 'model3d',
    status: 'approved',
    security: 'internal',
    copyright: 'confirmed',
    copyrightOwner: '技术部',
    license: '内部使用',
    size: '86MB',
    mime: 'model/gltf-binary',
    source: '技术部 · 数字孪生组',
    version: 'v1',
    uploader: '技术部',
    uploadedAt: '2026-11-16 14:30',
    description: '会展中心室内三维场景模型，用于虚拟展陈与导览预览。',
    tags: ['三维模型', '会展'],
    aiTags: ['三维'],
    event: '—',
    channel: '政务要闻',
    place: '高新区',
    persons: [],
    subject: '经济发展',
    useCount: 2,
    downloadCount: 0,
    visibleRange: '全部成员'
  },
  {
    id: 'MA-2026-11-021',
    title: '防汛应急演练现场视频',
    kind: 'video',
    status: 'review',
    security: 'internal',
    copyright: 'confirmed',
    copyrightOwner: '市应急管理局',
    license: '内部使用',
    size: '320MB',
    resolution: '1920 × 1080',
    mime: 'video/mp4',
    source: '市应急管理局 · 宣传科',
    version: 'v1',
    uploader: '王记者',
    uploadedAt: '2026-11-19 08:10',
    description: '防汛应急综合演练现场实录，含指挥部调度与抢险分队行动。',
    tags: ['防汛', '应急'],
    aiTags: ['应急演练'],
    event: '防汛应急',
    channel: '政务要闻',
    place: '滨江新区',
    persons: ['指挥长'],
    subject: '民生保障',
    sensitive: true,
    sensitiveNote: '检测到可能涉及政务活动表述，建议人工复核发布口径。',
    sensitiveVerdict: { by: '陈审核员', result: '通过', at: '2026-11-19 12:40' },
    useCount: 0,
    downloadCount: 0,
    visibleRange: '仅内部'
  },
  {
    id: 'MA-2026-11-030',
    title: '政策解读文件包（补充材料）',
    kind: 'document',
    status: 'review',
    security: 'sensitive',
    copyright: 'confirmed',
    copyrightOwner: '市政府办公厅',
    license: '内部使用',
    size: '0.9MB',
    mime: 'application/pdf',
    source: '市政府办公厅 · 政策处',
    version: 'v1',
    uploader: '赵编辑',
    uploadedAt: '2026-11-19 10:05',
    description: '政策解读补充材料，含内部口径说明，需敏感复核。',
    tags: ['政策', '补充'],
    aiTags: [],
    event: '—',
    channel: '政务要闻',
    topic: '优化营商环境',
    place: '—',
    persons: [],
    subject: '经济发展',
    sensitive: true,
    sensitiveNote: 'AI 提示：涉政策内部表述需复核。提示不自动判定、不阻断（FR-GOV-017）。',
    useCount: 0,
    downloadCount: 0,
    visibleRange: '仅内部'
  }
];

export const VERSIONS: VersionItem[] = [
  {
    label: 'v3',
    current: true,
    note: '审核通过，进入可用媒资库',
    actor: '陈审核员',
    at: '2026-11-19 14:23:15',
    change: '状态、审核意见'
  },
  {
    label: 'v2',
    note: '完成编目，补充标题、描述与标签',
    actor: '刘编目员',
    at: '2026-11-19 11:45:22',
    change: '标题、描述、标签 ×3'
  },
  {
    label: 'v1',
    note: '原始上传快照',
    actor: '张记者',
    at: '2026-11-19 09:34:11',
    change: 'IMG_20261118_103542.jpg'
  }
];

export const AUDITS: AuditItem[] = [
  {
    action: '审核通过',
    at: '2026-11-19 14:23:15',
    actor: '陈审核员',
    detail: '审核通过此素材，进入可用媒资库\n审核意见: 内容真实准确，符合发布规范，版权信息完整'
  },
  {
    action: '敏感判定',
    at: '2026-11-19 14:20:03',
    actor: '陈审核员',
    detail: '完成敏感提示人工判定：通过'
  },
  {
    action: 'AI 生成建议',
    at: '2026-11-19 13:12:48',
    actor: '系统',
    detail: '为素材生成标签建议与内容摘要（建议态，等待人工确认）\n模型: 站点配置模型（私有化推理） · 引用门禁: 开启'
  },
  {
    action: '完成编目',
    at: '2026-11-19 11:45:22',
    actor: '刘编目员',
    detail: '完成素材编目，添加标题、描述和标签\n添加字段: 标题、描述、3 个标签'
  },
  {
    action: '下载',
    at: '2026-11-19 10:22:40',
    actor: '李编辑',
    detail: '下载原文件（授权范围内）\n结果: 成功 · IP: 内网终端'
  },
  {
    action: '导出元数据',
    at: '2026-11-19 10:05:12',
    actor: '媒资管理员',
    detail: '导出元数据 CSV · 结果: 成功'
  },
  {
    action: '素材上传',
    at: '2026-11-19 09:34:11',
    actor: '张记者',
    detail: '上传素材文件\n文件名: IMG_20261118_103542.jpg · 批次: BATCH-2026-11-19-01'
  }
];

export const SHARE_LINKS: ShareLink[] = [
  {
    name: '采编部专题制作',
    url: 'https://media.gov.cn/s/a8f3…',
    used: '限次 5/10 · 已用 5',
    expires: '到期 2026-12-01'
  },
  {
    name: '外部合作单位预览',
    url: 'https://media.gov.cn/s/c21d…',
    used: '已到期 · 自动失效',
    expires: '到期 2026-11-15',
    expired: true
  }
];

export const REVIEW_ITEMS: ReviewItem[] = [
  {
    asset: ASSETS.find((a) => a.id === 'MA-2026-11-021')!,
    submitter: '王记者',
    cataloger: '刘编目员',
    wait: '5h',
    waitSub: 'SLA 内',
    flags: [
      { text: '等待 5 小时', kind: 'wait' },
      { text: '敏感提示已判定', kind: 'verdict' }
    ],
    tab: 'mine'
  },
  {
    asset: ASSETS.find((a) => a.id === 'MA-2026-11-001')!,
    submitter: '张记者（当前用户）',
    cataloger: '刘编目员',
    wait: '3h',
    waitSub: '已转互斥',
    mutex: true,
    flags: [{ text: '互斥', kind: 'mutex' }],
    tab: 'mine'
  },
  {
    asset: ASSETS.find((a) => a.id === 'MA-2026-11-030')!,
    submitter: '赵编辑',
    cataloger: '孙编目员',
    wait: '2h',
    waitSub: 'SLA 内',
    flags: [
      { text: '等待 2 小时', kind: 'wait' },
      { text: 'AI 提示：涉政策表述需复核', kind: 'sensitive' }
    ],
    tab: 'sensitive'
  },
  {
    asset: ASSETS.find((a) => a.id === 'MA-2026-11-007')!,
    submitter: '吴记者',
    cataloger: '刘编目员',
    wait: '6h',
    waitSub: 'SLA 内',
    flags: [
      { text: '等待 6 小时', kind: 'wait' },
      { text: 'AI 提示：未成年人影像需复核', kind: 'sensitive' }
    ],
    tab: 'sensitive'
  },
  {
    asset: ASSETS.find((a) => a.id === 'MA-2026-11-005')!,
    submitter: '孙记者',
    cataloger: '刘编目员',
    wait: '1d',
    waitSub: '超时预警',
    flags: [
      { text: '缺少版权凭证', kind: 'copyright' },
      { text: '等待 1 天', kind: 'wait' }
    ],
    tab: 'copyright'
  },
  {
    asset: ASSETS.find((a) => a.id === 'MA-2026-11-003')!,
    submitter: '王记者',
    cataloger: '刘编目员',
    wait: '完成',
    waitSub: '已留痕',
    flags: [{ text: '审核意见：素材清晰，版权完整', kind: 'verdict' }],
    tab: 'done'
  }
];

export const AI_TASKS: AiTask[] = [
  {
    id: 't1',
    type: '标签建议',
    badge: 'AI 辅助 · 建议态',
    badgeKind: 'ai',
    assetId: 'MA-2026-11-001',
    assetTitle: '市长调研产业园区现场照片',
    at: '2026-11-19 13:12',
    preview: '建议添加：#高新技术 #企业调研 #政府活动 #经济发展',
    status: 'pending'
  },
  {
    id: 't2',
    type: '内容摘要',
    badge: 'AI 辅助 · 建议态',
    badgeKind: 'ai',
    assetId: 'MA-2026-11-002',
    assetTitle: '城市建设成果宣传片',
    at: '2026-11-19 12:40',
    preview:
      '宣传片围绕老旧小区改造、市政路网升级与公园绿地建设三条主线，展示近三年城市建设阶段性成果……',
    status: 'pending'
  },
  {
    id: 't3',
    type: '语音转写',
    badge: '底座能力',
    badgeKind: 'base',
    assetId: 'MA-2026-11-003',
    assetTitle: '市民采访音频素材',
    at: '2026-11-19 11:05',
    preview:
      '[00:00:12] 受访者：这次改造以后，小区环境明显改善了，停车位也够用了……（转写全文 1,240 字，支持时间码跳转）',
    status: 'pending'
  },
  {
    id: 't4',
    type: '传播文案辅助生成',
    badge: 'AI 辅助 · P2',
    badgeKind: 'ai',
    assetId: '专题: 高新区建设',
    assetTitle: '渠道: 微信公众号',
    at: '2026-11-19 10:22',
    preview:
      '【标题建议】高新区这批重点项目建设进度刷新！附现场图集 → 生成内容已标注 AI 辅助，发布前须人工审核（FR-GOV-018）。',
    status: 'pending'
  },
  {
    id: 't5',
    type: '场景 / 人物识别',
    badge: '外部依赖 · P2 · 未接入',
    badgeKind: 'external',
    assetId: 'MA-2026-11-021',
    assetTitle: '防汛应急演练现场视频',
    at: '—',
    preview:
      '镜头、场景、人物、物体识别依赖外部媒体 AI，当前环境未对接，任务不可创建。对接后结果仍为建议态（规格 7.4 / 10.4 第 3 条）。',
    status: 'external'
  },
  {
    id: 't6',
    type: '标签建议',
    badge: 'AI 辅助',
    badgeKind: 'ai',
    assetId: 'MA-2026-11-004',
    assetTitle: '政策解读文件包',
    at: '采纳: 刘编目员 · 2026-11-19 09:50',
    preview: '已采纳 3 个标签：#政策 #解读 #营商环境。采纳操作已记入审计日志。',
    status: 'adopted'
  },
  {
    id: 't7',
    type: '内容摘要',
    badge: 'AI 辅助',
    badgeKind: 'ai',
    assetId: 'MA-2026-11-006',
    assetTitle: '环境保护专题片',
    at: '忽略: 刘编目员 · 2026-11-18 16:10',
    preview: '摘要与事实表述偏差，已忽略并留痕。',
    status: 'ignored'
  }
];

export const CAPABILITIES = [
  {
    name: '智能采集与编目',
    status: '✅ 底座已具备',
    kind: 'ok' as const,
    desc: 'OCR、语音转写、关键词/时间/人物/地点元数据提取。产出为建议态，编目员确认后入库。'
  },
  {
    name: '多模态理解',
    status: '⚠ 部分外部依赖',
    kind: 'warn' as const,
    desc: '文本/音频理解可用；镜头、场景、人物、物体识别依赖外部媒体 AI，未对接前降 P2，不承诺召回率（10.4）。'
  },
  {
    name: '自然语言检索',
    status: '✅ 已启用',
    kind: 'ok' as const,
    desc: '语义检索与相似查找；权限前置过滤，无权资产不进入召回与排序。'
  },
  {
    name: '知识库与问答',
    status: '✅ 索引就绪',
    kind: 'ok' as const,
    desc: '带来源定位的问答与摘要；引用门禁开启，无来源结论标注"来源不可确认"。'
  },
  {
    name: '内容生产辅助',
    status: '✅ 已启用',
    kind: 'ok' as const,
    desc: '摘要、标签、字幕、标题与传播文案辅助；产物标注 AI 辅助并进入人工审核（FR-GOV-018）。'
  },
  {
    name: '安全与质量控制',
    status: '✅ 已启用',
    kind: 'ok' as const,
    desc: '权限继承、敏感提示、来源追溯、人工复核与全链路日志审计。'
  }
];

export const KIND_LABEL: Record<string, string> = {
  image: '图片',
  video: '视频',
  audio: '音频',
  model3d: '三维模型',
  document: '文档'
};

export const KIND_ICON: Record<string, string> = {
  image: '图',
  video: '视',
  audio: '音',
  model3d: '模',
  document: '文'
};

export const STATUS_LABEL: Record<string, string> = {
  editing: '编目中',
  review: '待审核',
  approved: '已通过',
  archived: '已归档'
};

export const STATUS_KEY: Record<string, string> = {
  editing: 'progress',
  review: 'review',
  approved: 'approved',
  archived: 'archived'
};

export const LEVEL_LABEL: Record<string, string> = {
  public: '公开',
  internal: '内部',
  sensitive: '敏感'
};

export function getAsset(id: string): MediaAsset | undefined {
  return ASSETS.find((a) => a.id === id);
}
