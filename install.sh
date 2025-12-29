#!/bin/bash
# install.sh - Sets up Python venv and Node dependencies for the project on Linux/macOS.

# --- Server (Python) Setup ---
echo "--- Installing Server Dependencies ---"
SERVER_PATH="./server"

if [ ! -d "$SERVER_PATH" ]; then
    echo "Error: Server folder not found at $SERVER_PATH. Aborting."
    exit 1
fi

if [ -f "$SERVER_PATH/requirements.txt" ]; then
    # Create and activate virtual environment
    if [ ! -d "$SERVER_PATH/venv" ]; then
        echo "Creating Python virtual environment in $SERVER_PATH..."
        python3 -m venv "$SERVER_PATH/venv"
    fi

    echo "Installing/Updating Python requirements..."
    # Note: We run pip directly from the venv's bin directory to ensure it uses the correct environment
    "$SERVER_PATH/venv/bin/pip" install -r "$SERVER_PATH/requirements.txt"
    
    if [ $? -ne 0 ]; then
        echo "Error: Server installation failed."
        exit 1
    fi
else
    echo "Warning: requirements.txt not found in $SERVER_PATH. Skipping server install."
fi


# --- Client (Node) Setup ---
echo -e "\n--- Installing Client Dependencies ---"
CLIENT_PATH="./client"

if [ ! -d "$CLIENT_PATH" ]; then
    echo "Error: Client folder not found at $CLIENT_PATH. Aborting."
    exit 1
fi

if [ -f "$CLIENT_PATH/package.json" ]; then
    echo "Running npm install in $CLIENT_PATH..."
    (cd "$CLIENT_PATH" && npm install)
    
    if [ $? -ne 0 ]; then
        echo "Error: Client installation failed. Ensure Node.js and npm are installed."
        exit 1
    fi
else
    echo "Warning: package.json not found in $CLIENT_PATH. Skipping client install."
fi

echo -e "\n--- Installation Complete. You can now run the 'run.sh' script. ---"
