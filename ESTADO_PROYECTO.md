# AURA ERP — Estado del Proyecto
**Fecha:** 2026-06-07  
**Repositorio:** https://github.com/caanillo1/aura  
**Último commit:** `2061f9c` — feat: F4 complete - Motor de Implementacion  

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Monorepo | pnpm workspaces |
| Backend | NestJS + Prisma ORM 5.22 + SQL Server |
| Frontend | Next.js 14 + Tailwind CSS + Framer Motion |
| Autenticación | JWT (access 15m + refresh 7d) |
| Tiempo real | Socket.IO + BullMQ (Redis) |
| Base de datos | SQL Server en `167.114.33.38:1500` — DB: `AuraERP` |
| UI | Design System Glassmorphism propio |

---

## Cronograma general — 10 Fases (20 semanas)

| # | Fase | Semanas | Estado |
|---|------|---------|--------|
| F1 | Fundación & Setup | 1–2 | ✅ Completa |
| F2 | Backend Core | 3–5 | ✅ Completa |
| F3 | Frontend Foundation | 4–6 | ✅ Completa |
| F4 | Motor de Implementación | 7–10 | ✅ Completa |
| **F5** | **Gestión del Proyecto** | **9–12** | **⏳ SIGUIENTE** |
| F6 | Documentos & Firmas | 11–14 | 🔲 Pendiente |
| F7 | Tiempo Real & IA | 13–16 | 🔲 Pendiente |
| F8 | Portal Cliente & Soporte | 15–17 | 🔲 Pendiente |
| F9 | Pruebas & DevOps | 16–18 | 🔲 Pendiente |
| F10 | Documentación & Lanzamiento | 19–20 | 🔲 Pendiente |

---

## F1 — Fundación & Setup ✅

- Monorepo pnpm con workspaces (`apps/backend`, `apps/frontend`)
- Schema completo de Prisma SQL Server (todos los modelos de las 10 fases)
- Auth JWT con refresh token, guards, decoradores personalizados
- CI/CD GitHub Actions
- Arquitectura multi-tenant por `companyId`

---

## F2 — Backend Core ✅

**Módulos NestJS operativos:**
- `AuthModule` — login, register, refresh, logout, guard JWT
- `UsersModule` — CRUD usuarios agentes y clientes, toggle status, reset password
- `ClientsModule` — CRUD clientes, personal (staff) con roles de líderes
- `CompanyModule` — configuración empresa, roles, permisos, stats
- `BullMQ` — colas de tareas asíncronas
- `Socket.IO Gateway` — base para tiempo real F7

**Estructura backend:**
```
apps/backend/src/
  auth/           — JWT, guards, estrategias
  users/          — CRUD agentes y usuarios cliente
  clients/        — CRUD clientes + staff
  company/        — empresa, roles, permisos
  service-orders/ — órdenes de servicio (F4)
  templates/      — plantillas de implementación (F4)
  projects/       — proyectos y plan de trabajo (F4)
  prisma/         — PrismaService singleton
  common/         — paginación, filtros, decoradores
```

---

## F3 — Frontend Foundation ✅

- Next.js 14 App Router con layouts anidados
- Design System Glassmorphism: colores primario/secundario desde DB, modo claro/oscuro
- Login / Register funcional con JWT + cookie
- Zustand store de autenticación con hidratación SSR
- PWA: manifest.json, íconos, WCAG 2.1
- Sidebar dinámico con permisos por rol
- Páginas: Usuarios, Clientes (con personal), Dashboard, Configuración

---

## F4 — Motor de Implementación ✅

### Backend nuevo (F4)

**`/service-orders`**
- `GET /service-orders` — lista paginada (filtros: search, status, clientId)
- `GET /service-orders/:id` — detalle con implementadores + historial + proyecto
- `POST /service-orders` — crear OS, genera `osNumber` atómico `OS-{año}-{NNN}`
- `PUT /service-orders/:id` — editar (producto, alcance, fechas, líderes) — auto-uppercase
- `PATCH /service-orders/:id/status` — cambiar estado + historial automático
- `POST /service-orders/:id/implementers` — asignar implementador
- `DELETE /service-orders/:id/implementers/:userId` — quitar implementador
- `POST /service-orders/:id/generate-project` — generar proyecto desde plantilla

**`/templates`**
- CRUD completo de TemplateFlow (plantillas)
- CRUD de TemplateModule con reordenamiento drag&drop
- CRUD de TemplatePhase + TemplateActivity por módulo
- Biblioteca global de módulos reutilizables

**`/projects`**
- `GET /projects` — lista con progreso
- `GET /projects/:id` — jerarquía completa (módulos → fases → actividades)
- `PATCH /projects/phases/:id` — actualizar estado/fechas de fase
- `PATCH /projects/activities/:id` — actualizar actividad (estado, progreso, horas, responsable, fechas)
- `POST /projects/phases/:id/activities` — agregar actividad al plan
- `POST /projects/:id/load-template` — recargar plantilla en proyecto existente

### Schema Prisma — modelos clave F4

```
ServiceOrder        — OS con historial de estados
ServiceOrderHistory — log de cambios de estado
ServiceOrderImplementer — usuarios asignados a la OS
TemplateFlow        — plantilla de implementación
TemplateModule      — módulo de la plantilla
TemplatePhase       — fase del módulo
TemplateActivity    — actividad de la fase
Project             — proyecto generado desde OS
ProjectModule       — módulo del proyecto
Phase               — fase del proyecto (con responsibleId, clientStaffId)
Activity            — actividad del proyecto (assignedToId, clientStaffId)
ActivityThread      — comentarios/hilos por actividad
ClientStaff         — personal del cliente (con isProjectLeader)
```

### Frontend nuevo (F4)

**`/implementacion/ordenes`**
- Lista paginada con filtros (estado, búsqueda)
- Crear nueva OS (formulario completo)
- Detalle OS con 4 tabs:
  - **Información**: edición inline (producto, fechas, alcance, observaciones, Líder asistencial, Líder financiero, Líder del cliente)
  - **Implementadores**: lista + asignar/quitar
  - **Historial**: timeline de cambios de estado
  - **Proyecto**: stats de avance + link al proyecto, o botón generar

**`/implementacion/plantillas`**
- Lista de plantillas en cards
- Constructor visual con Drag & Drop (`@hello-pangea/dnd`)
- Crear/editar/eliminar módulos, fases, actividades
- Link a biblioteca de módulos

**`/implementacion/modulos`**
- Biblioteca global de módulos reutilizables
- Detalle por módulo: CRUD completo de fases y actividades con DnD

**`/implementacion/proyectos`**
- Lista de proyectos con estado y barra de progreso
- Detalle proyecto: plan de trabajo interactivo por módulo → fase → actividad
  - Fechas inicio/fin planificadas y reales por actividad
  - Días calculados (fin - inicio)
  - Responsable: agente interno o personal del cliente
  - Usuario que ejecutó (completó) la actividad
  - Agregar actividades nuevas al plan
  - Hilos de comentarios por actividad

**`/clientes/[id]` — Personal del cliente**
- CRUD individual (documento, nombre, cargo, correo)
- Checkbox "Líder de proyecto" (`isProjectLeader`) con badge ⭐
- Descarga plantilla Excel (2 hojas: instructivo + datos)
- Carga masiva desde Excel con preview antes de importar

**Wizard "Generar Proyecto" (2 pasos)**
1. Seleccionar plantilla + nombre del proyecto
2. Por módulo: botón Excluir/Incluir + por fase: Inicio, Fin, Líder agente, Líder cliente

---

## F5 — Gestión del Proyecto ⏳ SIGUIENTE (semanas 9–12)

### Qué falta construir en F5

**Backend:**
- Dependencias entre actividades (`ActivityDependency` ya está en schema)
- Recálculo automático de progreso: actividad → fase → módulo → proyecto
- Endpoint de estadísticas del proyecto (KPIs, actividades por estado)
- Filtros avanzados en actividades

**Frontend:**
- Gantt / timeline visual por fases
- Dashboard del proyecto: tarjetas KPI (actividades completadas, en progreso, bloqueadas, días restantes)
- Vista Kanban de actividades por estado
- Gestión de dependencias entre actividades (predecesoras)
- Alertas de actividades vencidas o próximas a vencer

---

## Archivos de entorno

**`apps/backend/.env`**
```
DATABASE_URL=sqlserver://167.114.33.38:1500;database=AuraERP;user=sa;password=boIJ9Nzs;encrypt=false;trustServerCertificate=true
PORT=3001
JWT_SECRET=aura_erp_jwt_secret_infotec_2024_xK9mP2nQ8rL5wV3j
JWT_REFRESH_SECRET=aura_erp_refresh_secret_infotec_2024_yT7hN4bE6uW1cF0k
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
AES_SECRET_KEY=aura_aes_key_infotec_2024_32chars!
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

**`apps/frontend/.env.local`**
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_WS_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=AURA ERP
```

---

## Comandos para arrancar

```powershell
# Desde C:\AURA
pnpm --filter backend start:dev    # Backend en http://localhost:3001
pnpm --filter frontend dev         # Frontend en http://localhost:3000
# Swagger: http://localhost:3001/api/docs
```

---

## Para continuar en otro PC con Claude

1. Abrir VSCode en `C:\AURA`
2. Abrir Claude Code desde la extensión
3. Preguntar: **"¿en qué fase vamos y qué sigue?"**

Claude leerá la memoria del proyecto automáticamente y continuará desde F5.
