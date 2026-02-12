# --- 第一阶段：构建阶段 ---
FROM node:18-slim AS builder

WORKDIR /app

# 安装基础工具
RUN apt-get update && apt-get install -y python3 make g++ git && rm -rf /var/lib/apt/lists/*

# 复制依赖配置
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# 安装依赖
RUN npm install --legacy-peer-deps
RUN cd frontend && npm install --legacy-peer-deps

# 复制所有源代码
COPY . .

# 增加构建时的详细日志输出
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN cd frontend && CI=false npm run build -- --logLevel info || (echo "Build failed! Checking for common issues..." && ls -R src/ && exit 1)

# --- 第二阶段：运行阶段 ---
FROM node:18-slim

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

EXPOSE 3000

CMD ["npm", "start"]
