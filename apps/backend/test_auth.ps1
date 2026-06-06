# ============================================================
# AURA ERP - Script de prueba: Registro e Inicio de Sesión
# Ejecutar desde: C:\AURA\apps\backend
# Uso:  .\test_auth.ps1
# ============================================================

$BASE = "http://localhost:3001/api/v1"
$PASS = @{ "Content-Type" = "application/json" }

function Write-Header($msg) {
    Write-Host "`n$('=' * 55)" -ForegroundColor Cyan
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host "$('=' * 55)" -ForegroundColor Cyan
}

function Invoke-Api($method, $path, $body) {
    $url = "$BASE$path"
    try {
        if ($body) {
            $json = $body | ConvertTo-Json
            $r = Invoke-RestMethod -Method $method -Uri $url -Headers $PASS -Body $json -ErrorVariable err
        } else {
            $r = Invoke-RestMethod -Method $method -Uri $url -Headers $PASS -ErrorVariable err
        }
        return $r
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        $detail = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        Write-Host "  ERROR $status : $($detail.message ?? $_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# ── 0. HEALTH CHECK ──────────────────────────────────────────
Write-Header "0. Health Check"
$h = Invoke-Api GET "/auth/health"
if ($h) {
    Write-Host "  Status : $($h.status)" -ForegroundColor Green
    Write-Host "  Service: $($h.service)" -ForegroundColor Green
} else {
    Write-Host "  El servidor no está corriendo. Ejecuta: npm run start:dev" -ForegroundColor Red
    exit 1
}

# ── 1. LOGIN CON ADMIN (seed) ─────────────────────────────────
Write-Header "1. Login Admin (admin@infotec.com)"
$loginAdmin = Invoke-Api POST "/auth/login" @{
    email    = "admin@infotec.com"
    password = "Admin@2024!"
}
if ($loginAdmin) {
    Write-Host "  OK - Usuario: $($loginAdmin.user.firstName) $($loginAdmin.user.lastName)" -ForegroundColor Green
    Write-Host "  Rol       : $($loginAdmin.user.role)" -ForegroundColor Green
    Write-Host "  AccessToken: $($loginAdmin.accessToken.Substring(0,40))..." -ForegroundColor DarkGreen
    $adminToken = $loginAdmin.accessToken
}

# ── 2. GET /ME CON TOKEN ──────────────────────────────────────
Write-Header "2. GET /auth/me (con token admin)"
if ($adminToken) {
    try {
        $me = Invoke-RestMethod -Method GET -Uri "$BASE/auth/me" `
            -Headers @{ "Authorization" = "Bearer $adminToken"; "Content-Type" = "application/json" }
        Write-Host "  OK - Email   : $($me.email)" -ForegroundColor Green
        Write-Host "  Empresa      : $($me.company.name)" -ForegroundColor Green
        Write-Host "  Rol          : $($me.role.name)" -ForegroundColor Green
    } catch {
        $detail = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        Write-Host "  ERROR: $($detail.message ?? $_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "  SKIP (no hay token)" -ForegroundColor Yellow
}

# ── 3. LOGIN CON CREDENCIALES INCORRECTAS ────────────────────
Write-Header "3. Login con contraseña incorrecta (debe dar 401)"
$loginFail = Invoke-Api POST "/auth/login" @{
    email    = "admin@infotec.com"
    password = "WrongPassword!"
}
if (-not $loginFail) {
    Write-Host "  OK - Rechazó correctamente (401 esperado)" -ForegroundColor Green
}

# ── 4. REGISTRO DE NUEVO AGENTE ───────────────────────────────
Write-Header "4. Registro - Nuevo Agente"
$ts = Get-Date -Format "HHmmss"
$newAgent = Invoke-Api POST "/auth/register" @{
    userType        = "agent"
    document        = "99$ts"
    firstName       = "Laura"
    lastName        = "Implementadora"
    email           = "laura$ts@infotec.com"
    password        = "Agent@2024!"
    jobTitle        = "Implementadora Asistencial"
    agentRegPassword = "Agent@2024!"
}
if ($newAgent) {
    Write-Host "  OK - ID   : $($newAgent.user.id)" -ForegroundColor Green
    Write-Host "  Email     : $($newAgent.user.email)" -ForegroundColor Green
    Write-Host "  Rol       : $($newAgent.user.role)" -ForegroundColor Green
    Write-Host "  Token     : $($newAgent.accessToken.Substring(0,40))..." -ForegroundColor DarkGreen
}

# ── 5. REGISTRO DE NUEVO AGENTE CON CONTRASEÑA INCORRECTA ────
Write-Header "5. Registro agente con contraseña de registro incorrecta (401)"
$badAgent = Invoke-Api POST "/auth/register" @{
    userType        = "agent"
    document        = "88$ts"
    firstName       = "Fake"
    lastName        = "Agente"
    email           = "fake$ts@infotec.com"
    password        = "Test@2024!"
    agentRegPassword = "WrongAgentPass!"
}
if (-not $badAgent) {
    Write-Host "  OK - Rechazó correctamente (401 esperado)" -ForegroundColor Green
}

# ── 6. REGISTRO DE NUEVO CLIENTE CON EMPRESA NUEVA ───────────
Write-Header "6. Registro - Nuevo Cliente (empresa nueva)"
$nit = "900$ts"
$newClient = Invoke-Api POST "/auth/register" @{
    userType             = "client"
    document             = "77$ts"
    firstName            = "Pedro"
    lastName             = "Cliente"
    email                = "pedro$ts@hospital.com"
    password             = "Client@2024!"
    companyNit           = $nit
    companyBusinessName  = "Hospital Prueba $ts S.A.S"
    companyCommercialName= "Hospital Prueba"
    companyCity          = "Bogotá"
    companyDepartment    = "Cundinamarca"
    companyEmail         = "contacto$ts@hospital.com"
}
if ($newClient) {
    Write-Host "  OK - ID   : $($newClient.user.id)" -ForegroundColor Green
    Write-Host "  Email     : $($newClient.user.email)" -ForegroundColor Green
    Write-Host "  Rol       : $($newClient.user.role)" -ForegroundColor Green
}

# ── 7. LOGIN CON EL NUEVO AGENTE ─────────────────────────────
Write-Header "7. Login con el nuevo agente creado"
if ($newAgent) {
    $loginNew = Invoke-Api POST "/auth/login" @{
        email    = $newAgent.user.email
        password = "Agent@2024!"
    }
    if ($loginNew) {
        Write-Host "  OK - $($loginNew.user.firstName) $($loginNew.user.lastName)" -ForegroundColor Green
        Write-Host "  Rol: $($loginNew.user.roleName)" -ForegroundColor Green
    }
} else {
    Write-Host "  SKIP (registro paso 4 falló)" -ForegroundColor Yellow
}

# ── 8. REGISTRO EMAIL DUPLICADO ───────────────────────────────
Write-Header "8. Registro con email duplicado (debe dar 409)"
$dup = Invoke-Api POST "/auth/register" @{
    userType = "agent"
    document = "11111111"
    firstName = "Dup"
    lastName  = "Test"
    email     = "admin@infotec.com"
    password  = "Test@2024!"
    agentRegPassword = "Agent@2024!"
}
if (-not $dup) {
    Write-Host "  OK - Rechazó correctamente (409 esperado)" -ForegroundColor Green
}

# ── RESUMEN ───────────────────────────────────────────────────
Write-Host "`n$('=' * 55)" -ForegroundColor Cyan
Write-Host "  Pruebas completadas" -ForegroundColor Cyan
Write-Host "$('=' * 55)`n" -ForegroundColor Cyan
