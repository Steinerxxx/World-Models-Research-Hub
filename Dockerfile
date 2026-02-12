# --- 第一阶段：构建阶段 ---
FROM node:18-slim AS builder

WORKDIR /app

# 安装基础工具
RUN apt-get update && apt-get install -y python3 make g++ git && rm -rf /var/lib/apt/lists/*

# 先安装前端依赖（这是最容易出问题的地方）
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install --legacy-peer-deps

# 安装后端依赖
COPY package*.json ./
RUN npm install --legacy-peer-deps

# 复制所有源代码
COPY . .

# 增加构建时的详细日志输出
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN cd frontend && \
    (CI=false ./node_modules/.bin/vite build --logLevel info || \
    (echo "BUILD FAILED! Diagnostic information:" && \
     ls -la . && \
     ls -la src/ && \
     cat package.json && \
     exit 1))

# --- 第二阶段：运行阶段 ---
FROM node:18-slim

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

EXPOSE 3000

CMD ["npm", "start"]
