#!/bin/bash
# Sealos 自动化部署脚本

echo "开始克隆代码..."
git clone https://github.com/Steinerxxx/World-Models-Research-Hub.git repo

echo "进入目录..."
cd repo

echo "安装后端依赖..."
npm install

echo "安装前端依赖并构建..."
cd frontend
npm install
npm run build

echo "启动应用..."
cd ..
npm start
