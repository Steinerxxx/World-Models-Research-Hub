<div align="center">

<img src="https://img.shields.io/badge/version-4.0.0-blue?style=flat-square" alt="Version">
<img src="https://img.shields.io/badge/license-ISC-green?style=flat-square" alt="License">
<img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&style=flat-square" alt="React">
<img src="https://img.shields.io/badge/Node-24-339933?logo=node.js&style=flat-square" alt="Node">
<img src="https://img.shields.io/badge/PostgreSQL-pgvector-4169E1?logo=postgresql&style=flat-square" alt="PostgreSQL">

</div>

# World Models Research Hub

> **AI 驱动的学术论文发现平台** — 从 arXiv 自动抓取、向量语义搜索、AI 深度分析到个性化推荐，一站式追踪前沿研究。

---

## 亮点速览

| 功能 | 说明 |
|------|------|
| **向量语义搜索** | 基于 `text-embedding-v4` 的 1536 维向量，按语义相关性而非关键词匹配搜索 |
| **混合搜索模式** | Semantic / Hybrid / Keyword 三种模式自由切换，自由调节权重 |
| **AI 研究助手** | 对话式 Agent，支持工具调用——搜索论文、分析论文、推荐相似论文 |
| **个性化推荐** | 基于收藏列表的向量推荐，越收藏越精准 |
| **自动抓取 & 打标** | 每 10 分钟从 arXiv 抓取最新论文，AI + 规则自动分类打标签 |
| **Structured Filters** | Tag / Author / Year 精确筛选，Tag 输入支持自动补全 |
| **趋势分析** | 论文发表趋势和主题热点可视化（Recharts） |
| **深色模式** | 全站支持 Light / Dark 主题切换 |
| **Sealos 一键部署** | Docker 镜像 + GitHub Actions CI/CD，推送即上线 |

---

## 搜索模式对比

```
Keyword:  "attention mechanism"          → 标题/摘要包含这些词的论文
Semantic: "spatial-temporal reasoning"   → 语义相近的论文（即使词不完全一样）
Hybrid:   "world models for robotics"    → 语义 + 关键词 + 时效性 三重加权
```

Structured Filters（Tag / Author / Year）可在**所有模式**下叠加使用，空搜索词只填 Filter 也能触发搜索。

---

## 使用指南

### 首页 — 搜索与发现

进入首页即显示全部论文，按日期倒序排列。顶部搜索栏支持三种模式切换：

- **Keyword**（蓝色）— 传统关键词匹配，最快
- **Semantic**（紫色）— 向量语义搜索，按含义匹配
- **Hybrid**（青色）— 上面两者 + 时效性三重加权，最全面

搜索框下方是 **Structured Filters**：

| 筛选项 | 说明 |
|--------|------|
| Tag | 输入时自动补全下拉现有标签，支持点击选择 |
| Author | 按作者姓名筛选 |
| Year | 按发表年份筛选 |

点击 Apply 生效。Filter 可以**独立使用**（不填搜索词也能搜），也可以与搜索词叠加。点击 ✕ 清空所有筛选条件。

每篇论文卡片右下角有 **收藏星标** ⭐ 和 **相似论文** 🔀 按钮。

### 侧边栏 — 导航与快捷筛选

左侧边栏提供：

- **Menu** — Home / AI Recommendations / Research Assistant / Trends / My Favorites / Introduction
- **Research Topics** — 固定主题标签，点击即跳转首页并筛选对应标签
- **Emerging Research** — 数据库自动发现的新兴高频主题，分为热门标签和折叠的"Discover More Topics"长尾标签

右上角太阳/月亮图标切换 **深色/浅色模式**。

### AI Recommendations — 个性化推荐

基于你的收藏列表，AI 自动分析兴趣偏好，找出与你收藏语义相近的论文。操作方式：

1. 先在首页收藏若干感兴趣的论文（点 ⭐）
2. 进入 AI Recommendations 页面
3. 可在输入框中补充当前研究主题（可选）
4. 点击 **Generate Recommendations** 获取推荐

每篇推荐论文会展示匹配理由，例如 "embedding similarity to your favorites"、"aligned with tags from your favorites" 等。点击论文标题直接跳转原文链接。

### Research Assistant — AI 对话助手

基于 tool-calling 架构的 AI Agent，支持以下能力：

| 能力 | 示例 |
|------|------|
| 搜索论文 | "Find papers about world models for robotics" |
| 分析论文 | "Analyze the paper DreamerV3" |
| 找相似论文 | "What papers are similar to DreamerV3?" |
| 个性化推荐 | "Recommend papers based on my favorites" |

AI 会自动判断意图并调用相应工具，回复中使用 Markdown 格式渲染（列表、粗体、链接等）。对话记录会保存到浏览器本地，切换页面不会丢失。

### 论文分析 — AI Deep Analysis

在首页点击任意论文进入详情页（或搜索结果中点击标题），可以查看：

- 论文摘要 (Abstract)
- AI 生成的论文总结 (Summary)
- AI 识别的核心贡献 (Contribution)
- AI 分析的局限性 (Limitations)

首次打开时会触发 AI 实时分析，之后使用缓存直接返回。

### 相似论文发现

在论文卡片上点击 🔀 按钮，系统会自动找出语义向量最接近的相关论文，返回首页并展示结果。这个功能适用于"读完这篇还想看更多"的场景。

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 19 · TypeScript · Vite · Tailwind CSS · Framer Motion · Recharts · react-markdown |
| 后端 | Node.js · Express · PostgreSQL + pgvector · node-cron |
| AI | DeepSeek V3（分析/对话）· DashScope `text-embedding-v4`（1536 维向量） |
| 认证 | JWT + bcrypt |
| 部署 | Docker · Sealos · GitHub Actions CI/CD · GitHub Container Registry |

---

## 快速开始

### 环境要求

- Node.js ≥ 18
- PostgreSQL（需启用 pgvector 扩展）
- DeepSeek API Key
- DashScope API Key（向量嵌入）

### 1. 克隆 & 安装

```bash
git clone https://github.com/Steinerxxx/World-Models-Research-Hub.git
cd World-Models-Research-Hub

# 后端
cd backend && npm install

# 前端
cd ../frontend && npm install
```

### 2. 配置环境变量

在 `backend/` 下创建 `.env`：

```env
# PostgreSQL（必须，pgvector 扩展需预先启用）
DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# AI — 分析与对话
AI_API_KEY="sk-xxx"
AI_BASE_URL="https://api.deepseek.com"
AI_MODEL_NAME="deepseek-chat"

# AI — 向量嵌入
EMBEDDING_API_KEY="sk-xxx"
EMBEDDING_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
EMBEDDING_MODEL="text-embedding-v4"

# 认证
JWT_SECRET="your-jwt-secret"
ADMIN_KEY="your-admin-key"
```

### 3. 启动

```bash
# 后端 (port 3001)
cd backend && npm run dev

# 前端 (port 5173)
cd frontend && npm run dev
```

访问 `http://localhost:5173`。

---

## Docker / Sealos 部署

```bash
# 构建镜像
docker build -t ghcr.io/your-username/world-models-hub:latest .

# 推送
docker push ghcr.io/your-username/world-models-hub:latest
```

推送后 GitHub Actions 自动触发 Sealos Webhook 部署。也可以直接上 [Sealos](https://sealos.run) 导入 Docker 镜像一键部署。

---

## 项目结构

```
├── frontend/                  # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/        # UI 组件 (Layout, Sidebar, PaperCard...)
│   │   ├── contexts/          # React Context (Theme, Auth, Favorites, Filter)
│   │   ├── hooks/             # 自定义 Hooks (usePaperBrowser...)
│   │   ├── lib/               # API 客户端 + 工具函数
│   │   ├── pages/             # Home, Chat, Recommendations, Trends, Profile...
│   │   └── types/             # TypeScript 类型定义
│   └── ...
├── backend/                   # Node.js + Express
│   ├── src/
│   │   ├── app.js             # Express 应用入口
│   │   ├── ai_service.js      # AI 分析 / 搜索意图解析
│   │   ├── chat_service.js    # Agent 工具调用核心
│   │   ├── classifier.js      # 规则论文分类器
│   │   ├── database.js        # PostgreSQL + pgvector 数据层
│   │   ├── retag.js           # 批量重新打标签工具
│   │   ├── scraper.js         # arXiv 抓取管道
│   │   ├── search_parser.js   # 结构化查询解析
│   │   ├── stopwords.js        # 停用词 + 查询预处理
│   │   ├── vector_config.js   # 向量嵌入配置
│   │   ├── vector_service.js  # 语义 / 混合搜索 + 推荐引擎
│   │   ├── routes/            # API 路由
│   │   │   ├── admin.js       # 管理接口 (x-admin-key)
│   │   │   ├── chat.js        # Agent 对话接口
│   │   │   ├── health.js      # 健康检查
│   │   │   └── papers.js      # 论文搜索 / 分析 / 推荐
│   │   └── jobs/              # 定时任务
│   │       └── scrapeScheduler.js  # 每 10 分钟 arXiv 抓取
│   └── ...
├── Dockerfile
├── .github/workflows/deploy.yml   # CI/CD 自动化部署
└── README.md
```

---

## API 端点摘要

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 系统健康检查，含版本号和 Embedding 状态 |
| GET | `/api/papers` | 获取全部论文 |
| GET | `/api/tags` | 获取全部标签及计数 |
| POST | `/api/search/semantic` | 纯语义向量搜索 |
| POST | `/api/search/hybrid` | 语义 + 关键词 + 时效混合搜索 |
| POST | `/api/recommendations` | AI 个性化推荐 |
| POST | `/api/recommendations/similar-paper` | 查找相似论文 |
| POST | `/api/papers/:id/analyze` | AI 深度分析单篇论文 |
| POST | `/api/chat` | AI 研究助手对话 (Agent) |
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/scrape` | 手动触发 arXiv 抓取 |
| `*`  | `/api/admin/*` | 管理接口（需 `x-admin-key` Header） |

---

## 许可证

ISC License · [GitHub](https://github.com/Steinerxxx/World-Models-Research-Hub)
