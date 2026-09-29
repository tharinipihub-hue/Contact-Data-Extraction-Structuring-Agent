#!/usr/bin/env bash

echo "Stopping services on ports 3000 and 4000..."
lsof -ti :3000 | xargs kill -9 2>/dev/null
lsof -ti :4000 | xargs kill -9 2>/dev/null
echo "All services stopped."
