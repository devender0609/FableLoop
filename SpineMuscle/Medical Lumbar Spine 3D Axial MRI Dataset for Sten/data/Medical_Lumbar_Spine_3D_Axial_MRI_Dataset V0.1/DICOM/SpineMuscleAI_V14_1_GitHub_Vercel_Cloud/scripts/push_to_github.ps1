param(
  [Parameter(Mandatory=$true)]
  [string]$RepoUrl
)

$ErrorActionPreference="Stop"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is not installed or is not on PATH."
}

if (-not (Test-Path ".git")) {
  git init
}
git add .
git commit -m "SpineMuscle AI v14 cloud deployment"
git branch -M main

$remote = git remote 2>$null
if ($remote -contains "origin") {
  git remote set-url origin $RepoUrl
} else {
  git remote add origin $RepoUrl
}

git push -u origin main
