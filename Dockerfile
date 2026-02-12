# 使用 Node.js 20 官方镜像作为基础
FROM node:20

# 设置工作目录
WORKDIR /app

# 复制后端 package.json 并安装依赖
COPY package*.json ./
RUN npm install

# 复制前端代码并构建
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# 复制后端代码
COPY . .

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "start"]
