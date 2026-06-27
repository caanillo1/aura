import { Injectable, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InformesService {
  private readonly logger = new Logger(InformesService.name);

  constructor(private prisma: PrismaService) {}

  async listSnapshots(companyId: string) {
    const snapshots = await this.prisma.informeEjecutivoSnapshot.findMany({
      where: { companyId },
      select: {
        id: true, titulo: true, fechaCorte: true, createdAt: true,
        creadoPor: { select: { firstName: true, lastName: true } },
      },
      orderBy: { fechaCorte: 'desc' },
    });
    return snapshots.map(s => ({
      id: s.id,
      titulo: s.titulo,
      fechaCorte: s.fechaCorte,
      createdAt: s.createdAt,
      creadoPor: `${s.creadoPor.firstName} ${s.creadoPor.lastName}`,
    }));
  }

  async getSnapshot(id: string, companyId: string) {
    const snap = await this.prisma.informeEjecutivoSnapshot.findFirst({
      where: { id, companyId },
    });
    if (!snap) throw new NotFoundException('Snapshot no encontrado');
    return {
      id: snap.id,
      titulo: snap.titulo,
      fechaCorte: snap.fechaCorte,
      createdAt: snap.createdAt,
      datos: JSON.parse(snap.datos),
      observaciones: snap.observaciones ?? '',
      recomendaciones: snap.recomendaciones ?? '',
    };
  }

  async createSnapshot(companyId: string, userId: string, body: {
    titulo: string;
    fechaCorte: string;
    datos: any[];
    observaciones?: string;
    recomendaciones?: string;
  }) {
    const snap = await this.prisma.informeEjecutivoSnapshot.create({
      data: {
        companyId,
        creadoPorId: userId,
        titulo: body.titulo,
        fechaCorte: new Date(body.fechaCorte),
        datos: JSON.stringify(body.datos),
        observaciones: body.observaciones ?? null,
        recomendaciones: body.recomendaciones ?? null,
      },
    });
    return { id: snap.id, titulo: snap.titulo, createdAt: snap.createdAt };
  }

  async deleteSnapshot(id: string, companyId: string) {
    await this.prisma.informeEjecutivoSnapshot.deleteMany({ where: { id, companyId } });
    return { ok: true };
  }

  // ── Análisis IA ─────────────────────────────────────────────────────────────

  async generarAnalisis(companyId: string) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new InternalServerErrorException('ANTHROPIC_API_KEY no configurada');

    // Recopilar datos reales de todos los proyectos activos
    const projects = await this.prisma.project.findMany({
      where: { serviceOrder: { companyId }, status: { not: 'cancelado' } },
      select: {
        id: true, name: true, status: true, progressPercent: true,
        startDate: true, endDate: true,
        motivoRetraso: true, responsableRetraso: true,
        serviceOrder: { select: { client: { select: { businessName: true } } } },
        modules: {
          select: {
            name: true, progressPercent: true,
            phases: {
              select: {
                name: true, status: true,
                activities: {
                  select: {
                    name: true, status: true, progressPercent: true,
                    blockedBy: true, blockedNote: true, clientDelayDays: true,
                    priority: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { endDate: 'asc' },
    });

    // Construir resumen estructurado para el prompt
    const hoy = new Date();
    const resumenProyectos = projects.map(p => {
      const diasRetraso = Math.floor((hoy.getTime() - new Date(p.endDate).getTime()) / 86400000);
      const todasActividades = p.modules.flatMap(m => m.phases.flatMap(ph => ph.activities));
      const bloqueadas  = todasActividades.filter(a => a.blockedBy);
      const conDemoraCliente = todasActividades.filter(a => (a.clientDelayDays ?? 0) > 0);
      const criticas    = todasActividades.filter(a => a.priority === 'Crítico' && a.status !== 'completado');
      const porEstado   = todasActividades.reduce((acc, a) => {
        acc[a.status] = (acc[a.status] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        cliente: p.serviceOrder.client?.businessName ?? 'Sin cliente',
        proyecto: p.name,
        estado: p.status,
        avance: `${Number(p.progressPercent)}%`,
        diasRetraso: diasRetraso > 0 ? diasRetraso : 0,
        responsableRetraso: p.responsableRetraso || 'No especificado',
        actividades: {
          total: todasActividades.length,
          porEstado,
          bloqueadas: bloqueadas.map(a => ({ nombre: a.name, motivo: a.blockedNote || a.blockedBy })),
          demorasCliente: conDemoraCliente.map(a => ({ nombre: a.name, dias: a.clientDelayDays })),
          criticas: criticas.map(a => a.name),
        },
      };
    });

    const prompt = `Eres un consultor senior de implementación de proyectos de software hospitalario (HIS/ERP).
Analiza los siguientes datos reales de proyectos de implementación y redacta en español profesional:

1. OBSERVACIONES: 5 a 7 puntos concisos basados estrictamente en los datos. Cada punto debe mencionar situaciones específicas (clientes, porcentajes, actividades) observadas en los datos.
2. RECOMENDACIONES: 4 a 5 acciones concretas y priorizadas para mejorar el avance de los proyectos.

DATOS DE PROYECTOS (${resumenProyectos.length} proyectos activos):
${JSON.stringify(resumenProyectos, null, 2)}

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta (sin texto antes ni después):
{
  "observaciones": "• Punto 1\\n• Punto 2\\n• Punto 3\\n• Punto 4\\n• Punto 5",
  "recomendaciones": "1. Acción 1\\n2. Acción 2\\n3. Acción 3\\n4. Acción 4"
}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        this.logger.error(`Anthropic API error: ${err}`);
        throw new InternalServerErrorException('Error al consultar la IA');
      }

      const data: any = await response.json();
      const text = data?.content?.[0]?.text ?? '';

      // Extraer JSON de la respuesta
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new InternalServerErrorException('Respuesta IA sin formato esperado');

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        observaciones:   parsed.observaciones   ?? '',
        recomendaciones: parsed.recomendaciones ?? '',
      };
    } catch (e: any) {
      if (e instanceof InternalServerErrorException) throw e;
      this.logger.error(e);
      throw new InternalServerErrorException('Error procesando respuesta de IA');
    }
  }
}
