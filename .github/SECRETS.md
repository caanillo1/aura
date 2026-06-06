# GitHub Secrets requeridos para CI/CD

Configurar en: GitHub → Settings → Secrets and variables → Actions

## Deploy Frontend (Vercel)
| Secret | Descripción |
|--------|-------------|
| `VERCEL_TOKEN` | Token de Vercel (vercel.com → Settings → Tokens) |
| `NEXT_PUBLIC_API_URL` | URL del backend en producción, ej: `https://api.aura.infotec.com/api/v1` |
| `NEXT_PUBLIC_WS_URL` | URL WebSocket backend, ej: `https://api.aura.infotec.com` |

## Deploy Backend (VPS Windows)
| Secret | Descripción |
|--------|-------------|
| `VPS_HOST` | IP o dominio del VPS, ej: `192.168.1.100` |
| `VPS_USER` | Usuario Windows con acceso SSH, ej: `Administrator` |
| `VPS_PASSWORD` | Contraseña del usuario VPS |
| `VPS_PORT` | Puerto SSH (default: `22`) |
