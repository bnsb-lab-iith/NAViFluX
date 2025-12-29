# run.ps1

# --- Configuration Variables ---
$serverHost = "127.0.0.1"
$serverPort = 5000
$clientPort = 5173
$clientUrl = "http://localhost:$clientPort"
$serverPath = ".\server"
$clientPath = ".\client"
$timeoutSeconds = 600 # Max time to wait for the server to respond


# --- 1. Start Server Terminal (Flask) ---
$serverPath = ".\server"
Write-Host "1. Starting Flask server in a new terminal..."

# The server command activates the venv and then runs flask
# Note: 'flask run' typically listens on 127.0.0.1:5000 by default.
$serverCommand = ".\venv\Scripts\Activate.ps1; flask run"

# 🚀 CRITICAL STEP: Start the server in a new, non-blocking PowerShell process.
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $serverPath; Write-Host 'Server terminal active.'; $serverCommand"


# --- 2. Wait for Server to be Ready (Health Check) ---
Write-Host "2. Waiting for server to become available at http://${serverHost}:${serverPort}..."
$startTime = Get-Date
$isServerReady = $false

do {
    $elapsed = (Get-Date) - $startTime
    
    # Check for timeout
    if ($elapsed.TotalSeconds -ge $timeoutSeconds) {
        Write-Error "Server startup timed out after $timeoutSeconds seconds. Check the server terminal for errors."
        exit 1
    }
    
    # Check if the port is listening (suppressing errors)
    try {
        # Test-NetConnection returns an object; casting to [bool] or checking Quiet level is robust.
        $isServerReady = (Test-NetConnection -ComputerName $serverHost -Port $serverPort -InformationLevel Quiet -WarningAction SilentlyContinue)
    } catch {
        # Ignore network errors during the first few seconds of startup
    }
    
    if (-not $isServerReady) {
        Write-Host "Still waiting ($([int]$elapsed.TotalSeconds)s elapsed)..." 
        Start-Sleep -Seconds 2 # Wait 2 seconds before checking again
    }
} while (-not $isServerReady)

Write-Host "`nServer is ready! Moving to client startup."

# ----------------------------------------------------------------------

# --- 3. Start Client Terminal (Vite/React) and Open Browser ---
Write-Host "3. Starting Client dev server in a new terminal and opening browser..."

# The browser launch command is executed BEFORE the blocking 'npm run dev' command.
$clientCommand = "Write-Host 'Opening browser...'; Start-Process -FilePath '$clientUrl'; Write-Host 'Starting NPM dev server (Press Ctrl+C to stop)...'; npm run dev"

# Start the client process non-blocking
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $clientPath; Write-Host 'Client terminal active.'; $clientCommand"

# ----------------------------------------------------------------------

Write-Host "--- Application stack launched. Check the two new terminal windows and your browser. ---"
Write-Host "To stop, press Ctrl+C in the client terminal and then manually close the server terminal."