# 融媒体媒资中心 站点包

## 1.0.0 — 2026-11-19

- 首个 L1 站点包交付：`site-package.yaml` + 三模型 + React 五页前台。
- 内容模型：`media_asset`（七维编目/密级/版权/四态）、`media_version`、`share_link`。
- 前台页面：工作台、媒资库（目录树/七维/智能检索/三视图）、素材详情（版本/AI/敏感/审计/分享）、审核队列（四眼互斥）、AI 加工中心（能力链/建议态）。
- 工作流定义：`workflows/media-approval.yaml`（导入后须在管理端配置；四眼互斥须 L2 开启 peerReviewRequired）。
- 设计依据：政府场景规格 V1.1 + UI 设计说明 V1.1。
