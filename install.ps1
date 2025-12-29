# install.ps1

# --- Server (Python) Setup ---
Write-Host "--- Installing Server Dependencies ---"
$serverPath = ".\server"

if (-not (Test-Path $serverPath)) {
    Write-Error "Server folder not found at $serverPath. Aborting."
    exit 1
}

try {
    # Ensure requirements.txt exists
    if (Test-Path (Join-Path $serverPath "requirements.txt")) {
        # Create a virtual environment if one doesn't exist
        if (-not (Test-Path (Join-Path $serverPath "venv"))) {
            Write-Host "Creating Python virtual environment in $serverPath..."
            python -m venv (Join-Path $serverPath "venv")
        }

        # Activate the virtual environment and install requirements
        # Note: This is simplified for a script environment
        Write-Host "Installing/Updating Python requirements..."
        & (Join-Path $serverPath "venv\Scripts\pip") install -r (Join-Path $serverPath "requirements.txt")
    } else {
        Write-Warning "requirements.txt not found in $serverPath. Skipping server install."
    }
} catch {
    Write-Error "Server installation failed: $($_.Exception.Message)"
}


# --- Client (Node) Setup ---
Write-Host "`n--- Installing Client Dependencies ---"
$clientPath = ".\client"

if (-not (Test-Path $clientPath)) {
    Write-Error "Client folder not found at $clientPath. Aborting."
    exit 1
}

try {
    # Check for package.json
    if (Test-Path (Join-Path $clientPath "package.json")) {
        Write-Host "Running npm install in $clientPath..."
        # Navigate to the directory and run npm install
        Push-Location $clientPath
        npm install
        Pop-Location
    } else {
        Write-Warning "package.json not found in $clientPath. Skipping client install."
    }
} catch {
    Write-Error "Client installation failed. Ensure Node.js and npm are installed. Error: $($_.Exception.Message)"
}

Write-Host "`n--- Installation Complete. You can now run the 'run.ps1' script. ---"