#!/bin/bash

# --- World Models Research Hub 一键更新脚本 ---

echo "🚀 开始同步最新代码..."
git pull

echo "📦 检查并安装依赖..."
npm install
cd frontend && npm install && cd ..

echo "🏗️ 构建前端静态资源..."
cd frontend
npm run build
cd ..

echo "🔄 正在重启后端服务..."
# 查找并结束已有的 node 进程（根据端口 3001 或项目路径）
pkill -f "node backend/src/index.js" || true

# 在后台启动后端服务，并将日志输出到 backend.log
nohup npm start > backend.log 2>&1 &

echo "✅ 更新完成！"
echo "🌐 提示：如果网页没有变化，请在浏览器中执行强制刷新 (Ctrl + F5)"
echo "📄 查看运行日志: tail -f backend.log"
