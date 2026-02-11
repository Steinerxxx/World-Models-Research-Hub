# Hugging Face Spaces 部署指南 (免信用卡/国内直连)

由于 Zeabur 和其他平台需要信用卡验证，我们使用 **Hugging Face Spaces** 进行部署。这是目前对学生最友好、最稳定的免费全栈部署方案。

## 1. 准备工作

1. 注册/登录 [Hugging Face](https://huggingface.co/) (支持 GitHub 登录，无需信用卡)。
2. 点击右上角的 **New Space**。
3. **Space Name**: 输入你的项目名（如 `world-models-hub`）。
4. **SDK**: 选择 **Docker** (非常重要！)。
5. **Template**: 选择 **Blank**。
6. **Public/Private**: 选择 **Public**。
7. 点击 **Create Space**。

## 2. 上传文件

你可以通过 GitHub 关联，或者直接在 Hugging Face 的浏览器界面上传。你需要确保根目录下有以下 `Dockerfile`：

### 创建 `Dockerfile` (在项目根目录)

```dockerfile
# --- 第一阶段：构建前端 ---
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- 第二阶段：构建后端并合并 ---
FROM node:20-slim
WORKDIR /app

# 安装后端依赖
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install

# 复制后端源码
COPY backend/ ./

# 复制前端打包后的文件到后端可以访问的地方
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=7860

# Hugging Face 默认使用 7860 端口
EXPOSE 7860

# 启动命令
CMD ["node", "src/index.js"]
```

## 3. 设置环境变量

在 Space 的 **Settings** 选项卡中，找到 **Variables and secrets**，添加以下 **Secrets** (不是 Variables)：
- `DATABASE_URL`: 你的 Supabase 连接串。
- `AI_API_KEY`: 你的 DeepSeek Key。
- `JWT_SECRET`: 随机字符串。

## 4. 完成部署

上传完成后，Hugging Face 会自动开始 Building。完成后，你就可以通过 `https://huggingface.co/spaces/你的用户名/项目名` 直接访问了！

---
**为什么选 7860 端口？**
Hugging Face 的固定要求是容器必须监听 7860 端口才能对外展示页面。我已经帮你处理好了。
