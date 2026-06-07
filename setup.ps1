# =============================================================================
# AURA ERP — Script de instalación y arranque
# Ejecutar desde PowerShell como administrador:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\setup.ps1
# =============================================================================

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "AURA ERP — Setup"

function Write-Step  { param($n,$msg) Write-Host "`n[$n] $msg" -ForegroundColor Cyan }
function Write-OK    { param($msg)    Write-Host "    OK  $msg" -ForegroundColor Green }
function Write-Warn  { param($msg)    Write-Host "    WARN $msg" -ForegroundColor Yellow }
function Write-Fail  { param($msg)    Write-Host "    ERR  $msg" -ForegroundColor Red; exit 1 }

Write-Host @"

  ╔══════════════════════════════════════╗
  ║        AURA ERP  —  Setup           ║
  ╚══════════════════════════════════════╝

"@ -ForegroundColor Magenta

# ─────────────────────────────────────────────────────────────────────────────
# PASO 1 — Prerrequisitos
# ─────────────────────────────────────────────────────────────────────────────
Write-Step 1 "Verificando prerrequisitos"

# Node.js >= 18
try {
    $nodeVer = (node --version 2>&1).ToString().TrimStart('v')
    $nodeMaj = [int]($nodeVer.Split('.')[0])
    if ($nodeMaj -lt 18) { Write-Fail "Node.js $nodeVer detectado. Se requiere >= 18. Descarga: https://nodejs.org" }
    Write-OK "Node.js v$nodeVer"
} catch { Write-Fail "Node.js no encontrado. Descarga: https://nodejs.org" }

# Git
try {
    $gitVer = (git --version 2>&1).ToString()
    Write-OK $gitVer
} catch { Write-Fail "Git no encontrado. Descarga: https://git-scm.com" }

# pnpm
try {
    $pnpmVer = (pnpm --version 2>&1).ToString()
    Write-OK "pnpm v$pnpmVer"
} catch {
    Write-Warn "pnpm no encontrado. Instalando..."
    npm install -g pnpm | Out-Null
    Write-OK "pnpm instalado"
}

# ─────────────────────────────────────────────────────────────────────────────
# PASO 2 — Clonar o actualizar repositorio
# ─────────────────────────────────────────────────────────────────────────────
Write-Step 2 "Repositorio"

$repoUrl  = "https://github.com/caanillo1/aura.git"
$repoPath = "C:\AURA"

if (Test-Path "$repoPath\.git") {
    Write-OK "Repositorio ya existe en $repoPath"
    Set-Location $repoPath
    Write-Host "    Actualizando desde origin/main..." -ForegroundColor DarkCyan
    git pull origin main 2>&1 | Out-Null
    Write-OK "Repositorio actualizado"
} else {
    Write-Host "    Clonando $repoUrl en $repoPath..." -ForegroundColor DarkCyan
    git clone $repoUrl $repoPath 2>&1
    Set-Location $repoPath
    Write-OK "Repositorio clonado en $repoPath"
}

# ─────────────────────────────────────────────────────────────────────────────
# PASO 3 — Archivos de entorno (.env)
# ─────────────────────────────────────────────────────────────────────────────
Write-Step 3 "Archivos de entorno"

# Backend .env
$backendEnv = "apps\backend\.env"
if (-not (Test-Path $backendEnv)) {
    Set-Content -Path $backendEnv -Encoding utf8 -Value @"
# =============================================
# AURA ERP - Backend (.env)
# =============================================

DATABASE_URL=sqlserver://167.114.33.38:1500;database=AuraERP;user=sa;password=boIJ9Nzs;encrypt=false;trustServerCertificate=true;loginTimeout=30;connectionTimeout=30

DB_HOST=167.114.33.38
DB_PORT=1500
DB_NAME=AuraERP
DB_USER=sa
DB_PASSWORD=boIJ9Nzs

NODE_ENV=development
PORT=3001
API_PREFIX=api/v1

JWT_SECRET=aura_erp_jwt_secret_infotec_2024_xK9mP2nQ8rL5wV3j
JWT_REFRESH_SECRET=aura_erp_refresh_secret_infotec_2024_yT7hN4bE6uW1cF0k
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

AES_SECRET_KEY=aura_aes_key_infotec_2024_32chars!

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

FILES_BASE_PATH=C:\AURA_FILES\FILES
MAX_FILE_SIZE_MB=50

SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=correo@infotec.com
SMTP_PASSWORD=contrasena_correo
SMTP_FROM_NAME=AURA ERP
SMTP_FROM_EMAIL=correo@infotec.com

FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000

OPENAI_API_KEY=sk-pendiente
LOG_LEVEL=debug
"@
    Write-OK "Creado $backendEnv"
} else {
    Write-OK "$backendEnv ya existe (no se sobreescribió)"
}

# Frontend .env.local
$frontendEnv = "apps\frontend\.env.local"
if (-not (Test-Path $frontendEnv)) {
    Set-Content -Path $frontendEnv -Encoding utf8 -Value @"
# =============================================
# AURA ERP - Frontend (.env.local)
# =============================================

PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_WS_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=AURA ERP
NEXT_PUBLIC_COMPANY_NAME=Sistemas Infotec
"@
    Write-OK "Creado $frontendEnv"
} else {
    Write-OK "$frontendEnv ya existe (no se sobreescribió)"
}

# Carpeta de archivos subidos
if (-not (Test-Path "C:\AURA_FILES\FILES")) {
    New-Item -ItemType Directory -Path "C:\AURA_FILES\FILES" -Force | Out-Null
    Write-OK "Carpeta C:\AURA_FILES\FILES creada"
} else {
    Write-OK "Carpeta C:\AURA_FILES\FILES ya existe"
}

# ─────────────────────────────────────────────────────────────────────────────
# PASO 4 — Instalar dependencias
# ─────────────────────────────────────────────────────────────────────────────
Write-Step 4 "Instalando dependencias (pnpm install)"
pnpm install
Write-OK "Dependencias instaladas"

# ─────────────────────────────────────────────────────────────────────────────
# PASO 5 — Prisma: generar cliente
# ─────────────────────────────────────────────────────────────────────────────
Write-Step 5 "Generando Prisma Client"
Set-Location "apps\backend"
npx prisma generate 2>&1 | Select-String -Pattern "Generated|Error" | ForEach-Object { Write-Host "    $_" }
Set-Location "..\..\"
Write-OK "Prisma Client generado"

# ─────────────────────────────────────────────────────────────────────────────
# PASO 6 — Prisma: sincronizar DB
# ─────────────────────────────────────────────────────────────────────────────
Write-Step 6 "Sincronizar base de datos (prisma db push)"
$doPush = Read-Host "    ¿Sincronizar schema con la DB? (s/N)"
if ($doPush -match '^[sS]') {
    Set-Location "apps\backend"
    npx prisma db push 2>&1 | Select-String -Pattern "sync|Done|Error|warn" | ForEach-Object { Write-Host "    $_" }
    Set-Location "..\..\"
    Write-OK "DB sincronizada"
} else {
    Write-Warn "Sincronización omitida (el schema ya debería estar actualizado en el servidor)"
}

# ─────────────────────────────────────────────────────────────────────────────
# PASO 7 — Memoria de Claude Code
# ─────────────────────────────────────────────────────────────────────────────
Write-Step 7 "Memoria de Claude Code"

$memTarget = "$env:USERPROFILE\.claude\projects\c--AURA\memory"
if (-not (Test-Path $memTarget)) {
    New-Item -ItemType Directory -Path $memTarget -Force | Out-Null
}

$memFiles = @{
    "MEMORY.md" = @"
# AURA Project Memory Index

- [Project paths and structure](project_paths.md) — rutas del proyecto y carpeta de documentos de trabajo
- [Project phases / cronograma](project_phases.md) — 10 fases F1–F10, estado actual y entregables clave
"@

    "project_paths.md" = @"
---
name: project-paths
description: Rutas del proyecto AURA — repositorio git y carpeta de documentos/archivos de trabajo
metadata:
  node_type: memory
  type: project
---

El repositorio git activo del proyecto es ``c:\AURA`` (working directory de Claude Code).

La carpeta de trabajo/documentos del usuario es ``C:\Users\usuario\Documents\Claude\Projects\AURA 2`` — contiene:
- ``frontend-pwa/`` — archivos F3 (manifest, wcag, icon)
- ``backend-modules/`` — archivos F2 (gateway, queues)
- ``AURA_Cronograma_Trabajo.xlsx`` — cronograma/fases del proyecto
- ``PROMOPT AURA.docx`` — prompt/descripción del proyecto
- ``ACTA INICIO PROYECTO.docx`` — acta de inicio

**Why:** El usuario trabaja los archivos en "AURA 2" y luego los aplica al repo en ``c:\AURA``.
**How to apply:** Si el usuario pide revisar fases o documentación del proyecto, buscar en ``C:\Users\usuario\Documents\Claude\Projects\AURA 2``. El cronograma está en el xlsx ahí.
"@

    "project_phases.md" = @"
---
name: project-phases
description: "Cronograma completo de fases del proyecto AURA con semanas, duración y entregables"
metadata:
  node_type: memory
  type: project
---

| ID  | Fase                         | Sem. Inicio | Sem. Fin | Duración | Descripción                                              | Entregables Clave                                              |
|-----|------------------------------|-------------|----------|----------|----------------------------------------------------------|----------------------------------------------------------------|
| F1  | Fundación & Setup            | Semana 1    | Semana 2 | 2 sem.   | Arquitectura, DB, Auth, CI/CD base                       | Repo Git, schema DB, arquitectura C4, CI base                 |
| F2  | Backend Core                 | Semana 3    | Semana 5 | 3 sem.   | NestJS, Prisma ORM, APIs base, Multi-tenant              | APIs REST documentadas, Prisma schema, Swagger                |
| F3  | Frontend Foundation          | Semana 4    | Semana 6 | 3 sem.   | Next.js, Design System Glassmorphism, Auth UI            | Design system, Login/Register funcional, PWA                  |
| F4  | Motor de Implementación      | Semana 7    | Semana 10| 4 sem.   | OS, Plantillas, Constructor Visual Drag&Drop             | CRUD OS, constructor flujos, generación automática proyectos  |
| F5  | Gestión del Proyecto         | Semana 9    | Semana 12| 4 sem.   | Actividades, Dependencias, Cálculo Avance                | Módulo actividades, dependencias, dashboards base             |
| F6  | Documentos & Firmas          | Semana 11   | Semana 14| 4 sem.   | PDF/Word, Firmas digitales, Evidencias, Visitas          | Generación actas PDF/Word, firmas móviles, evidencias         |
| F7  | Tiempo Real & IA             | Semana 13   | Semana 16| 4 sem.   | Socket.IO Dashboard, IA Ejecutiva, Informes              | Dashboard tiempo real, motor IA, correos M365                 |
| F8  | Portal Cliente & Soporte     | Semana 15   | Semana 17| 3 sem.   | Portal cliente, Entrega soporte, Lecciones               | Portal cliente completo, módulo entrega soporte               |
| F9  | Pruebas & DevOps             | Semana 16   | Semana 18| 3 sem.   | E2E Testing, CI/CD completo, OWASP, Performance          | Suite E2E, security scan, performance report                  |
| F10 | Documentación & Lanzamiento  | Semana 19   | Semana 20| 2 sem.   | Swagger, UX Docs, Despliegue producción, npx setup       | Docs completa, deploy Vercel+VPS, instalador npx              |

## Estado actual (2026-06-06)

**F1 ✅ Completa** — Repo, Prisma schema, Auth JWT, CI/CD GitHub Actions, arquitectura monorepo pnpm
**F2 ✅ Completa** — NestJS modules: auth, users, clients, company, prisma. BullMQ + Socket.IO gateway integrados
**F3 ✅ Completa** — Next.js, Design System Glassmorphism, Login/Register, PWA manifest, WCAG 2.1
**F4 ✅ Completa** — CRUD OS, plantillas drag&drop, proyectos desde OS, gestión plan de trabajo con actividades
**F5 ⏳ Siguiente** — Gantt/timeline, dependencias, dashboard de proyecto, cálculo de avance automático
**F6–F10 ⏳ Pendientes**

## F4 — Completado
- Backend: ServiceOrders, Templates, Projects, TemplateModules
- Frontend: /implementacion/ordenes, /plantillas, /modulos, /proyectos
- Wizard generación proyecto: excluir módulos + líderes por fase (agente + cliente)
- Personal cliente: CRUD individual + carga masiva Excel (plantilla descargable)
- Edición OS: Líder asistencial, Líder del cliente (filtrado isProjectLeader)
- Plan de trabajo: fechas, días calculados, responsables, ejecutor por actividad

**Why:** Cronograma extraído de AURA_Cronograma_Trabajo.xlsx
**How to apply:** Usar este cronograma para orientar qué construir a continuación.
"@
}

foreach ($file in $memFiles.Keys) {
    $path = Join-Path $memTarget $file
    Set-Content -Path $path -Encoding utf8 -Value $memFiles[$file]
    Write-OK "Memoria: $file"
}

# ─────────────────────────────────────────────────────────────────────────────
# PASO 8 — Arrancar servidores
# ─────────────────────────────────────────────────────────────────────────────
Write-Step 8 "Arrancar servidores"
$doStart = Read-Host "    ¿Iniciar backend y frontend ahora? (s/N)"
if ($doStart -match '^[sS]') {
    Write-Host "    Iniciando backend en nueva ventana..." -ForegroundColor DarkCyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'C:\AURA'; pnpm --filter backend start:dev" -WindowStyle Normal

    Start-Sleep -Seconds 3

    Write-Host "    Iniciando frontend en nueva ventana..." -ForegroundColor DarkCyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'C:\AURA'; pnpm --filter frontend dev" -WindowStyle Normal

    Write-OK "Servidores iniciados"
    Write-Host "`n    Backend:  http://localhost:3001/api/v1" -ForegroundColor White
    Write-Host "    Swagger:  http://localhost:3001/api/docs" -ForegroundColor White
    Write-Host "    Frontend: http://localhost:3000" -ForegroundColor White
} else {
    Write-Warn "Servidores no iniciados. Para arrancar manualmente:"
    Write-Host "    pnpm --filter backend start:dev" -ForegroundColor DarkGray
    Write-Host "    pnpm --filter frontend dev" -ForegroundColor DarkGray
}

# ─────────────────────────────────────────────────────────────────────────────
# FIN
# ─────────────────────────────────────────────────────────────────────────────
Write-Host @"

  ╔══════════════════════════════════════╗
  ║   Setup completado. Bienvenido!     ║
  ╚══════════════════════════════════════╝

  Claude Code: abre VSCode en C:\AURA y
  ejecuta Claude desde la extensión.
  El contexto del proyecto (fases, memoria)
  ya quedó cargado automaticamente.

"@ -ForegroundColor Green
