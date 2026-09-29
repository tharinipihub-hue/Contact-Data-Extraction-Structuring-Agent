#!/usr/bin/env bash

# Contact Data Extraction & Structuring Agent - Startup Script
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================================="
echo " Starting Contact Agent (Backend + Frontend)"
echo "=========================================================="

# 1. Start Backend on Port 4000
echo "[1/2] Starting Backend Server (Port 4000)..."
cd "$DIR/contact-agent/backend"
npm start &
BACKEND_PID=$!
echo "Backend running with PID: $BACKEND_PID"

# Wait a moment for backend to initialize
sleep 2

# 2. Start Frontend on Port 3000
echo "[2/2] Starting Frontend UI (Port 3000)..."
cd "$DIR/contact-agent/frontend"
npm start &
FRONTEND_PID=$!
echo "Frontend running with PID: $FRONTEND_PID"

echo "=========================================================="
echo "  Backend:  http://localhost:4000"
echo "  Frontend: http://localhost:3000"
echo "=========================================================="
echo "Press Ctrl+C to terminate both servers."

trap "echo 'Stopping all services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM

wait
