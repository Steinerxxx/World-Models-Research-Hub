# --- 第一阶段：构建阶段 ---
FROM node:20-slim AS builder

WORKDIR /app

# 安装构建工具
RUN apt-get update && apt-get install -y python3 make g++ git && rm -rf /var/lib/apt/lists/*

# 复制整个项目
COPY . .

# 关键：删除 Windows 下生成的 lock 文件，防止平台冲突
RUN rm -f package-lock.json frontend/package-lock.json

# 分别安装依赖（在 Linux 环境下重新生成依赖树）
RUN npm install --legacy-peer-deps
RUN cd frontend && npm install --legacy-peer-deps

# 执行构建
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV CI=false
RUN cd frontend && npm run build

# --- 第二阶段：运行阶段 ---
FROM node:20-slim

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

EXPOSE 3000

CMD ["npm", "start"]
