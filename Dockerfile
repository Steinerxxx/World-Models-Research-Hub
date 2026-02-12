# --- 第一阶段：构建阶段 ---
FROM node:20-slim AS builder

# 安装构建基础工具 (git, python, make, g++)，防止依赖安装失败
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制 package.json
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# 使用 --legacy-peer-deps 强制安装，防止版本冲突导致退出
RUN npm install --legacy-peer-deps
RUN cd frontend && npm install --legacy-peer-deps

# 复制所有源代码
COPY . .

# 执行前端构建
RUN cd frontend && npm run build

# --- 第二阶段：运行阶段 ---
FROM node:20-slim

WORKDIR /app

# 只从构建阶段复制必要的文件
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

# 暴露端口
EXPOSE 3000

# 启动
CMD ["npm", "start"]
