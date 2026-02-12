# --- 第一阶段：构建阶段 ---
FROM node:20-slim AS builder

WORKDIR /app

# 安装必要的构建工具
RUN apt-get update && apt-get install -y python3 make g++ git && rm -rf /var/lib/apt/lists/*

# 1. 先安装后端依赖
COPY package*.json ./
RUN npm install --legacy-peer-deps

# 2. 再安装前端依赖
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install --legacy-peer-deps

# 3. 复制所有代码
COPY . .

# 4. 执行前端构建 (增加内存限制，防止 OOM)
# 设置 NODE_OPTIONS 提高构建内存上限到 4GB
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN cd frontend && npm run build

# --- 第二阶段：运行阶段 ---
FROM node:20-slim

WORKDIR /app

# 只从构建阶段复制必要的文件
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

EXPOSE 3000

# 启动
CMD ["npm", "start"]
