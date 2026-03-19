# install.ps1
# Sets up Python venv and Node dependencies for Windows

Write-Host "--- Installing Server Dependencies ---"

$serverPath = ".\server"

# Check server folder
if (-not (Test-Path $serverPath)) {
    Write-Error "Server folder not found at $serverPath. Aborting."
    exit 1
}

# Check if Python 3.12 exists
$pythonCheck = py -3.12 --version 2>$null

if (-not $pythonCheck) {
    Write-Error "Python 3.12 is required but not installed. Please install Python 3.12."
    exit 1
}

Write-Host "Using $(py -3.12 --version)"

try {

    $requirementsFile = Join-Path $serverPath "requirements.txt"
    $venvPath = Join-Path $serverPath "venv"

    if (Test-Path $requirementsFile) {

        # Create virtual environment
        if (-not (Test-Path $venvPath)) {
            Write-Host "Creating Python 3.12 virtual environment..."
            py -3.12 -m venv $venvPath
        }

        $venvPython = Join-Path $venvPath "Scripts\python"

        Write-Host "Upgrading pip..."
        & $venvPython -m pip install --upgrade pip

        Write-Host "Installing Python requirements..."
        & $venvPython -m pip install -r $requirementsFile

    } else {
        Write-Warning "requirements.txt not found in $serverPath. Skipping server install."
    }

} catch {
    Write-Error "Server installation failed: $($_.Exception.Message)"
    exit 1
}


# --- Client Setup ---
Write-Host "`n--- Installing Client Dependencies ---"

$clientPath = ".\client"

if (-not (Test-Path $clientPath)) {
    Write-Error "Client folder not found at $clientPath. Aborting."
    exit 1
}

# Check Node/npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js/npm is not installed. Please install Node.js."
    exit 1
}

try {

    $packageFile = Join-Path $clientPath "package.json"

    if (Test-Path $packageFile) {

        Write-Host "Running npm install in $clientPath..."

        Push-Location $clientPath
        npm install
        Pop-Location

    } else {
        Write-Warning "package.json not found in $clientPath. Skipping client install."
    }

} catch {
    Write-Error "Client installation failed. Error: $($_.Exception.Message)"
    exit 1
}

Write-Host "`n--- Installation Complete. You can now run the 'run.ps1' script. ---"