#!/bin/bash
# Starts backend, MCP assistant service, and frontend, each in the background with its own log.
# Usage: ./start-all.sh
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting backend..."
cd "$ROOT/backend"
export JAVA_HOME=$(/usr/libexec/java_home -v 25)
set -a; . ./.env.local; set +a
nohup java -jar target/peoplepay360-backend.jar > /tmp/backend.log 2>&1 &
echo "  pid $! -> /tmp/backend.log"

echo "Starting MCP assistant service..."
cd "$ROOT/mcp"
nohup .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 > /tmp/mcp.log 2>&1 &
echo "  pid $! -> /tmp/mcp.log"

echo "Starting frontend..."
cd "$ROOT/frontend"
nohup npm run dev > /tmp/frontend.log 2>&1 &
echo "  pid $! -> /tmp/frontend.log"

echo "Waiting for health checks..."
for i in $(seq 1 30); do
  b=$(curl -s -m 2 http://localhost:8080/actuator/health 2>/dev/null | grep -o '"status":"UP"' || true)
  m=$(curl -s -m 2 http://127.0.0.1:8000/health 2>/dev/null | grep -o '"status":"ok"' || true)
  f=$(curl -s -m 2 -o /dev/null -w "%{http_code}" http://localhost:5173 2>/dev/null || true)
  [ -n "$b" ] && [ -n "$m" ] && [ "$f" = "200" ] && break
  sleep 2
done

echo
echo "Backend:  http://localhost:8080   $([ -n "$b" ] && echo UP || echo 'not ready yet, check /tmp/backend.log')"
echo "MCP:      http://127.0.0.1:8000   $([ -n "$m" ] && echo UP || echo 'not ready yet, check /tmp/mcp.log')"
echo "Frontend: http://localhost:5173   $([ "$f" = "200" ] && echo UP || echo 'not ready yet, check /tmp/frontend.log')"
