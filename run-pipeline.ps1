$ErrorActionPreference = "Continue"
Set-Location "C:\Users\琮琮\ai-money-engine"
$logFile = "logs\pipeline.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"[$timestamp] ===== AI Pipeline =====" | Out-File -Append $logFile -Encoding utf8
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
npm run pipeline 2>&1 | Out-File -Append $logFile -Encoding utf8
