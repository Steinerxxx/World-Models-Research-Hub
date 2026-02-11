#!/bin/bash
# 1. 查找旧进程并杀掉
PID=$(pgrep -f "node src/index.js")
if [ -n "$PID" ]; then
    echo "Stopping old process (PID: $PID)..."
    kill $PID
    sleep 2
fi

# 2. 启动新进程
echo "Starting new process..."
NODE_ENV=production nohup node src/index.js > output.log 2>&1 &

echo "Restart script completed."
