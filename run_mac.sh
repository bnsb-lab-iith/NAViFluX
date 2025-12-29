#!/usr/bin/env bash

# -------------------------------------------------
# Configuration
# -------------------------------------------------
SERVER_HOST="127.0.0.1"
SERVER_PORT=5000
CLIENT_HOST="127.0.0.1"
CLIENT_PORT=5173
CLIENT_URL="http://localhost:${CLIENT_PORT}"

TIMEOUT_SECONDS=600
CHECK_INTERVAL=2

# -------------------------------------------------
# Resolve script directory (CRITICAL FIX)
# -------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_PATH="${SCRIPT_DIR}/server"
CLIENT_PATH="${SCRIPT_DIR}/client"

# -------------------------------------------------
# Open new Terminal window (macOS-safe)
# -------------------------------------------------
open_terminal() {
    /usr/bin/osascript -e "tell application \"Terminal\" to do script \"$1\""
}

# -------------------------------------------------
# Wait for a port
# -------------------------------------------------
wait_for_port() {
    local host="$1"
    local port="$2"
    local name="$3"

    echo "⏳ Waiting for $name on port $port..."

    local start_time
    start_time=$(date +%s)

    while true; do
        if nc -z "$host" "$port" >/dev/null 2>&1; then
            echo "✅ $name is ready!"
            break
        fi

        if (( $(date +%s) - start_time >= TIMEOUT_SECONDS )); then
            echo "❌ $name startup timed out"
            exit 1
        fi

        sleep "$CHECK_INTERVAL"
    done
}

# -------------------------------------------------
# 1. Start Flask Server
# -------------------------------------------------
echo "1. Starting Flask server..."

SERVER_CMD="cd ${SERVER_PATH}; source venv/bin/activate; echo Server terminal active.; flask run"
open_terminal "$SERVER_CMD"

# -------------------------------------------------
# 2. Wait for Flask
# -------------------------------------------------
wait_for_port "$SERVER_HOST" "$SERVER_PORT" "Flask server"

# -------------------------------------------------
# 3. Start Client
# -------------------------------------------------
echo "3. Starting client dev server..."

CLIENT_CMD="cd ${CLIENT_PATH}; echo Client terminal active.; npm run dev"
open_terminal "$CLIENT_CMD"

# -------------------------------------------------
# 4. Wait for Client
# -------------------------------------------------
wait_for_port "$CLIENT_HOST" "$CLIENT_PORT" "Client"

# -------------------------------------------------
# 5. Open Browser (GUARANTEED METHOD)
# -------------------------------------------------
BROWSER_CMD="open ${CLIENT_URL}"
open_terminal "$BROWSER_CMD"

# -------------------------------------------------
echo "-------------------------------------------------"
echo "🚀 Stack launched"
echo "Server : http://localhost:${SERVER_PORT}"
echo "Client : http://localhost:${CLIENT_PORT}"
echo "-------------------------------------------------"
