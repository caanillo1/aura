import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

type Intent = 'ordenes' | 'proyectos' | 'requerimientos' | 'actas' | 'clientes' | 'resumen' | 'general';

const INTENT_LABELS: Record<Intent, string> = {
  ordenes: 'órdenes de servicio',
  proyectos: 'proyectos de implementación',
  requerimientos: 'requerimientos y tickets',
  actas: 'actas de reunión',
  clientes: 'clientes',
  resumen: 'resumen general del sistema',
  general: 'información general',
};

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private prisma: PrismaService) {}

  async chat(
    companyId: string,
    mensaje: string,
    historial: ChatMessage[],
    contexto?: ChatContext,
  ): Promise<{ respuesta: string; intent: string }> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY no configurado');

    const intent = this.detectIntent(mensaje, contexto);
    const datos = await this.fetchData(companyId, intent);
    const systemPrompt = this.buildSystemPrompt(intent, datos);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historial.slice(-10),
      { role: 'user', content: mensaje },
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.4,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`Groq error: ${err}`);
      throw new Error('Error al consultar la IA');
    }

    const json = (await response.json()) as any;
    const respuesta =
      json.choices?.[0]?.message?.content ?? 'No se pudo obtener una respuesta.';

    return { respuesta, intent };
  }

  private detectIntent(mensaje: string, contexto?: ChatContext): Intent {
    const lower = mensaje.toLowerCase();
    const pagina = (contexto?.pagina ?? '').toLowerCase();

    if (pagina.includes('orden') && !lower.match(/proyecto|requerimiento|acta/)) return 'ordenes';
    if (pagina.includes('proyecto') && !lower.match(/orden|requerimiento|acta/)) return 'proyectos';
    if (pagina.includes('requerimiento') && !lower.match(/orden|proyecto|acta/)) return 'requerimientos';
    if (pagina.includes('acta') && !lower.match(/orden|proyecto|requerimiento/)) return 'actas';

    if (/orden(es)?\s*(de\s*)?servicio|\borden\b|\bos\b/i.test(lower)) return 'ordenes';
    if (/proyecto|avance|m[oó]dulo(s)?\b|fase\b|actividad(es)?\b/i.test(lower)) return 'proyectos';
    if (/requerimiento|ticket|gesti[oó]n|priori(dad|zar)|backlog/i.test(lower)) return 'requerimientos';
    if (/\bacta\b|reuni[oó]n|sesi[oó]n/i.test(lower)) return 'actas';
    if (/\bcliente|empresa|compa[nñ]/i.test(lower)) return 'clientes';
    if (/resumen|informe|estad[ií]stic|kpi|general|todos/i.test(lower)) return 'resumen';

    return 'general';
  }

  private async fetchData(companyId: string, intent: Intent): Promise<any> {
    try {
      switch (intent) {
        case 'ordenes':        return await this.fetchOrdenes(companyId);
        case 'proyectos':      return await this.fetchProyectos(companyId);
        case 'requerimientos': return await this.fetchRequerimientos(companyId);
        case 'actas':          return await this.fetchActas(companyId);
        case 'clientes':       return await this.fetchClientes(companyId);
        case 'resumen':        return await this.fetchResumen(companyId);
        default:               return null;
      }
    } catch (err: any) {
      this.logger.error(`Error fetching data intent=${intent}: ${err?.message}`);
      return null;
    }
  }

  private fetchOrdenes(companyId: string) {
    return this.prisma.$queryRaw<any[]>`
      SELECT TOP 25
        o.osNumber, o.status, o.product, o.startDate, o.endDate,
        c.businessName AS cliente
      FROM OrdenesServicio o
      JOIN Clientes c ON o.clientId = c.id
      WHERE o.companyId = ${companyId}
      ORDER BY o.createdAt DESC
    `;
  }

  private fetchProyectos(companyId: string) {
    return this.prisma.$queryRaw<any[]>`
      SELECT TOP 20
        p.name, p.status, p.progressPercent, p.startDate, p.endDate,
        c.businessName AS cliente
      FROM Proyectos p
      JOIN OrdenesServicio o ON p.serviceOrderId = o.id
      JOIN Clientes c ON o.clientId = c.id
      WHERE o.companyId = ${companyId}
      ORDER BY p.updatedAt DESC
    `;
  }

  private fetchRequerimientos(companyId: string) {
    return this.prisma.$queryRaw<any[]>`
      SELECT TOP 30
        r.numero, r.titulo, r.estadoActual, r.prioridad, r.area, r.tipo,
        c.businessName AS cliente
      FROM Requerimientos r
      JOIN Clientes c ON r.clientId = c.id
      WHERE r.companyId = ${companyId}
      ORDER BY r.createdAt DESC
    `;
  }

  private fetchActas(companyId: string) {
    return this.prisma.$queryRaw<any[]>`
      SELECT TOP 20
        a.type, a.numero, a.fecha, a.status, a.asunto,
        c.businessName AS cliente
      FROM Actas a
      JOIN Proyectos p ON a.projectId = p.id
      JOIN OrdenesServicio o ON p.serviceOrderId = o.id
      JOIN Clientes c ON o.clientId = c.id
      WHERE o.companyId = ${companyId}
      ORDER BY a.fecha DESC
    `;
  }

  private fetchClientes(companyId: string) {
    return this.prisma.$queryRaw<any[]>`
      SELECT TOP 30
        c.businessName, c.nit, c.isActive, c.city
      FROM Clientes c
      WHERE c.companyId = ${companyId}
      ORDER BY c.businessName
    `;
  }

  private async fetchResumen(companyId: string) {
    const [ordenes, proyectos, reqs] = await Promise.all([
      this.prisma.$queryRaw<any[]>`
        SELECT status, COUNT(*) AS total
        FROM OrdenesServicio
        WHERE companyId = ${companyId}
        GROUP BY status
      `,
      this.prisma.$queryRaw<any[]>`
        SELECT p.status, COUNT(*) AS total
        FROM Proyectos p
        JOIN OrdenesServicio o ON p.serviceOrderId = o.id
        WHERE o.companyId = ${companyId}
        GROUP BY p.status
      `,
      this.prisma.$queryRaw<any[]>`
        SELECT estadoActual, COUNT(*) AS total
        FROM Requerimientos
        WHERE companyId = ${companyId}
        GROUP BY estadoActual
      `,
    ]);
    return { ordenes, proyectos, reqs };
  }

  private buildSystemPrompt(intent: Intent, datos: any): string {
    const base = `Eres AURA IA, el asistente inteligente integrado en el ERP de Sistemas Infotec.
Ayudas a los usuarios a consultar información sobre proyectos, clientes, órdenes de servicio, requerimientos y actas.
Responde siempre en español, de forma clara y profesional.
No inventes datos. Si la información solicitada no está en los datos provistos, dilo claramente.
Si la pregunta es ambigua, pide aclaraciones o indica qué información tienes disponible.`;

    if (!datos) return base;

    return `${base}

Datos actuales de ${INTENT_LABELS[intent]}:
\`\`\`json
${JSON.stringify(datos, null, 2)}
\`\`\`

Usa estos datos para responder. Si el usuario menciona un cliente o entidad específica, filtra la respuesta a esa entidad.`;
  }
}
