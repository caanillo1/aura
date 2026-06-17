# ================================================================
# AURA ERP — Script de despliegue en Windows Server 2019
# Ejecutar en el VPS como Administrador
# ================================================================

$ErrorActionPreference = "Stop"

# ── 1. Verificar Node.js ────────────────────────────────────────
Write-Host "`n[1/6] Verificando Node.js..." -ForegroundColor Cyan
try {
    $nodeVersion = node --version
    Write-Host "  Node.js ya instalado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  Node.js no encontrado. Descargando instalador..." -ForegroundColor Yellow
    $nodeUrl = "https://nodejs.org/dist/v20.19.0/node-v20.19.0-x64.msi"
    $nodeInstaller = "$env:TEMP\nodejs.msi"
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller
    Start-Process msiexec.exe -ArgumentList "/i `"$nodeInstaller`" /quiet /norestart ADDLOCAL=ALL" -Wait
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine")
    Write-Host "  Node.js instalado." -ForegroundColor Green
}

# ── 2. Instalar pnpm y PM2 ──────────────────────────────────────
Write-Host "`n[2/6] Instalando pnpm y PM2..." -ForegroundColor Cyan
npm install -g pnpm@8 pm2 --quiet
Write-Host "  pnpm y PM2 instalados." -ForegroundColor Green

# ── 3. Instalar dependencias y compilar ─────────────────────────
Write-Host "`n[3/6] Instalando dependencias..." -ForegroundColor Cyan
Set-Location $PSScriptRoot\apps\backend
pnpm install --frozen-lockfile

Write-Host "`n[4/6] Compilando TypeScript..." -ForegroundColor Cyan
pnpm run build

# ── 5. Crear directorio de logs ─────────────────────────────────
Write-Host "`n[5/6] Preparando directorios..." -ForegroundColor Cyan
if (-not (Test-Path "logs")) { New-Item -ItemType Directory -Path "logs" | Out-Null }
if (-not (Test-Path "wa-session")) { New-Item -ItemType Directory -Path "wa-session" | Out-Null }

# ── 6. Iniciar con PM2 ──────────────────────────────────────────
Write-Host "`n[6/6] Iniciando con PM2..." -ForegroundColor Cyan
pm2 delete aura-backend -ErrorAction SilentlyContinue
pm2 start ecosystem.config.js --env production
pm2 save

Write-Host "`n✅ Backend desplegado correctamente." -ForegroundColor Green
Write-Host "   Ejecuta 'pm2 logs aura-backend' para ver logs." -ForegroundColor Gray
Write-Host "   Ejecuta 'pm2 status' para ver estado." -ForegroundColor Gray
