# 融媒体媒资中心

PowerCMS 12 政府场景站点包。导入后得到一个站点、三套内容模型和一套 React 前台，覆盖工作台、媒资库、素材详情、审核队列与 AI 加工中心。

## 站点导入即部署（webapps）

站点包导入时，模板工程（REACT/VUE）的构建产物会自动部署到**当前运行目录**下的 `webapps/{siteKey}/`，浏览器可直接访问，例如 `http://localhost:8080/webapps/react-mam/`：

- 产物来源两级：包内 `template/dist/**`（打包前 `npm run build` 的成品）优先进入快路径；包内无产物时按清单 `entrypoints.build` 在导入侧现场构建（`powercms.webapps.build=auto|never|always`，默认 `auto`）。
- `index.html` 响应由服务端注入启动配置：`window.__POWERCMS_SITE_ID__`、`window.__POWERCMS_SITE_KEY__`、`window.__POWERCMS_API_BASE__`（`/api/v1`）——API 路径自动匹配。
- Vite 构建配置 `base: './'`，产物可部署在任意子路径下；客户端路由（hash）不依赖服务端回退。

## 导入

在仓库根目录执行：

```powershell
pwsh scripts/validate-samples.ps1
```

用管理端「系统 → 站点包」导入 `target/sample-packages/react-mam.zip`。源码目录没有 `checksums`，不能直接把文件夹打成 ZIP 导入。

导入会创建：

| 内容模型 | 作用 |
|---|---|
| `media_asset` | 统一素材目录：类型、七维编目、密级、版权、状态、标签、AI 标签 |
| `media_version` | 业务版本快照，供回溯与「基于此版本新建」 |
| `share_link` | 分享链接的到期、限次、吊销（不保存完整令牌） |

站点创建后，平台还会自动补上 `media_image`、`media_video`、`media_audio`、`media_document`、`media_font`、`media_other`。原件放在这些媒体模型里。

`content/`、`workflows/`、`search/` 会留在包里，导入预检会提示它们不会自动落库。样例数据由前台内置 seed 展示；正式使用时在管理端录入并发布同名字段的内容。

### 导入后须完成的 L2 配置（站点包本身不包含）

1. 按 `3.1` 创建 sitefolder 栏目树（事件/栏目/专题），配置 `showOnMenu` 与对象 ACL；
2. 创建角色并绑定：记者/编目、审核人、编辑/制作、发布人、媒资管理员、AI 治理员；
3. **显式开启同行评审** `peerReviewRequired=true`（四眼审批，AC-GOV-002）；
4. 按 `workflows/media-approval.yaml` 配置工作流；
5. 导入人物/地点/主题分类法字典树；
6. 初始化站点 AI 策略（citationGateMode、来源权重、配额）与知识库索引；
7. 未完成知识库索引前，问答类验收为「未就绪」。

## 前台

界面按《融媒体媒资中心 UI 设计说明 V1.1》实现，包含工作台、媒资库、素材详情、审核队列、AI 加工中心。

### 页面与地址

| 地址 | 页面 |
|---|---|
| `#/dashboard` | 工作台：四态概览、运营指标、最近上传、最近活动 |
| `#/library`、`#/library/<kind>` | 媒资库：目录树、七维筛选、智能检索、网格/列表/时间轴 |
| `#/detail/<资产编码>` | 素材详情：元数据、版本、AI 建议、敏感提示、审计、分享链接 |
| `#/review` | 审核队列：四眼互斥、敏感/版权复核、批量审核 |
| `#/ai` | AI 加工中心：能力链看板、建议态任务、知识库问答入口 |

侧栏「管理」三项（权限配置/审计日志/系统设置）指向平台管理端，站点包内仅保留入口占位。

### 关键交互口径

- **四眼审批**：详情页「通过审核/驳回」在提交人视角禁用并提示“提交人与终审人须分离”；审核队列互斥项标灰。
- **版权可见性**：未确认版权素材显示「仅内部可见」；授权由发布门卫 + 人工终审，不作 ACL 自动拦截。
- **AI 建议态**：采纳/忽略均留痕；场景/人物识别标注「外部依赖 · P2 · 未接入」。
- **敏感提示**：仅提示与人工判定留痕，不自动阻断、不自动终审（FR-GOV-017）。
- **智能检索**：权限前置过滤，无权内容不进入结果（FR-GOV-004）。
- **七维筛选**：事件/栏目/专题/时间/地点/人物/主题，支持目录树反查（AC-GOV-001）。

## 开发

```powershell
cd samples/react-mam/template
npm install
npm run dev
```

开发服务器默认 `http://localhost:5174`，`/api` 与媒体路径代理到 `http://localhost:8080`。

```powershell
npm run build   # 产出 dist/，打包前必须执行
npm run typecheck
```

## 能力对应（L1）

| 需求 | 界面承载 |
|---|---|
| FR-GOV-001 字段级建模 | `models/media_asset.yaml` + 详情元数据网格 |
| FR-GOV-002 统一资产入口 | 媒资库类型筛选（含三维模型） |
| FR-GOV-003 版本快照 | 详情版本历史 + 对比/基于此版本新建 |
| FR-GOV-004 统一检索 | 关键词/智能检索 + 七维 + 目录树 |
| FR-GOV-006 流程审批 | 四态 + 审核队列 + 终审防呆 |
| FR-GOV-007 审计留痕 | 详情操作记录时间线 |
| FR-GOV-011 七维组织 | 筛选面板 + 详情分类归属 |
| FR-GOV-012 编目审核分离 | 提交人视角按钮禁用 + 队列互斥 |
| FR-GOV-013 版权状态 | 必填字段 + 仅内部可见 + 发布门卫提示 |
| FR-GOV-014 授权使用 | 分享链接（到期/限次/吊销） |
| FR-GOV-015 归档复用 | 已归档状态 + 语义相似相关素材 |
| FR-GOV-017 敏感提示 | 详情敏感区 + 审核队列复核页签 |
| FR-GOV-018 文案辅助 | AI 加工中心建议态任务 |

栏目、角色、ACL、工作流、分类法、AI 策略属 **L2 配置包**；样例内容与知识库评测属 **L3 启动包**。站点包（L1）导入本身不满足全部验收项。

## 依据

- 《PowerCMS12 政府场景站点需求规格说明书 V1.1》
- 《融媒体媒资中心 UI 设计说明 V1.1》及 `media-asset-center` 五页 HTML 设计稿
