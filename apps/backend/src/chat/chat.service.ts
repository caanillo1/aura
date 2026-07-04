import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyService } from '../company/company.service';

type Role = 'user' | 'assistant';

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ChatContext {
  pagina?: string;
  entityId?: string;
  entityTipo?: string;
}

type Intent =
  | 'dashboard'
  | 'ordenes'
  | 'proyectos'
  | 'requerimientos'
  | 'actas'
  | 'clientes'
  | 'general';

const INTENT_LABELS: Record<Intent, string> = {
  dashboard:       'dashboard ejecutivo (KPIs y gráficas)',
  ordenes:         'órdenes de servicio',
  proyectos:       'proyectos de implementación',
  requerimientos:  'requerimientos y tickets',
  actas:           'actas de reunión',
  clientes:        'clientes',
  general:         'información general',
};

const PROYECTOS_CONTEXT = `
Mapeos de valores en datos de proyectos y actividades:
- status de proyecto: "activo"="En Ejecución", "completado"="Completado", "pausado"="Suspendido", "cancelado"="Cancelado", "pendiente"="Pendiente de inicio"
- status de actividad: "pendiente"="Pendiente", "en_proceso"="En Ejecución", "completado"="Completada", "cancelado"="Cancelada", "vencida"="Vencida"
- priority: "alta", "media", "baja"
- progressPercent: porcentaje de avance (0-100)
`;

// Human-readable labels for dashboard coded values — passed to the AI so it can interpret them
const DASHBOARD_CONTEXT = `
Mapeos de valores que aparecen en los datos del dashboard:
- projectsByStatus.status: "activo"="En Ejecución", "completado"="Completados", "pausado"="Suspendidos", "cancelado"="Cancelados", "pendiente"="Pendientes de Inicio"
- activitiesByStatus.status: "pendiente"="Pendientes", "en_proceso"="En Proceso", "completado"="Finalizadas", "cancelado"="Canceladas", "vencida"="Vencidas"
- pendingActasSignature.type: "inicio"="Inicio", "visita"="Visita", "capacitacion"="Capacitación", "parametrizacion"="Parametrización", "cierre"="Cierre", "entrega_soporte"="Soporte"
- projectRisks.risk: "critico"="Crítico", "alto"="Alto"
- kpis.*: cada KPI tiene "value" (valor actual), "delta" (cambio) y "deltaLabel" (periodo de comparación)
- clientProgress.progress: porcentaje de avance del proyecto (0–100)
- implementerWorkload.count: número de actividades pendientes/en proceso asignadas a ese implementador
`;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    private companyService: CompanyService,
  ) {}

  async chat(
    companyId: string,
    mensaje: string,
    historial: ChatMessage[],
    contexto?: ChatContext,
  ): Promise<{ respuesta: string; intent: string }> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY no configurado');

    try {
      const intent = this.detectIntent(mensaje, contexto);
      const datos = await this.fetchData(companyId, intent, mensaje);
      const systemPrompt = this.buildSystemPrompt(intent, datos);

      // Keep last 4 messages only — reduces token usage by ~1500 tokens vs 10 messages
      const messages = [
        { role: 'system', content: systemPrompt },
        ...historial.slice(-4),
        { role: 'user', content: mensaje },
      ];

      const groqBody = JSON.stringify(
        {
          model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.4,
          max_tokens: 1024,
        },
        (_, v) => (typeof v === 'bigint' ? Number(v) : v),
      );

      const groqFetch = () => fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: groqBody,
      });

      let response = await groqFetch();

      // TPM rate limit → wait the suggested seconds and retry once
      if (!response.ok && response.status === 429) {
        const errText = await response.text();
        this.logger.error(`Groq error (429): ${errText}`);
        const isTPM = errText.includes('tokens per minute');
        if (isTPM) {
          const waitMatch = errText.match(/try again in ([\d.]+)s/);
          const waitMs = waitMatch ? Math.ceil(parseFloat(waitMatch[1]) * 1000) + 500 : 7000;
          this.logger.warn(`TPM rate limit, retrying in ${waitMs}ms...`);
          await new Promise(r => setTimeout(r, waitMs));
          response = await groqFetch();
        } else {
          // TPD (daily) exhausted — no point retrying
          return {
            respuesta: 'Se agotó la cuota diaria del servicio de IA. El chat estará disponible nuevamente mañana.',
            intent,
          };
        }
      }

      if (!response.ok) {
        const err = await response.text();
        this.logger.error(`Groq error (${response.status}): ${err}`);
        return { respuesta: 'La IA no pudo procesar la consulta en este momento. Intenta de nuevo.', intent };
      }

      const json = (await response.json()) as any;
      const respuesta =
        json.choices?.[0]?.message?.content ?? 'No se pudo obtener una respuesta.';

      return { respuesta, intent };
    } catch (err: any) {
      this.logger.error(`Chat error: ${err?.message}`, err?.stack);
      return { respuesta: 'Ocurrió un error al procesar tu consulta. Intenta de nuevo.', intent: 'general' };
    }
  }

  // ── Intent detection ────────────────────────────────────────────────────────

  private detectIntent(mensaje: string, contexto?: ChatContext): Intent {
    const lower = mensaje.toLowerCase();
    const pagina = (contexto?.pagina ?? '').toLowerCase();

    // Dashboard keywords — highest priority
    if (/\bdashboard\b|gr[aá]fic[ao]|kpi\b|m[eé]trica|indicador|briefing|ejecutivo|vencida|carga de trabajo|carga.*implementador|implementador.*carga/i.test(lower)) return 'dashboard';

    // Context-based for other intents
    if (pagina.includes('orden') && !lower.match(/proyecto|requerimiento|acta/)) return 'ordenes';
    if (pagina.includes('proyecto') && !lower.match(/orden|requerimiento|acta/)) return 'proyectos';
    if (pagina.includes('requerimiento') && !lower.match(/orden|proyecto|acta/)) return 'requerimientos';
    if (pagina.includes('acta') && !lower.match(/orden|proyecto|requerimiento/)) return 'actas';

    // Keyword-based
    if (/orden(es)?\s*(de\s*)?servicio|\borden\b|\bos\b/i.test(lower)) return 'ordenes';
    if (/\bproyecto|avance|m[oó]dulo(s)?\b|fase\b|actividad(es)?\b/i.test(lower)) return 'proyectos';
    if (/requerimiento|ticket|gesti[oó]n|priori(dad|zar)|backlog/i.test(lower)) return 'requerimientos';
    if (/\bacta\b|reuni[oó]n/i.test(lower)) return 'actas';
    if (/\bcliente|empresa|compa[nñ]/i.test(lower)) return 'clientes';
    if (/resumen|informe|estad[ií]stic|general|todos/i.test(lower)) return 'dashboard';

    return 'general';
  }

  // ── Search term extraction ──────────────────────────────────────────────────

  private extractSearchTerms(mensaje: string): string[] {
    const terms = new Set<string>();

    const nums = mensaje.match(/\b\d+\b/g);
    if (nums) nums.forEach(n => terms.add(n));

    const quoted = mensaje.match(/["']([^"']{2,})["']/g);
    if (quoted) quoted.map(q => q.replace(/["']/g, '')).forEach(q => terms.add(q));

    const proper = mensaje.match(/\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{3,}(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}){0,3}/g);
    if (proper) proper.filter(w => w.length >= 4).forEach(w => terms.add(w));

    return [...terms];
  }

  // ── Data fetching ───────────────────────────────────────────────────────────

  private async fetchData(companyId: string, intent: Intent, mensaje: string): Promise<any> {
    try {
      const terms = this.extractSearchTerms(mensaje);
      switch (intent) {
        case 'dashboard':      return await this.companyService.getDashboard(companyId);
        case 'ordenes':        return await this.fetchOrdenes(companyId, terms);
        case 'proyectos':      return await this.fetchProyectos(companyId, terms);
        case 'requerimientos': return await this.fetchRequerimientos(companyId, terms);
        case 'actas':          return await this.fetchActas(companyId, terms);
        case 'clientes':       return await this.fetchClientes(companyId, terms);
        default:               return null;
      }
    } catch (err: any) {
      this.logger.error(`Error fetching data intent=${intent}: ${err?.message}`);
      return null;
    }
  }

  private async fetchOrdenes(companyId: string, terms: string[]) {
    if (terms.length > 0) {
      for (const term of terms) {
        const like = `%${term}%`;
        const rows = await this.prisma.$queryRaw<any[]>`
          SELECT
            o.osNumber, o.status, o.product, o.startDate, o.endDate,
            o.ticketRubi, o.observations,
            c.businessName AS cliente
          FROM OrdenesServicio o
          JOIN Clientes c ON o.clientId = c.id
          WHERE o.companyId = ${companyId}
            AND (o.osNumber LIKE ${like} OR c.businessName LIKE ${like} OR o.product LIKE ${like})
          ORDER BY o.osNumber
        `;
        if (rows.length > 0) return { tipo: 'detalle_especifico', registros: rows };
      }
    }

    const [stats, todos] = await Promise.all([
      this.prisma.$queryRaw<any[]>`
        SELECT status, CAST(COUNT(*) AS INT) AS total
        FROM OrdenesServicio WHERE companyId = ${companyId}
        GROUP BY status
      `,
      this.prisma.$queryRaw<any[]>`
        SELECT TOP 50 o.osNumber, o.status, o.product, c.businessName AS cliente
        FROM OrdenesServicio o
        JOIN Clientes c ON o.clientId = c.id
        WHERE o.companyId = ${companyId}
        ORDER BY o.osNumber DESC
      `,
    ]);
    return { tipo: 'resumen_general', estadisticas: stats, ordenes: todos };
  }

  private async fetchProyectos(companyId: string, terms: string[]) {
    if (terms.length > 0) {
      for (const term of terms) {
        const like = `%${term}%`;
        const [proyectos, actividades] = await Promise.all([
          this.prisma.$queryRaw<any[]>`
            SELECT p.name AS proyecto, p.status, p.progressPercent, p.startDate, p.endDate,
              c.businessName AS cliente
            FROM Proyectos p
            JOIN OrdenesServicio o ON p.serviceOrderId = o.id
            JOIN Clientes c ON o.clientId = c.id
            WHERE o.companyId = ${companyId}
              AND (p.name LIKE ${like} OR c.businessName LIKE ${like})
            ORDER BY p.name
          `,
          this.prisma.$queryRaw<any[]>`
            SELECT TOP 150 a.name AS actividad, a.status, a.priority AS prioridad,
              a.plannedStartDate AS fechaInicio, a.plannedEndDate AS fechaFin,
              a.progressPercent AS avance,
              f.name AS fase, pm.name AS modulo,
              p.name AS proyecto, c.businessName AS cliente,
              ISNULL(u.firstName, '') + ' ' + ISNULL(u.lastName, '') AS asignado
            FROM Actividades a
            JOIN Fases f ON a.phaseId = f.id
            JOIN ModulosProyecto pm ON f.projectModuleId = pm.id
            JOIN Proyectos p ON pm.projectId = p.id
            JOIN OrdenesServicio o ON p.serviceOrderId = o.id
            JOIN Clientes c ON o.clientId = c.id
            LEFT JOIN Usuarios u ON a.assignedToId = u.id
            WHERE o.companyId = ${companyId}
              AND (p.name LIKE ${like} OR c.businessName LIKE ${like} OR a.name LIKE ${like})
            ORDER BY a.status, pm.name, a.name
          `,
        ]);
        if (proyectos.length > 0 || actividades.length > 0) {
          return { tipo: 'detalle_especifico', proyectos, actividades };
        }
      }
    }

    // General mode: aggregated stats only — no lists to minimize token usage
    const [proyectoStats, actividadStats, avancePorCliente, implementadores] = await Promise.all([
      // Project counts + avg progress by status
      this.prisma.$queryRaw<any[]>`
        SELECT p.status, CAST(COUNT(*) AS INT) AS total,
          AVG(CAST(p.progressPercent AS FLOAT)) AS promedioAvance
        FROM Proyectos p
        JOIN OrdenesServicio o ON p.serviceOrderId = o.id
        WHERE o.companyId = ${companyId}
        GROUP BY p.status
      `,
      // Activity counts by status
      this.prisma.$queryRaw<any[]>`
        SELECT a.status, CAST(COUNT(*) AS INT) AS total
        FROM Actividades a
        JOIN Fases f ON a.phaseId = f.id
        JOIN ModulosProyecto pm ON f.projectModuleId = pm.id
        JOIN Proyectos p ON pm.projectId = p.id
        JOIN OrdenesServicio o ON p.serviceOrderId = o.id
        WHERE o.companyId = ${companyId}
        GROUP BY a.status
      `,
      // Project progress per client (answers "avance por cliente")
      this.prisma.$queryRaw<any[]>`
        SELECT c.businessName AS cliente,
          CAST(COUNT(*) AS INT) AS proyectos,
          AVG(CAST(p.progressPercent AS FLOAT)) AS avancePromedio,
          MIN(CAST(p.progressPercent AS FLOAT)) AS avanceMinimo,
          MAX(CAST(p.progressPercent AS FLOAT)) AS avanceMaximo
        FROM Proyectos p
        JOIN OrdenesServicio o ON p.serviceOrderId = o.id
        JOIN Clientes c ON o.clientId = c.id
        WHERE o.companyId = ${companyId}
        GROUP BY c.businessName
        ORDER BY avancePromedio DESC
      `,
      // Top 10 implementers by activity count
      this.prisma.$queryRaw<any[]>`
        SELECT TOP 10 ISNULL(u.firstName, '') + ' ' + ISNULL(u.lastName, '') AS implementador,
          CAST(COUNT(*) AS INT) AS totalActividades,
          CAST(SUM(CASE WHEN a.status = 'pendiente'  THEN 1 ELSE 0 END) AS INT) AS pendientes,
          CAST(SUM(CASE WHEN a.status = 'en_proceso' THEN 1 ELSE 0 END) AS INT) AS enProceso,
          CAST(SUM(CASE WHEN a.status = 'completado' THEN 1 ELSE 0 END) AS INT) AS completadas,
          CAST(SUM(CASE WHEN a.status = 'vencida'    THEN 1 ELSE 0 END) AS INT) AS vencidas
        FROM Actividades a
        JOIN Fases f ON a.phaseId = f.id
        JOIN ModulosProyecto pm ON f.projectModuleId = pm.id
        JOIN Proyectos p ON pm.projectId = p.id
        JOIN OrdenesServicio o ON p.serviceOrderId = o.id
        JOIN Usuarios u ON a.assignedToId = u.id
        WHERE o.companyId = ${companyId}
          AND a.assignedToId IS NOT NULL
        GROUP BY u.firstName, u.lastName
        ORDER BY totalActividades DESC
      `,
    ]);
    return {
      tipo: 'resumen_general',
      proyectoStats,
      actividadStats,
      avancePorCliente,
      implementadores,
      nota: 'Para ver proyectos o actividades específicas, menciona el nombre del proyecto o cliente.',
    };
  }

  private async fetchRequerimientos(companyId: string, terms: string[]) {
    if (terms.length > 0) {
      for (const term of terms) {
        const like = `%${term}%`;
        const rows = await this.prisma.$queryRaw<any[]>`
          SELECT
            r.numero, r.titulo, r.estadoActual, r.prioridad, r.area, r.tipo,
            c.businessName AS cliente
          FROM Requerimientos r
          JOIN Clientes c ON r.clientId = c.id
          WHERE r.companyId = ${companyId}
            AND (r.numero LIKE ${like} OR r.titulo LIKE ${like} OR c.businessName LIKE ${like})
          ORDER BY r.numero
        `;
        if (rows.length > 0) return { tipo: 'detalle_especifico', registros: rows };
      }
    }

    const [stats, todos] = await Promise.all([
      this.prisma.$queryRaw<any[]>`
        SELECT estadoActual, prioridad, CAST(COUNT(*) AS INT) AS total
        FROM Requerimientos WHERE companyId = ${companyId}
        GROUP BY estadoActual, prioridad
      `,
      this.prisma.$queryRaw<any[]>`
        SELECT TOP 50 r.numero, r.estadoActual, r.prioridad, r.area, c.businessName AS cliente
        FROM Requerimientos r
        JOIN Clientes c ON r.clientId = c.id
        WHERE r.companyId = ${companyId}
        ORDER BY r.numero DESC
      `,
    ]);
    return { tipo: 'resumen_general', estadisticas: stats, requerimientos: todos };
  }

  private async fetchActas(companyId: string, terms: string[]) {
    if (terms.length > 0) {
      for (const term of terms) {
        const like = `%${term}%`;
        const rows = await this.prisma.$queryRaw<any[]>`
          SELECT
            a.type, a.numero, a.fecha, a.status, a.asunto,
            c.businessName AS cliente
          FROM Actas a
          JOIN Proyectos p ON a.projectId = p.id
          JOIN OrdenesServicio o ON p.serviceOrderId = o.id
          JOIN Clientes c ON o.clientId = c.id
          WHERE o.companyId = ${companyId}
            AND (a.numero LIKE ${like} OR a.asunto LIKE ${like} OR c.businessName LIKE ${like})
          ORDER BY a.fecha DESC
        `;
        if (rows.length > 0) return { tipo: 'detalle_especifico', registros: rows };
      }
    }

    const [stats, todas] = await Promise.all([
      this.prisma.$queryRaw<any[]>`
        SELECT a.type, a.status, CAST(COUNT(*) AS INT) AS total
        FROM Actas a
        JOIN Proyectos p ON a.projectId = p.id
        JOIN OrdenesServicio o ON p.serviceOrderId = o.id
        WHERE o.companyId = ${companyId}
        GROUP BY a.type, a.status
      `,
      this.prisma.$queryRaw<any[]>`
        SELECT TOP 30 a.type, a.numero, a.fecha, a.status, c.businessName AS cliente
        FROM Actas a
        JOIN Proyectos p ON a.projectId = p.id
        JOIN OrdenesServicio o ON p.serviceOrderId = o.id
        JOIN Clientes c ON o.clientId = c.id
        WHERE o.companyId = ${companyId}
        ORDER BY a.fecha DESC
      `,
    ]);
    return { tipo: 'resumen_general', estadisticas: stats, actas: todas };
  }

  private async fetchClientes(companyId: string, terms: string[]) {
    if (terms.length > 0) {
      for (const term of terms) {
        const like = `%${term}%`;
        const rows = await this.prisma.$queryRaw<any[]>`
          SELECT c.businessName, c.nit, c.isActive, c.city, c.phone, c.email
          FROM Clientes c
          WHERE c.companyId = ${companyId}
            AND (c.businessName LIKE ${like} OR c.nit LIKE ${like})
          ORDER BY c.businessName
        `;
        if (rows.length > 0) return { tipo: 'detalle_especifico', registros: rows };
      }
    }

    return this.prisma.$queryRaw<any[]>`
      SELECT c.businessName, c.nit, c.isActive, c.city
      FROM Clientes c
      WHERE c.companyId = ${companyId}
      ORDER BY c.businessName
    `;
  }

  // ── System prompt ───────────────────────────────────────────────────────────

  private buildSystemPrompt(intent: Intent, datos: any): string {
    const base = `Eres AURA IA, el asistente inteligente integrado en el ERP de Sistemas Infotec.
Ayudas a los usuarios a consultar información sobre proyectos, clientes, órdenes de servicio, requerimientos y actas.
Responde siempre en español, de forma clara y profesional.
No inventes datos. Si la información solicitada no está en los datos provistos, dilo claramente.
Si la pregunta es ambigua, pide aclaraciones o indica qué información tienes disponible.`;

    if (!datos) return base;

    const extraContext =
      intent === 'dashboard' ? DASHBOARD_CONTEXT :
      intent === 'proyectos' ? PROYECTOS_CONTEXT : '';

    // Compact JSON (no indentation) — cap at 4000 chars to stay within TPM limits
    const MAX_DATA_CHARS = 4000;
    let datosJson = JSON.stringify(
      datos,
      (_, v) => (typeof v === 'bigint' ? Number(v) : v),
    );
    if (datosJson.length > MAX_DATA_CHARS) {
      datosJson = datosJson.slice(0, MAX_DATA_CHARS) + '...(datos truncados)';
    }

    this.logger.debug(`buildSystemPrompt intent=${intent} datosJson=${datosJson.length} chars`);

    return `${base}
${extraContext}
Datos actuales de ${INTENT_LABELS[intent]}:
\`\`\`json
${datosJson}
\`\`\`

Usa estos datos para responder con precisión. ${
  intent === 'dashboard'
    ? 'Puedes interpretar los KPIs, gráficas, actividades próximas, cargas de trabajo y alertas de riesgo.'
    : intent === 'proyectos'
      ? datos?.tipo === 'detalle_especifico'
        ? 'Tienes proyectos y sus actividades filtradas. Puedes responder qué actividades están pendientes, ejecutándose o completadas, y quién las tiene asignadas.'
        : 'Tienes un resumen ejecutivo: estadísticas de proyectos y actividades por estado, avance promedio por cliente, ranking de implementadores y lista de proyectos. Para actividades detalladas menciona el proyecto o cliente específico.'
      : datos?.tipo === 'resumen_general'
        ? 'Tienes la lista de registros (máximo 100 más recientes). Puedes responder sobre cualquiera de ellos.'
        : datos?.tipo === 'detalle_especifico'
          ? 'Estos son los registros que coinciden con la búsqueda del usuario.'
          : ''
}`;
  }
}
