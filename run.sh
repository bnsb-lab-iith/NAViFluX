#!/usr/bin/env bash

# -------------------------------------------------
# Configuration Variables
# -------------------------------------------------
SERVER_HOST="127.0.0.1"
SERVER_PORT=5000
CLIENT_PORT=5173
CLIENT_URL="http://localhost:${CLIENT_PORT}"

# Resolve absolute paths from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_PATH="${SCRIPT_DIR}/server"
CLIENT_PATH="${SCRIPT_DIR}/client"

TIMEOUT_SECONDS=600
CHECK_INTERVAL=2

# -------------------------------------------------
# Utility functions
# -------------------------------------------------

open_terminal() {
    # Cross-terminal support for Linux
    if command -v gnome-terminal >/dev/null 2>&1; then
        gnome-terminal -- bash -c "$1; exec bash"
    elif command -v konsole >/dev/null 2>&1; then
        konsole -e bash -c "$1; exec bash"
    elif command -v xfce4-terminal >/dev/null 2>&1; then
        xfce4-terminal -e "bash -c '$1; exec bash'"
    elif command -v mate-terminal >/dev/null 2>&1; then
        mate-terminal -e "bash -c '$1; exec bash'"
    elif command -v xterm >/dev/null 2>&1; then
        xterm -e bash -c "$1; exec bash"
    else
        echo "❌ No supported terminal emulator found."
        echo "   Install one of: gnome-terminal, konsole, xfce4-terminal, mate-terminal, xterm"
        exit 1
    fi
}

open_browser() {
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$1"
    else
        echo "⚠️  Could not auto-open browser. Open manually: $1"
    fi
}

# -------------------------------------------------
# 1. Start Flask Server
# -------------------------------------------------
echo "1. Starting Flask server in a new terminal..."

SERVER_CMD="cd ${SERVER_PATH} || exit 1; source venv/bin/activate; echo 'Server terminal active.'; flask run"

open_terminal "$SERVER_CMD"

# -------------------------------------------------
# 2. Wait for Server to be Ready
# -------------------------------------------------
echo "2. Waiting for server at http://${SERVER_HOST}:${SERVER_PORT}..."

START_TIME=$(date +%s)

while true; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))

    if (( ELAPSED >= TIMEOUT_SECONDS )); then
        echo "❌ Server startup timed out after ${TIMEOUT_SECONDS}s."
        exit 1
    fi

    if nc -z "${SERVER_HOST}" "${SERVER_PORT}" >/dev/null 2>&1; then
        echo "✅ Server is ready!"
        break
    fi

    echo "⏳ Still waiting (${ELAPSED}s elapsed)..."
    sleep "${CHECK_INTERVAL}"
done

# -------------------------------------------------
# 3. Start Client and Open Browser
# -------------------------------------------------
echo "3. Starting client dev server..."

CLIENT_CMD="cd ${CLIENT_PATH} || exit 1; echo 'Client terminal active.'; echo 'Starting NPM dev server (Press Ctrl+C to stop)...'; npm run dev"

open_terminal "$CLIENT_CMD"

# Give the client a moment to start, then open browser
sleep 3
open_browser "${CLIENT_URL}"

# -------------------------------------------------
echo "-------------------------------------------------"
echo "🚀 Application stack launched!"
echo "• Flask server running on :${SERVER_PORT}"
echo "• Client running on       :${CLIENT_PORT}"
echo "-------------------------------------------------"
echo "To stop:"
echo "• Press Ctrl+C in the client terminal"
echo "• Close the server terminal"
