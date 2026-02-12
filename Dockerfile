# --- 第一阶段：构建阶段 ---
FROM node:20-slim AS builder

WORKDIR /app

# 安装基础工具
RUN apt-get update && apt-get install -y python3 make g++ git && rm -rf /var/lib/apt/lists/*

# 复制根目录 package.json
COPY package*.json ./
# 复制前端 package.json
COPY frontend/package*.json ./frontend/

# 安装依赖
RUN npm install --legacy-peer-deps
RUN cd frontend && npm install --legacy-peer-deps

# 复制所有源代码
COPY . .

# 关键：设置 CI=false 强制忽略构建中的非致命警告
# 增加内存限制
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN cd frontend && CI=false npm run build

# --- 第二阶段：运行阶段 ---
FROM node:20-slim

WORKDIR /app

# 复制构建产物
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

EXPOSE 3000

# 启动
CMD ["npm", "start"]
