# --- 第一阶段：构建阶段 ---
FROM node:18-slim AS builder

WORKDIR /app

# 安装基础工具
RUN apt-get update && apt-get install -y python3 make g++ git && rm -rf /var/lib/apt/lists/*

# 先复制前端依赖配置并安装
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install --legacy-peer-deps

# 安装后端依赖
COPY package*.json ./
RUN npm install --legacy-peer-deps

# 复制所有源代码（注意：这会覆盖之前的 package.json，但 node_modules 已被 .dockerignore 排除，所以容器内的 node_modules 会保留）
COPY . .

# 强制使用开发环境安装的 vite 进行构建，并捕获所有输出
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV CI=false

RUN cd frontend && npm run build -- --logLevel info || ( \
    echo "--- BUILD FAILED ---" && \
    echo "Current directory: $(pwd)" && \
    echo "Directory content:" && \
    ls -la && \
    echo "Checking node_modules/.bin:" && \
    ls -la node_modules/.bin/vite || echo "Vite binary not found!" && \
    exit 1 \
)

# --- 第二阶段：运行阶段 ---
FROM node:18-slim

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

EXPOSE 3000

CMD ["npm", "start"]
