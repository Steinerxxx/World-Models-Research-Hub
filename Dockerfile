# --- 第一阶段：构建阶段 ---
FROM node:20-slim AS builder

WORKDIR /app

# 安装必要的构建依赖（如果有的话）
# RUN apt-get update && apt-get install -y python3 make g++

# 复制 package.json
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# 安装所有依赖
RUN npm install
RUN cd frontend && npm install

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

# 环境变量默认值（可以在 Sealos 覆盖）
ENV NODE_ENV=production

# 启动
CMD ["npm", "start"]
