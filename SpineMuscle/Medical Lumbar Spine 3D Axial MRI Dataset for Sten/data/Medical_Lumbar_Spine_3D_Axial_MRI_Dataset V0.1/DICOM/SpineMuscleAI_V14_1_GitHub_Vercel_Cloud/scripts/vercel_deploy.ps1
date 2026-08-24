$ErrorActionPreference="Stop"

if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
  Write-Host "Installing Vercel CLI..." -ForegroundColor Yellow
  npm install -g vercel
}

Write-Host "Deploying SpineMuscle frontend to Vercel..." -ForegroundColor Cyan
Write-Host "Make sure INFERENCE_API_URL is configured in the Vercel project." -ForegroundColor Yellow
vercel --prod
